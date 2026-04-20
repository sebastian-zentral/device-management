export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  path: string
  message: string
}

export interface PayloadResult {
  index: number
  payloadType: string
  payloadIdentifier: string
  schemaTitle: string
  schemaFound: boolean
  issues: ValidationIssue[]
}

export interface ProfileValidationResult {
  profileIssues: ValidationIssue[]
  payloads: PayloadResult[]
  errorCount: number
  warningCount: number
}

// Keys defined in CommonPayloadKeys.yaml — present in every payload but not in individual schemas
const COMMON_PAYLOAD_KEYS = new Set([
  'PayloadType', 'PayloadVersion', 'PayloadIdentifier', 'PayloadUUID',
  'PayloadDisplayName', 'PayloadDescription', 'PayloadOrganization',
  'PayloadEnabled', 'PayloadScope',
])

const TOP_LEVEL_KEYS = new Set([
  ...COMMON_PAYLOAD_KEYS,
  'PayloadContent', 'PayloadExpirationDate', 'PayloadRemovalDisallowed',
  'TargetDeviceType', 'ConsentText', 'PayloadDate',
])

function jsType(value: any): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function schemaTypeName(t: string): string {
  const m: Record<string, string> = {
    '<string>': 'string', '<integer>': 'integer', '<real>': 'real',
    '<boolean>': 'boolean', '<array>': 'array', '<dictionary>': 'dictionary',
    '<data>': 'data', '<date>': 'date',
  }
  return m[t] ?? t
}

function typeMatches(value: any, schemaType: string): boolean {
  switch (schemaType) {
    case '<string>':     return typeof value === 'string'
    case '<integer>':    return typeof value === 'number' && Number.isInteger(value)
    case '<real>':       return typeof value === 'number'
    case '<boolean>':    return typeof value === 'boolean'
    case '<array>':      return Array.isArray(value)
    case '<dictionary>': return typeof value === 'object' && value !== null && !Array.isArray(value)
    case '<data>':       return typeof value === 'string'
    case '<date>':       return typeof value === 'string'
    case '<any>':        return true
    default:             return true
  }
}

function validateKeys(
  obj: Record<string, any>,
  schemaKeys: Record<string, any>[],
  path: string,
  issues: ValidationIssue[],
  skipUnknown = false,
) {
  const defined = new Set(schemaKeys.map((k: any) => k.key).filter((k: string) => k !== 'ANY'))

  // Walk schema keys: check required, type, rangelist, recurse
  for (const keyDef of schemaKeys) {
    if (keyDef.key === 'ANY') continue
    const keyPath = path ? `${path}.${keyDef.key}` : keyDef.key
    const value = obj[keyDef.key]

    if (value === undefined || value === null) {
      if (keyDef.presence === 'required') {
        issues.push({ severity: 'error', path: keyPath, message: `Required key "${keyDef.key}" is missing` })
      }
      continue
    }

    if (keyDef.type && !typeMatches(value, keyDef.type)) {
      issues.push({
        severity: 'error', path: keyPath,
        message: `Expected ${schemaTypeName(keyDef.type)} but got ${jsType(value)}`,
      })
      continue
    }

    if (keyDef.rangelist?.length && !keyDef.rangelist.includes(value)) {
      issues.push({
        severity: 'error', path: keyPath,
        message: `"${value}" is not an allowed value — expected one of: ${keyDef.rangelist.join(', ')}`,
      })
    }

    // Recurse into dictionary subkeys
    if (keyDef.type === '<dictionary>' && typeof value === 'object') {
      const named = (keyDef.subkeys ?? []).filter((s: any) => s.key !== 'ANY')
      if (named.length) {
        validateKeys(value, named, keyPath, issues)
      }
    }

    // Validate array items
    if (keyDef.type === '<array>' && Array.isArray(value) && keyDef.subkeys?.length) {
      const itemDef = keyDef.subkeys[0]
      if (itemDef && itemDef.key !== 'ANY') {
        value.forEach((item: any, i: number) => {
          const itemPath = `${keyPath}[${i}]`
          if (!typeMatches(item, itemDef.type)) {
            issues.push({
              severity: 'error', path: itemPath,
              message: `Expected ${schemaTypeName(itemDef.type)} but got ${jsType(item)}`,
            })
            return
          }
          if (itemDef.rangelist?.length && !itemDef.rangelist.includes(item)) {
            issues.push({
              severity: 'error', path: itemPath,
              message: `"${item}" is not an allowed value — expected one of: ${itemDef.rangelist.join(', ')}`,
            })
          }
          if (itemDef.type === '<dictionary>' && typeof item === 'object') {
            const named = (itemDef.subkeys ?? []).filter((s: any) => s.key !== 'ANY')
            if (named.length) validateKeys(item, named, itemPath, issues)
          }
        })
      }
    }
  }

  // Warn about keys present in the payload but not in the schema
  if (!skipUnknown) {
    for (const k of Object.keys(obj)) {
      if (!defined.has(k)) {
        issues.push({
          severity: 'warning', path: path ? `${path}.${k}` : k,
          message: `Key "${k}" is not defined in the schema`,
        })
      }
    }
  }
}

