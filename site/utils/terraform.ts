// Helpers for rendering builder output as Terraform HCL for the
// terraform-provider-zentral provider (zentral_mdm_artifact + zentral_mdm_profile
// / zentral_mdm_declaration resources).

/** Escape a string for an HCL double-quoted literal. */
export function tfString(s: string): string {
  return '"' + s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t') + '"'
}

/** Render a list of strings as an inline HCL array: ["a", "b"]. */
export function tfStringArray(items: string[]): string {
  return '[' + items.map(tfString).join(', ') + ']'
}

/** Turn an arbitrary label into a valid Terraform resource local name. */
export function tfSlug(s: string): string {
  let slug = (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  // A Terraform identifier must start with a letter or underscore.
  if (!/^[a-z_]/.test(slug)) slug = '_' + slug
  return slug || 'resource'
}

/**
 * Escape `${` and `%{` so a heredoc body is treated as a literal by Terraform.
 * Terraform resolves `$${` -> `${` (and `%%{` -> `%{`) before evaluating the
 * heredoc, so base64encode(<<EOT ...) reproduces the original bytes exactly.
 */
export function escapeHeredoc(s: string): string {
  return s.replace(/\$\{/g, '$${').replace(/%\{/g, '%%{')
}

/** Is this a bare HCL identifier, or does it need quoting as an object key? */
function isBareKey(k: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(k)
}

/**
 * Serialize a JS value to idiomatic HCL, for use inside `jsonencode({ ... })`.
 * Mirrors how the provider's own examples express declaration sources.
 */
export function toHcl(value: any, indent = 1): string {
  const pad = '  '.repeat(indent)
  const padEnd = '  '.repeat(Math.max(indent - 1, 0))

  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return tfString(value)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map(v => pad + toHcl(v, indent + 1))
    return '[\n' + items.join(',\n') + '\n' + padEnd + ']'
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    const lines = entries.map(([k, v]) => {
      const key = isBareKey(k) ? k : tfString(k)
      return pad + key + ' = ' + toHcl(v, indent + 1)
    })
    return '{\n' + lines.join('\n') + '\n' + padEnd + '}'
  }

  return tfString(String(value))
}

export interface TfPlatforms {
  /** Values for the artifact `platforms` set. */
  platforms: string[]
  /** Per-platform install toggles on the profile/declaration resource. */
  bools: Record<'ios' | 'ipados' | 'macos' | 'tvos', boolean>
  /** Builder platforms with no Zentral MDM equivalent (visionOS, watchOS). */
  dropped: string[]
}

/**
 * Map the builder's platform selection onto the provider's artifact platforms
 * and per-platform resource toggles. The builder offers a single "iOS" option;
 * Zentral tracks iOS and iPadOS separately, so "iOS" expands to both.
 */
export function mapPlatforms(builderPlatforms: string[]): TfPlatforms {
  const platforms = new Set<string>()
  const bools = { ios: false, ipados: false, macos: false, tvos: false }
  const dropped: string[] = []

  for (const p of builderPlatforms) {
    switch (p) {
      case 'iOS':
        platforms.add('iOS'); platforms.add('iPadOS')
        bools.ios = true; bools.ipados = true
        break
      case 'macOS':
        platforms.add('macOS'); bools.macos = true
        break
      case 'tvOS':
        platforms.add('tvOS'); bools.tvos = true
        break
      default:
        dropped.push(p) // visionOS, watchOS — not supported by the provider
    }
  }

  // The artifact requires at least one platform.
  if (platforms.size === 0) { platforms.add('macOS'); bools.macos = true }

  return { platforms: [...platforms], bools, dropped }
}

/** Derive the artifact `type` from a DDM declaration type identifier. */
export function declarationArtifactType(declarationType: string): { type: string; note?: string } {
  const kind = (declarationType || '').split('.')[2] || ''
  switch (kind) {
    case 'configuration': return { type: 'Configuration' }
    case 'activation': return { type: 'Activation' }
    case 'asset': return { type: 'Asset' }
    default:
      return {
        type: 'Configuration',
        note: `Could not derive the artifact type from "${declarationType}"; defaulting to "Configuration" — verify this is correct.`,
      }
  }
}

export interface PlatformConstraint { min?: string; max?: string }
export type PlatformConstraints = Partial<Record<'ios' | 'ipados' | 'macos' | 'tvos', PlatformConstraint>>

/**
 * HCL lines for the per-platform install toggles (only the enabled ones),
 * each optionally followed by its `*_min_version` / `*_max_version` constraints.
 */
export function platformLines(
  bools: TfPlatforms['bools'],
  constraints: PlatformConstraints = {},
  indent = '  ',
): string[] {
  const out: string[] = []
  for (const k of ['ios', 'ipados', 'macos', 'tvos'] as const) {
    if (!bools[k]) continue
    out.push(`${indent}${k} = true`)
    const c = constraints[k]
    if (c?.min) out.push(`${indent}${k}_min_version = ${tfString(c.min)}`)
    if (c?.max) out.push(`${indent}${k}_max_version = ${tfString(c.max)}`)
  }
  return out
}

// ── Full artifact rendering (pure) ────────────────────────────────────────────
// Shared by the live builder and the bulk "export all" so both emit identical HCL.

export interface Rendered { tf: string; mobileconfig?: { name: string; content: string } }

interface BaseRenderOpts {
  name: string
  channel: string            // "Device" | "User"
  platforms: string[]        // builder platform names (iOS/macOS/tvOS/…)
  version: number
  constraints?: PlatformConstraints
  slug?: string              // resource local name; defaults to a slug of name
}

export interface ProfileRenderOpts extends BaseRenderOpts {
  profileXml: string         // serialized .mobileconfig
  external: boolean          // filebase64() vs inline base64encode()
  fileName: string           // basename referenced by filebase64 / companion file
}

export interface DeclarationRenderOpts extends BaseRenderOpts {
  declaration: Record<string, any>  // { Type, Identifier, ServerToken, Payload }
}

export function renderProfileTf(o: ProfileRenderOpts): Rendered {
  const slug = tfSlug(o.slug || o.name || 'profile')
  const pm = mapPlatforms(o.platforms)
  const filePath = `mobileconfigs/${o.fileName}`
  const lines: string[] = []
  if (pm.dropped.length) lines.push(`# Note: ${pm.dropped.join(', ')} — no Zentral MDM artifact platform equivalent; omitted.`)
  lines.push(`resource "zentral_mdm_artifact" "${slug}" {`)
  lines.push(`  name      = ${tfString(o.name)}`)
  lines.push(`  type      = "Profile"`)
  lines.push(`  channel   = ${tfString(o.channel)}`)
  lines.push(`  platforms = ${tfStringArray(pm.platforms)}`)
  lines.push(`}`)
  lines.push(``)
  if (o.external) lines.push(`# Save the profile (the ".mobileconfig" output) to: ${filePath}`)
  lines.push(`resource "zentral_mdm_profile" "${slug}" {`)
  lines.push(`  artifact_id = zentral_mdm_artifact.${slug}.id`)
  if (o.external) {
    lines.push(`  source      = filebase64("\${path.module}/${filePath}")`)
  } else {
    lines.push(`  source      = base64encode(<<PROFILE`)
    lines.push(escapeHeredoc(o.profileXml))
    lines.push(`PROFILE`)
    lines.push(`  )`)
  }
  lines.push(...platformLines(pm.bools, o.constraints ?? {}))
  lines.push(`  version = ${o.version}`)
  lines.push(`}`)
  return { tf: lines.join('\n') + '\n', mobileconfig: o.external ? { name: o.fileName, content: o.profileXml } : undefined }
}

export function renderDeclarationTf(o: DeclarationRenderOpts): Rendered {
  const slug = tfSlug(o.slug || o.name || 'declaration')
  const at = declarationArtifactType(o.declaration.Type ?? '')
  const pm = mapPlatforms(o.platforms)
  const lines: string[] = []
  if (at.note) lines.push(`# Note: ${at.note}`)
  if (pm.dropped.length) lines.push(`# Note: ${pm.dropped.join(', ')} — no Zentral MDM artifact platform equivalent; omitted.`)
  lines.push(`resource "zentral_mdm_artifact" "${slug}" {`)
  lines.push(`  name      = ${tfString(o.name)}`)
  lines.push(`  type      = ${tfString(at.type)}`)
  lines.push(`  channel   = ${tfString(o.channel)}`)
  lines.push(`  platforms = ${tfStringArray(pm.platforms)}`)
  lines.push(`}`)
  lines.push(``)
  lines.push(`resource "zentral_mdm_declaration" "${slug}" {`)
  lines.push(`  artifact_id = zentral_mdm_artifact.${slug}.id`)
  lines.push(`  source      = jsonencode(${toHcl(o.declaration, 2)})`)
  lines.push(...platformLines(pm.bools, o.constraints ?? {}))
  lines.push(`  version = ${o.version}`)
  lines.push(`}`)
  return { tf: lines.join('\n') + '\n' }
}
