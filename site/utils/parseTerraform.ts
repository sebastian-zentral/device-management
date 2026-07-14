// Reverse of utils/terraform.ts: parse a Terraform snippet for the Zentral
// provider (a zentral_mdm_artifact block plus a zentral_mdm_profile or
// zentral_mdm_declaration block) back into builder state.
//
// It fully round-trips what this builder emits (inline base64encode(<<PROFILE …)
// and jsonencode({…})). For real-world configs it degrades gracefully:
// filebase64()/templatefile() sources can't be resolved from the .tf alone
// (reported as such), and `var.*`/expression values become editable string
// placeholders.

import { type Rendered, renderProfileTf, renderDeclarationTf } from '~/utils/terraform'

export interface TfArtifact {
  name?: string
  type?: string
  channel?: string
  platforms?: string[]
}

export interface TfVersionConstraints {
  ios?: { min?: string; max?: string }
  ipados?: { min?: string; max?: string }
  macos?: { min?: string; max?: string }
  tvos?: { min?: string; max?: string }
}

export interface TfProfileSource {
  kind: 'xml' | 'template' | 'file' | 'unresolved'
  xml?: string
  path?: string
  note?: string
  // Whether the source referenced an external file (filebase64/templatefile) —
  // used to restore the external-file toggle and file name on import.
  external?: boolean
  fileName?: string
}

export interface TfImportResult {
  kind: 'profile' | 'declaration'
  artifact: TfArtifact
  version?: number
  platformBools: { ios: boolean; ipados: boolean; macos: boolean; tvos: boolean }
  constraints: TfVersionConstraints
  profileSource?: TfProfileSource
  declaration?: Record<string, any>
}

// ── Low-level scanning ───────────────────────────────────────────────────────

/**
 * From the `{` (or `(`/`[`) at `open`, return the index of its matching close,
 * ignoring delimiters inside double-quoted strings and heredocs.
 */
function matchDelim(s: string, open: number, openCh: string, closeCh: string): number {
  let depth = 0
  let inStr = false
  let heredoc: string | null = null
  for (let i = open; i < s.length; i++) {
    const c = s[i]
    if (heredoc !== null) {
      if (c === '\n') {
        const line = /^[ \t]*([A-Za-z0-9_]+)[ \t]*\r?(?:\n|$)/.exec(s.slice(i + 1))
        if (line && line[1] === heredoc) heredoc = null
      }
      continue
    }
    if (inStr) {
      if (c === '\\') { i++; continue }
      if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; continue }
    if (c === '<' && s[i + 1] === '<') {
      const hm = /^<<-?([A-Za-z0-9_]+)/.exec(s.slice(i))
      if (hm) { heredoc = hm[1]; i += hm[0].length - 1; continue }
    }
    if (c === openCh) depth++
    else if (c === closeCh) { depth--; if (depth === 0) return i }
  }
  return -1
}

/** Extract the bodies of every `resource "<type>" "<label>" { … }`. */
function extractAllBlocks(hcl: string, resourceType: string): { label: string; body: string }[] {
  const header = new RegExp(`resource\\s+"${resourceType}"\\s+"([^"]+)"\\s*\\{`, 'g')
  const out: { label: string; body: string }[] = []
  let m: RegExpExecArray | null
  while ((m = header.exec(hcl))) {
    const braceOpen = m.index + m[0].length - 1
    const close = matchDelim(hcl, braceOpen, '{', '}')
    if (close < 0) continue
    out.push({ label: m[1], body: hcl.slice(braceOpen + 1, close) })
    header.lastIndex = close + 1
  }
  return out
}

/** Extract the body of the first `resource "<type>" "<label>" { … }`. */
function extractBlock(hcl: string, resourceType: string): { label: string; body: string } | null {
  return extractAllBlocks(hcl, resourceType)[0] ?? null
}

function basename(p: string): string {
  return (p.split('/').pop() || p).trim()
}

// ── Attribute readers ────────────────────────────────────────────────────────

