export interface PlatformContext {
  platforms: string[]
  supervised: boolean
  enrollment: string
}

export interface Compatibility {
  hidden: boolean
  warnings: string[]
}

export function checkCompatibility(
  keyData: Record<string, any>,
  ctx: PlatformContext | undefined,
  isRequired: boolean,
): Compatibility {
  if (!ctx || ctx.platforms.length === 0) return { hidden: false, warnings: [] }

  const supportedOS = keyData.supportedOS as Record<string, any> | undefined
  if (!supportedOS) return { hidden: false, warnings: [] }

  const warnings: string[] = []
  const unavailableOn: string[] = []

  for (const platform of ctx.platforms) {
    const osData = supportedOS[platform]
    if (!osData) continue

    if (osData.introduced === 'n/a' || osData.removed) {
      unavailableOn.push(platform)
      continue
    }
    if (osData.supervised === true && !ctx.supervised) {
      warnings.push(`Supervised only (${platform})`)
    }
    if (ctx.enrollment === 'user' && osData.userenrollment?.mode === 'forbidden') {
      warnings.push(`No User Enrollment (${platform})`)
    }
    if (ctx.enrollment !== 'dep' && osData.requiresdep === true) {
      warnings.push(`Requires DEP (${platform})`)
    }
    if (osData.deprecated) {
      warnings.push(`Deprecated in ${platform} ${osData.deprecated}`)
    }
  }

  const listedPlatforms = ctx.platforms.filter(p => supportedOS[p])
  const allUnavailable = listedPlatforms.length > 0 && unavailableOn.length === listedPlatforms.length

  if (!allUnavailable && unavailableOn.length > 0) {
    warnings.unshift(`Not on ${unavailableOn.join(', ')}`)
  }

  return {
    hidden: allUnavailable && !isRequired,
    warnings,
  }
}
