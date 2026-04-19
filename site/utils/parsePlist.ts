function parseElement(el: Element): any {
  switch (el.tagName.toLowerCase()) {
    case 'string': return el.textContent ?? ''
    case 'integer': return parseInt(el.textContent ?? '0', 10)
    case 'real': return parseFloat(el.textContent ?? '0')
    case 'true': return true
    case 'false': return false
    case 'data': return el.textContent?.trim() ?? ''
    case 'date': return el.textContent ?? ''
    case 'array': {
      return Array.from(el.children).map(parseElement)
    }
    case 'dict': {
      const obj: Record<string, any> = {}
      const children = Array.from(el.children)
      for (let i = 0; i + 1 < children.length; i += 2) {
        const key = children[i].textContent ?? ''
        obj[key] = parseElement(children[i + 1])
      }
      return obj
    }
    default:
      return el.textContent
  }
}

export function parsePlist(xml: string): Record<string, any> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml.trim(), 'text/xml')

  const parseErr = doc.querySelector('parsererror')
  if (parseErr) throw new Error(`XML parse error: ${parseErr.textContent?.slice(0, 120)}`)

  const root = doc.querySelector('plist > *')
  if (!root) throw new Error('No root element found inside <plist>')

  const result = parseElement(root)
  if (typeof result !== 'object' || Array.isArray(result)) throw new Error('Expected a top-level dict')
  return result
}
