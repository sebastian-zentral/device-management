// Derives the Zentral MDM artifact channel (Device / User) from Apple's
// device-management schemas.
//
// Profiles express channel support per-OS via `supportedOS[os].devicechannel`
// and `supportedOS[os].userchannel`. Declarations instead use
// `supportedOS[os].allowed-scopes`, where the `system` scope maps to the device
// channel and the `user` scope maps to the user channel.

export type Channel = 'Device' | 'User'
export const CHANNELS: Channel[] = ['Device', 'User']

export interface ChannelCapability {
  device: boolean
  user: boolean
}

/** Channel support advertised by a single profile `supportedOS[os]` block. */
function blockProfileChannels(block: Record<string, any>): ChannelCapability {
  if ('devicechannel' in block || 'userchannel' in block) {
    return { device: block.devicechannel === true, user: block.userchannel === true }
  }
  // Convention when unspecified: profiles install on the device channel.
  return { device: true, user: false }
}

/**
 * Channel support for one profile payload across the targeted platforms.
 * A payload counts as channel-capable if any targeted, supported platform
 * advertises that channel.
 */
export function profilePayloadChannels(schema: Record<string, any>, platforms: string[]): ChannelCapability {
  const os = schema?.payload?.supportedOS ?? {}
  let device = false, user = false, seen = false
  for (const p of platforms) {
    const block = os[p]
    if (!block || block.introduced === 'n/a') continue
    seen = true
    const cap = blockProfileChannels(block)
    device ||= cap.device
    user ||= cap.user
  }
  // Unknown (no matching platform / no data) — don't constrain the choice.
  return seen ? { device, user } : { device: true, user: true }
}

/**
 * Combine the channel capabilities of every payload in a profile. A profile is
 * delivered on a single channel, so every payload must support it (intersection).
 */
export function combineProfileChannels(caps: ChannelCapability[]): ChannelCapability {
  if (!caps.length) return { device: true, user: true }
  return {
    device: caps.every(c => c.device),
    user: caps.every(c => c.user),
  }
}

/** Channel support for a declaration across the targeted platforms. */
export function declarationChannels(schema: Record<string, any>, platforms: string[]): ChannelCapability {
  const os = schema?.payload?.supportedOS ?? {}
  let device = false, user = false, seen = false
  for (const p of platforms) {
    const block = os[p]
    if (!block || block.introduced === 'n/a') continue
    const scopes = block['allowed-scopes']
    if (!Array.isArray(scopes)) continue
    seen = true
    if (scopes.includes('system')) device = true
    if (scopes.includes('user')) user = true
  }
  return seen ? { device, user } : { device: true, user: true }
}

/** Turn a capability into the allowed channels and a sensible default. */
export function resolveChannel(cap: ChannelCapability): { allowed: Channel[]; default: Channel } {
  const allowed: Channel[] = []
  if (cap.device) allowed.push('Device')
  if (cap.user) allowed.push('User')
  if (!allowed.length) allowed.push('Device', 'User') // fallback: unconstrained
  // Prefer the device channel when both are supported — the common case.
  return { allowed, default: allowed.includes('Device') ? 'Device' : 'User' }
}
