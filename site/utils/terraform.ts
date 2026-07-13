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
