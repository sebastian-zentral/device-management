function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function serializeValue(val: any, depth: number): string | null {
  if (val === null || val === undefined) return null
  const pad = '  '.repeat(depth)

  if (typeof val === 'boolean') return `${pad}${val ? '<true/>' : '<false/>'}`

  if (typeof val === 'number') {
    if (!isFinite(val)) return null
    return Number.isInteger(val)
      ? `${pad}<integer>${val}</integer>`
      : `${pad}<real>${val}</real>`
  }

  if (typeof val === 'string') {
    // Always serialize strings, even empty ones (caller decides to include or not)
    return `${pad}<string>${escapeXml(val)}</string>`
  }

  if (Array.isArray(val)) {
    const items = val
      .map(v => serializeValue(v, depth + 1))
      .filter((v): v is string => v !== null)
    if (items.length === 0) return `${pad}<array/>`
    return `${pad}<array>\n${items.join('\n')}\n${pad}</array>`
  }

  if (typeof val === 'object') {
    const lines: string[] = []
    for (const [k, v] of Object.entries(val)) {
      if (v === undefined) continue
      const s = serializeValue(v, depth + 1)
      if (s === null) continue
      lines.push(`${pad}  <key>${escapeXml(k)}</key>`)
      lines.push(s)
    }
    if (lines.length === 0) return `${pad}<dict/>`
    return `${pad}<dict>\n${lines.join('\n')}\n${pad}</dict>`
  }

  return null
}

export function toPlist(obj: Record<string, any>): string {
  const body = serializeValue(obj, 0) ?? '<dict/>'
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    body,
    '</plist>',
  ].join('\n')
}
