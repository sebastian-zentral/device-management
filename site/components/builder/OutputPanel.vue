<script setup lang="ts">
const props = defineProps<{
  content: string
  filename: string
  label: string
}>()

const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(props.content)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

function download() {
  const blob = new Blob([props.content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = props.filename
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50 shrink-0 rounded-t-xl">
      <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">{{ label }}</span>
      <div class="flex gap-2">
        <button
          class="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-white transition-colors"
          :class="copied ? 'text-green-600 border-green-300' : 'text-slate-600'"
          @click="copy"
        >{{ copied ? 'Copied!' : 'Copy' }}</button>
        <button
          class="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
          @click="download"
        >↓ {{ filename }}</button>
      </div>
    </div>

    <!-- Code -->
    <div class="flex-1 overflow-y-auto">
      <pre class="p-4 text-xs font-mono text-slate-700 leading-relaxed whitespace-pre overflow-x-auto">{{ content }}</pre>
    </div>
  </div>
</template>