function unescapeString(raw: string): string {
  return raw.replace(/\\(["\\ntr])/g, (_, c) =>
    c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c)
}

function readString(body: string, key: string): string | undefined {
  const m = new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(body)
  return m ? unescapeString(m[1]) : undefined
}

function readNumber(body: string, key: string): number | undefined {
  const m = new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*(-?\\d+)`).exec(body)
  return m ? Number(m[1]) : undefined
}

function readBool(body: string, key: string): boolean {
  const m = new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*(true|false)`).exec(body)
  return m ? m[1] === 'true' : false
}

function readStringArray(body: string, key: string): string[] | undefined {
  const m = new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*\\[([^\\]]*)\\]`).exec(body)
  if (!m) return undefined
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(x => unescapeString(x[1]))
}

function readConstraints(body: string): TfVersionConstraints {
  const out: TfVersionConstraints = {}
  for (const p of ['ios', 'ipados', 'macos', 'tvos'] as const) {
    const min = readString(body, `${p}_min_version`)
    const max = readString(body, `${p}_max_version`)
    if (min || max) out[p] = { min: min || '', max: max || '' }
  }
  return out
}

// ── HCL expression parser (for jsonencode object literals) ───────────────────

class HclParser {
  s: string
  i = 0
  constructor(s: string) { this.s = s }

  private ws() {
    for (;;) {
      const c = this.s[this.i]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ',') { this.i++; continue }
      if (c === '#' || (c === '/' && this.s[this.i + 1] === '/')) {
        while (this.i < this.s.length && this.s[this.i] !== '\n') this.i++
        continue
      }
      break
    }
  }

  parse(): any { this.ws(); return this.value() }

  private value(): any {
    this.ws()
    const c = this.s[this.i]
    if (c === '{') return this.object()
    if (c === '[') return this.array()
    if (c === '"') return this.string()
    if (c === '<' && this.s[this.i + 1] === '<') return this.heredoc()
    if (/[-\d]/.test(c) && /^-?\d/.test(this.s.slice(this.i, this.i + 2))) return this.number()
    return this.bareword()
  }

  private object(): Record<string, any> {
    this.i++ // {
    const obj: Record<string, any> = {}
    for (;;) {
      this.ws()
      if (this.s[this.i] === '}') { this.i++; break }
      if (this.i >= this.s.length) break
      let key: string
      if (this.s[this.i] === '"') key = this.string()
      else { const m = /^[A-Za-z0-9_.\-/]+/.exec(this.s.slice(this.i)); key = m ? m[0] : ''; this.i += key.length }
      this.ws()
      if (this.s[this.i] === '=' || this.s[this.i] === ':') this.i++
      obj[key] = this.value()
    }
    return obj
  }

  private array(): any[] {
    this.i++ // [
    const arr: any[] = []
    for (;;) {
      this.ws()
      if (this.s[this.i] === ']') { this.i++; break }
      if (this.i >= this.s.length) break
      arr.push(this.value())
    }
    return arr
  }

  private string(): string {
    this.i++ // opening "
    let out = ''
    while (this.i < this.s.length) {
      const c = this.s[this.i++]
      if (c === '\\') {
        const n = this.s[this.i++]
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n
      } else if (c === '"') break
      else out += c
    }
    return out
  }

  private heredoc(): string {
    const hm = /^<<-?([A-Za-z0-9_]+)\r?\n([\s\S]*?)\r?\n[ \t]*\1\b/.exec(this.s.slice(this.i))
    if (!hm) { return this.bareword() }
    this.i += hm[0].length
    return hm[2]
  }

  private number(): number {
    const m = /^-?\d+(\.\d+)?/.exec(this.s.slice(this.i))!
    this.i += m[0].length
    const n = Number(m[0])
    return n
  }

  // Bare identifier / expression (e.g. `var.macos_27_beta_token`, `true`, a
  // function call). Literals become their JS value; everything else is kept as
  // its raw source text so the user can see and edit it.
  private bareword(): any {
    const start = this.i
    // capture identifier chain, with balanced () for function calls
    while (this.i < this.s.length) {
      const c = this.s[this.i]
      if (/[A-Za-z0-9_.\-]/.test(c)) { this.i++; continue }
      if (c === '(') { this.i = matchDelim(this.s, this.i, '(', ')') + 1; continue }
      break
    }
    const raw = this.s.slice(start, this.i).trim()
    if (raw === 'true') return true
    if (raw === 'false') return false
    if (raw === 'null') return null
    return raw
  }
}

/** Extract the argument of `fn(` … `)` starting at/after `from`. */
function extractCallArg(body: string, fn: string): string | null {
  const idx = body.indexOf(`${fn}(`)
  if (idx < 0) return null
  const paren = idx + fn.length
  const close = matchDelim(body, paren, '(', ')')
  if (close < 0) return null
  return body.slice(paren + 1, close).trim()
}

function decodeBase64Xml(b64: string): string {
  const clean = b64.replace(/\s+/g, '')
  const bin = atob(clean)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function parseProfileSource(body: string, files?: Record<string, string>): TfProfileSource {
  // filebase64("…path.mobileconfig")
  const file = /source\s*=\s*filebase64\(\s*"([^"]+)"/.exec(body)
  if (file) {
    const name = basename(file[1])
    const content = files?.[name]
    if (content != null) return { kind: 'xml', xml: content, external: true, fileName: name, note: `Loaded from ${name}` }
    return { kind: 'file', path: file[1], external: true, fileName: name, note: 'Source is an external file; import the referenced .mobileconfig to edit its payloads.' }
  }

  const b64arg = extractCallArg(body, 'base64encode')
  if (b64arg != null) {
    // base64encode(templatefile("…", { … }))
    const tf = /templatefile\(\s*"([^"]+)"/.exec(b64arg)
    if (tf) {
      const name = basename(tf[1])
      const content = files?.[name]
      if (content != null) return { kind: 'template', xml: content, external: true, fileName: name, note: 'Rendered from templatefile(); ${…} variables are left as placeholders.' }
      return { kind: 'unresolved', path: tf[1], external: true, fileName: name, note: 'Source uses templatefile() whose file was not included.' }
    }
    // base64encode(<<TAG … TAG)
    const hd = /^<<-?([A-Za-z0-9_]+)\r?\n([\s\S]*?)\r?\n[ \t]*\1\b/.exec(b64arg)
    if (hd) {
      const xml = hd[2].replace(/\$\$\{/g, '${').replace(/%%\{/g, '%{')
      return { kind: 'xml', xml, external: false }
    }
    // base64encode("literal")
    const lit = /^"((?:[^"\\]|\\.)*)"$/.exec(b64arg)
    if (lit) { try { return { kind: 'xml', xml: decodeBase64Xml(unescapeString(lit[1])), external: false } } catch { /* fall */ } }
    return { kind: 'unresolved', note: 'Source uses an expression that can\'t be resolved from the .tf alone.' }
  }

  // source = "BASE64LITERAL"
  const lit = /source\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(body)
  if (lit) {
    try {
      const xml = decodeBase64Xml(unescapeString(lit[1]))
      if (xml.startsWith('<?xml') || xml.includes('<plist')) return { kind: 'xml', xml, external: false }
      return { kind: 'unresolved', note: 'Source is base64 but not an XML property list (possibly a binary plist).' }
    } catch { return { kind: 'unresolved', note: 'Could not decode the base64 source.' } }
  }

  return { kind: 'unresolved', note: 'Could not find a recognizable source.' }
}

// ── Body parsers ─────────────────────────────────────────────────────────────

function parseArtifactBody(body: string): TfArtifact {
  return {
    name: readString(body, 'name'),
    type: readString(body, 'type'),
    channel: readString(body, 'channel'),
    platforms: readStringArray(body, 'platforms'),
  }
}

function parseCommon(body: string) {
  return {
    platformBools: {
      ios: readBool(body, 'ios'),
      ipados: readBool(body, 'ipados'),
      macos: readBool(body, 'macos'),
      tvos: readBool(body, 'tvos'),
    },
    version: readNumber(body, 'version'),
    constraints: readConstraints(body),
  }
}

function parseDeclarationObject(body: string): Record<string, any> {
  const arg = extractCallArg(body, 'jsonencode')
  if (arg == null) throw new Error('Declaration has no jsonencode({...}) source.')
  const declaration = new HclParser(arg).parse()
  if (!declaration || typeof declaration !== 'object') throw new Error('Could not parse the declaration source object.')
  return declaration
}

// ── Public entry points ──────────────────────────────────────────────────────

export function parseTerraform(hcl: string): TfImportResult {
  const artifactBlock = extractBlock(hcl, 'zentral_mdm_artifact')
  const artifact = artifactBlock ? parseArtifactBody(artifactBlock.body) : {}

  const profileBlock = extractBlock(hcl, 'zentral_mdm_profile')
  const declBlock = extractBlock(hcl, 'zentral_mdm_declaration')
  const block = profileBlock ?? declBlock
  if (!block) throw new Error('No zentral_mdm_profile or zentral_mdm_declaration resource found.')

  const common = parseCommon(block.body)
  if (profileBlock) {
    return { kind: 'profile', artifact, ...common, profileSource: parseProfileSource(profileBlock.body) }
  }
  return { kind: 'declaration', artifact, ...common, declaration: parseDeclarationObject(declBlock!.body) }
}

export interface RepoArtifact {
  label: string
  kind: 'profile' | 'declaration'
  artifactLabel?: string
  artifact: TfArtifact
  version?: number
  platformBools: TfImportResult['platformBools']
  constraints: TfVersionConstraints
  profileSource?: TfProfileSource
  declaration?: Record<string, any>
  warnings: string[]
}

export interface RepoParseResult {
  artifacts: RepoArtifact[]
  skipped: { kind: string; count: number }[]
}

const KNOWN_RESOURCES = new Set(['zentral_mdm_artifact', 'zentral_mdm_profile', 'zentral_mdm_declaration'])
const ARTIFACT_REF = /artifact_id\s*=\s*zentral_mdm_artifact\.([A-Za-z0-9_-]+)\.id/

/**
 * Parse every MDM profile/declaration artifact across a set of `.tf` files,
 * resolving profile sources against the uploaded files (keyed by basename).
 */
export function parseTerraformRepo(tfSources: string[], files: Record<string, string> = {}): RepoParseResult {
  const hcl = tfSources.join('\n\n')

  const artifactByLabel = new Map<string, TfArtifact>()
  for (const b of extractAllBlocks(hcl, 'zentral_mdm_artifact')) artifactByLabel.set(b.label, parseArtifactBody(b.body))

  const artifacts: RepoArtifact[] = []

  for (const b of extractAllBlocks(hcl, 'zentral_mdm_profile')) {
    const artifactLabel = ARTIFACT_REF.exec(b.body)?.[1]
    const artifact = (artifactLabel && artifactByLabel.get(artifactLabel)) || {}
    const src = parseProfileSource(b.body, files)
    const warnings: string[] = []
    if (src.kind === 'template') warnings.push('templatefile ${…} variables left as placeholders')
    if (src.kind === 'file') warnings.push('.mobileconfig not found — metadata only')
    if (src.kind === 'unresolved') warnings.push(src.note ?? 'source could not be resolved')
    artifacts.push({ label: b.label, kind: 'profile', artifactLabel, artifact, ...parseCommon(b.body), profileSource: src, warnings })
  }

  for (const b of extractAllBlocks(hcl, 'zentral_mdm_declaration')) {
    const artifactLabel = ARTIFACT_REF.exec(b.body)?.[1]
    const artifact = (artifactLabel && artifactByLabel.get(artifactLabel)) || {}
    const warnings: string[] = []
    let declaration: Record<string, any> = {}
    try { declaration = parseDeclarationObject(b.body) } catch (e: any) { warnings.push(e.message) }
    if (JSON.stringify(declaration).includes('var.')) warnings.push('contains var.* placeholders')
    artifacts.push({ label: b.label, kind: 'declaration', artifactLabel, artifact, ...parseCommon(b.body), declaration, warnings })
  }

  const counts = new Map<string, number>()
  for (const m of hcl.matchAll(/resource\s+"([a-z_]+)"/g)) {
    if (KNOWN_RESOURCES.has(m[1])) continue
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1)
  }
  const skipped = [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count)

  artifacts.sort((a, b) => (a.artifact.name || a.label).localeCompare(b.artifact.name || b.label))
  return { artifacts, skipped }
}

/**
 * Render a parsed repo artifact back to HCL (+ its .mobileconfig when the profile
 * references an external file). Returns null for a profile whose content couldn't
 * be resolved. Uses the artifact's original resource label as the slug to keep
 * names stable and unique across the combined export.
 */
export function renderRepoArtifact(a: RepoArtifact): Rendered | null {
  const platforms = platformsToBuilder(a.artifact.platforms, a.platformBools)
  const name = a.artifact.name || a.label
  const channel = a.artifact.channel === 'User' ? 'User' : 'Device'
  const version = a.version ?? 1
  const constraints = a.constraints ?? {}
  if (a.kind === 'profile') {
    const xml = a.profileSource?.xml
    if (!xml) return null
    const fileName = a.profileSource?.fileName || `${a.label}.v${version}.mobileconfig`
    return renderProfileTf({ slug: a.label, name, channel, platforms, version, constraints, profileXml: xml, external: !!a.profileSource?.external, fileName })
  }
  return renderDeclarationTf({ slug: a.label, name, channel, platforms, version, constraints, declaration: a.declaration ?? {} })
}

/** Map provider artifact platforms (macOS/iOS/iPadOS/tvOS) back to builder targets. */
export function platformsToBuilder(platforms: string[] | undefined, bools: TfImportResult['platformBools']): string[] {
  const set = new Set<string>()
  for (const p of platforms ?? []) {
    if (p === 'iOS' || p === 'iPadOS') set.add('iOS')
    else if (p === 'macOS') set.add('macOS')
    else if (p === 'tvOS') set.add('tvOS')
  }
  // Fall back to the resource toggles if the artifact platforms were absent.
  if (!set.size) {
    if (bools.ios || bools.ipados) set.add('iOS')
    if (bools.macos) set.add('macOS')
    if (bools.tvos) set.add('tvOS')
  }
  return set.size ? [...set] : ['macOS']
}
