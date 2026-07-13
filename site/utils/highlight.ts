// Tiny dependency-free syntax highlighter for the read-only output panel.
// Handles the three content types the builder emits: plist XML (.mobileconfig),
// JSON (declarations), and HCL (Terraform). Returns an HTML-escaped string with
// <span class="tok-*"> wrappers, safe to render with v-html.

export type Lang = 'xml' | 'json' | 'hcl'

interface Rule { cls: string; re: string }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Each rule contributes exactly one capturing group (use (?:…) internally), so
// the matched group index maps 1:1 to a rule/class.
const GRAMMARS: Record<Lang, Rule[]> = {
  json: [
    { cls: 'key', re: '"(?:[^"\\\\]|\\\\.)*"(?=\\s*:)' },
    { cls: 'str', re: '"(?:[^"\\\\]|\\\\.)*"' },
    { cls: 'num', re: '-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?' },
    { cls: 'bool', re: '\\b(?:true|false|null)\\b' },
  ],
  xml: [
    { cls: 'comment', re: '<!--[\\s\\S]*?-->' },
    { cls: 'meta', re: '<[?!][^>]*>' },
    { cls: 'tag', re: '</?[A-Za-z][\\w.:-]*(?:\\s[^>]*)?/?>' },
  ],
  hcl: [
    { cls: 'comment', re: '#[^\\n]*|//[^\\n]*' },
    // heredoc body (our closing tag always sits alone on its own line)
    { cls: 'str', re: '<<-?[A-Za-z0-9_]+[\\s\\S]*?\\n[ \\t]*[A-Za-z0-9_]+' },
    { cls: 'str', re: '"(?:[^"\\\\]|\\\\.)*"' },
    { cls: 'keyword', re: '\\b(?:resource|variable|module|data|output|locals|provider|terraform|import)\\b' },
    { cls: 'func', re: '\\b(?:jsonencode|base64encode|filebase64|templatefile|base64decode|file|format)(?=\\()' },
    { cls: 'attr', re: '[A-Za-z_][A-Za-z0-9_-]*(?=\\s*=(?!=))' },
    { cls: 'num', re: '\\b\\d+\\b' },
    { cls: 'bool', re: '\\b(?:true|false|null)\\b' },
  ],
}

const compiled = new Map<Lang, { re: RegExp; classes: string[] }>()

function grammar(lang: Lang) {
  let g = compiled.get(lang)
  if (!g) {
    const rules = GRAMMARS[lang]
    g = {
      re: new RegExp(rules.map(r => `(${r.re})`).join('|'), 'g'),
      classes: rules.map(r => r.cls),
    }
    compiled.set(lang, g)
  }
  return g
}

export function highlight(code: string, lang?: Lang): string {
  if (!lang || !GRAMMARS[lang]) return esc(code)
  try {
    const { re, classes } = grammar(lang)
    re.lastIndex = 0
    let out = ''
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(code))) {
      if (m.index > last) out += esc(code.slice(last, m.index))
      let cls = ''
      for (let i = 0; i < classes.length; i++) {
        if (m[i + 1] !== undefined) { cls = classes[i]; break }
      }
      out += `<span class="tok-${cls}">${esc(m[0])}</span>`
      last = re.lastIndex
      if (re.lastIndex === m.index) re.lastIndex++ // guard against zero-length matches
    }
    out += esc(code.slice(last))
    return out
  } catch {
    return esc(code)
  }
}
