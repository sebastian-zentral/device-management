// Reverse of utils/terraform.ts: parse a Terraform snippet for the Zentral
// provider (a zentral_mdm_artifact block plus a zentral_mdm_profile or
// zentral_mdm_declaration block) back into builder state.
//
// It fully round-trips what this builder emits (inline base64encode(<<PROFILE …)
// and jsonencode({…})). For real-world configs it degrades gracefully:
// filebase64()/templatefile() sources can't be resolved from the .tf alone
// (reported as such), and `var.*`/expression values become editable string
// placeholders.

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
  kind: 'xml' | 'file' | 'unresolved'
  xml?: string
  path?: string
  note?: string
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

/** Extract the body of `resource "<type>" "<label>" { … }` (first match). */
function extractBlock(hcl: string, resourceType: string): { label: string; body: string } | null {
  const header = new RegExp(`resource\\s+"${resourceType}"\\s+"([^"]+)"\\s*\\{`)
  const m = header.exec(hcl)
  if (!m) return null
  const braceOpen = m.index + m[0].length - 1
  const close = matchDelim(hcl, braceOpen, '{', '}')
  if (close < 0) return null
  return { label: m[1], body: hcl.slice(braceOpen + 1, close) }
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

function parseProfileSource(body: string): TfProfileSource {
  // filebase64("...")
  const file = /source\s*=\s*filebase64\(\s*"([^"]+)"/.exec(body)
  if (file) return { kind: 'file', path: file[1], note: 'Source is an external file; import the referenced .mobileconfig to edit its payloads.' }

  const b64arg = extractCallArg(body, 'base64encode')
  if (b64arg != null) {
    // base64encode(<<TAG … TAG)
    const hd = /^<<-?([A-Za-z0-9_]+)\r?\n([\s\S]*?)\r?\n[ \t]*\1\b/.exec(b64arg)
    if (hd) {
      const xml = hd[2].replace(/\$\$\{/g, '${').replace(/%%\{/g, '%{')
      return { kind: 'xml', xml }
    }
    // base64encode("literal")
    const lit = /^"((?:[^"\\]|\\.)*)"$/.exec(b64arg)
    if (lit) { try { return { kind: 'xml', xml: decodeBase64Xml(unescapeString(lit[1])) } } catch { /* fall */ } }
    return { kind: 'unresolved', note: 'Source uses templatefile()/expressions that can\'t be resolved from the .tf alone.' }
  }

  // source = "BASE64LITERAL"
  const lit = /source\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(body)
  if (lit) {
    try {
      const xml = decodeBase64Xml(unescapeString(lit[1]))
      if (xml.startsWith('<?xml') || xml.includes('<plist')) return { kind: 'xml', xml }
      return { kind: 'unresolved', note: 'Source is base64 but not an XML property list (possibly a binary plist).' }
    } catch { return { kind: 'unresolved', note: 'Could not decode the base64 source.' } }
  }

  return { kind: 'unresolved', note: 'Could not find a recognizable source.' }
}

// ── Public entry point ───────────────────────────────────────────────────────

export function parseTerraform(hcl: string): TfImportResult {
  const artifactBlock = extractBlock(hcl, 'zentral_mdm_artifact')
  const artifact: TfArtifact = artifactBlock
    ? {
        name: readString(artifactBlock.body, 'name'),
        type: readString(artifactBlock.body, 'type'),
        channel: readString(artifactBlock.body, 'channel'),
        platforms: readStringArray(artifactBlock.body, 'platforms'),
      }
    : {}

  const profileBlock = extractBlock(hcl, 'zentral_mdm_profile')
  const declBlock = extractBlock(hcl, 'zentral_mdm_declaration')
  const block = profileBlock ?? declBlock
  if (!block) throw new Error('No zentral_mdm_profile or zentral_mdm_declaration resource found.')

  const platformBools = {
    ios: readBool(block.body, 'ios'),
    ipados: readBool(block.body, 'ipados'),
    macos: readBool(block.body, 'macos'),
    tvos: readBool(block.body, 'tvos'),
  }
  const version = readNumber(block.body, 'version')
  const constraints = readConstraints(block.body)

  if (profileBlock) {
    return { kind: 'profile', artifact, version, platformBools, constraints, profileSource: parseProfileSource(profileBlock.body) }
  }

  const arg = extractCallArg(declBlock!.body, 'jsonencode')
  if (arg == null) throw new Error('Declaration has no jsonencode({...}) source.')
  const declaration = new HclParser(arg).parse()
  if (!declaration || typeof declaration !== 'object') throw new Error('Could not parse the declaration source object.')
  return { kind: 'declaration', artifact, version, platformBools, constraints, declaration }
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
