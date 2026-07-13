<script setup lang="ts">
// Read-only CodeMirror 6 viewer with per-language grammars. Instantiated only
// on the client (CodeMirror needs the DOM); an SSR/pre-hydration <pre> fallback
// keeps the content visible and avoids layout shift.
const props = defineProps<{ content: string; lang?: 'xml' | 'json' | 'hcl' }>()

const host = ref<HTMLElement | null>(null)
let view: any = null
let compartment: any = null

async function langExtension(lang?: string) {
  if (lang === 'json') return (await import('@codemirror/lang-json')).json()
  if (lang === 'xml') return (await import('@codemirror/lang-xml')).xml()
  if (lang === 'hcl') return (await import('codemirror-lang-hcl')).hcl()
  return []
}

onMounted(async () => {
  const [cm, state] = await Promise.all([import('codemirror'), import('@codemirror/state')])
  const { EditorView, basicSetup } = cm
  const { EditorState, Compartment } = state
  if (!host.value) return

  compartment = new Compartment()
  const theme = EditorView.theme({
    '&': { backgroundColor: 'transparent', color: '#334155', height: '100%' },
    '.cm-scroller': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: '12px',
      lineHeight: '1.6',
      overflow: 'auto',
    },
    '.cm-content': { padding: '12px 0' },
    '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: '#cbd5e1' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '&.cm-focused': { outline: 'none' },
    '.cm-selectionBackground, ::selection': { backgroundColor: '#cfe9f1' },
  }, { dark: false })

  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.content,
      extensions: [
        basicSetup,
        compartment.of(await langExtension(props.lang)),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        theme,
      ],
    }),
  })
})

watch(() => props.content, (c) => {
  if (view && c !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: c } })
  }
})

watch(() => props.lang, async (l) => {
  if (view && compartment) {
    view.dispatch({ effects: compartment.reconfigure(await langExtension(l)) })
  }
})

onBeforeUnmount(() => { view?.destroy(); view = null })
</script>

<template>
  <ClientOnly>
    <div ref="host" class="h-full overflow-hidden" />
    <template #fallback>
      <pre class="p-4 text-xs font-mono text-ztl-anthracite leading-relaxed whitespace-pre overflow-x-auto">{{ content }}</pre>
    </template>
  </ClientOnly>
</template>
