<script setup lang="ts">
import { type Lang, highlight } from '~/utils/highlight'

const props = defineProps<{
  content: string
  filename: string
  label: string
  lang?: Lang
  extra?: { content: string; filename: string; label: string } | null
}>()

const highlighted = computed(() => highlight(props.content, props.lang))

const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(props.content)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-white shrink-0 rounded-t-xl">
      <span class="text-xs font-semibold text-ztl-anthracite/50 uppercase tracking-wide">{{ label }}</span>
      <div class="flex gap-2">
        <button
          class="text-xs px-3 py-1.5 rounded-md border transition-colors"
          :class="copied
            ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
            : 'text-slate-600 border-slate-200 hover:bg-slate-50'"
          @click="copy"
        >{{ copied ? 'Copied!' : 'Copy' }}</button>
        <button
          class="text-xs px-3 py-1.5 rounded-md bg-ztl-anthracite text-white hover:bg-ztl-anthracite/90 transition-colors font-medium"
          @click="downloadFile(content, filename)"
        >↓ {{ filename }}</button>
        <button
          v-if="extra"
          class="text-xs px-3 py-1.5 rounded-md border border-ztl-anthracite text-ztl-anthracite hover:bg-slate-50 transition-colors font-medium"
          :title="`Download the .mobileconfig referenced by filebase64()`"
          @click="downloadFile(extra.content, extra.filename)"
        >{{ extra.label }}</button>
      </div>
    </div>

    <!-- Code -->
    <div class="flex-1 overflow-y-auto bg-slate-50">
      <pre class="p-4 text-xs font-mono text-ztl-anthracite leading-relaxed whitespace-pre overflow-x-auto" v-html="highlighted" />
    </div>
  </div>
</template>

<style scoped>
:deep(.tok-comment) { color: #94a3b8; font-style: italic; }
:deep(.tok-meta)    { color: #94a3b8; }
:deep(.tok-tag)     { color: #0369a1; }
:deep(.tok-key)     { color: #7c3aed; }
:deep(.tok-attr)    { color: #7c3aed; }
:deep(.tok-str)     { color: #15803d; }
:deep(.tok-num)     { color: #b45309; }
:deep(.tok-bool)    { color: #2563eb; }
:deep(.tok-keyword) { color: #2563eb; font-weight: 600; }
:deep(.tok-func)    { color: #0369a1; }
</style>