function validateTopLevel(parsed: Record<string, any>): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (parsed.PayloadType !== 'Configuration') {
    issues.push({ severity: 'error', path: 'PayloadType', message: `PayloadType must be "Configuration", got "${parsed.PayloadType}"` })
  }
  if (!parsed.PayloadIdentifier) {
    issues.push({ severity: 'error', path: 'PayloadIdentifier', message: 'PayloadIdentifier is missing' })
  }
  if (!parsed.PayloadUUID) {
    issues.push({ severity: 'error', path: 'PayloadUUID', message: 'PayloadUUID is missing' })
  }
  if (!parsed.PayloadVersion) {
    issues.push({ severity: 'warning', path: 'PayloadVersion', message: 'PayloadVersion is missing (expected 1)' })
  }
  if (!parsed.PayloadDisplayName) {
    issues.push({ severity: 'warning', path: 'PayloadDisplayName', message: 'PayloadDisplayName is missing — the profile will show a generic name on device' })
  }
  if (!Array.isArray(parsed.PayloadContent) || parsed.PayloadContent.length === 0) {
    issues.push({ severity: 'warning', path: 'PayloadContent', message: 'PayloadContent is empty — the profile has no payloads' })
  }
  for (const k of Object.keys(parsed)) {
    if (!TOP_LEVEL_KEYS.has(k)) {
      issues.push({ severity: 'warning', path: k, message: `Top-level key "${k}" is not a standard profile key` })
    }
  }
  return issues
}

export async function validateProfile(
  parsed: Record<string, any>,
  fetchSchema: (payloadType: string) => Promise<Record<string, any> | null>,
): Promise<ProfileValidationResult> {
  const profileIssues = validateTopLevel(parsed)
  const payloads: PayloadResult[] = []

  for (const [i, rawPayload] of (parsed.PayloadContent ?? []).entries()) {
    const payloadType: string = rawPayload.PayloadType ?? '(unknown)'
    const payloadIdentifier: string = rawPayload.PayloadIdentifier ?? ''
    const issues: ValidationIssue[] = []

    // Standard payload meta checks
    if (!rawPayload.PayloadUUID) {
      issues.push({ severity: 'error', path: 'PayloadUUID', message: 'PayloadUUID is missing' })
    }
    if (!rawPayload.PayloadVersion) {
      issues.push({ severity: 'warning', path: 'PayloadVersion', message: 'PayloadVersion is missing (expected 1)' })
    }

    const schema = await fetchSchema(payloadType)
    if (!schema) {
      issues.push({ severity: 'info', path: '', message: `No schema found for "${payloadType}" — skipping payload-specific validation` })
      payloads.push({ index: i, payloadType, payloadIdentifier, schemaTitle: payloadType, schemaFound: false, issues })
      continue
    }

    // Strip common keys before validating payload-specific keys
    const payloadData: Record<string, any> = {}
    for (const [k, v] of Object.entries(rawPayload)) {
      if (!COMMON_PAYLOAD_KEYS.has(k)) payloadData[k] = v
    }

    validateKeys(payloadData, schema.payloadkeys ?? [], '', issues)

    payloads.push({
      index: i,
      payloadType,
      payloadIdentifier,
      schemaTitle: schema.title ?? payloadType,
      schemaFound: true,
      issues,
    })
  }

  const errorCount = profileIssues.filter(i => i.severity === 'error').length
    + payloads.flatMap(p => p.issues).filter(i => i.severity === 'error').length
  const warningCount = profileIssues.filter(i => i.severity === 'warning').length
    + payloads.flatMap(p => p.issues).filter(i => i.severity === 'warning').length

  return { profileIssues, payloads, errorCount, warningCount }
}
