export function defaultValue(key: Record<string, any>): any {
  if (key.default !== undefined) return key.default
  switch (key.type) {
    case '<string>':     return key.rangelist?.[0] ?? ''
    case '<integer>':    return key.rangelist?.[0] ?? 0
    case '<real>':       return 0
    case '<boolean>':    return false
    case '<array>':      return []
    case '<dictionary>': {
      const named = key.subkeys?.filter((s: any) => s.key !== 'ANY') ?? []
      return named.length ? initFormData(named) : {}
    }
    default: return ''
  }
}

export function initFormData(keys: Record<string, any>[]): Record<string, any> {
  const data: Record<string, any> = {}
  for (const key of keys) {
    if (key.presence === 'required') {
      data[key.key] = defaultValue(key)
    }
  }
  return data
}
