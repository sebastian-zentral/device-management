<script setup lang="ts">
const props = defineProps<{
  content: string
  filename: string
  label: string
  lang?: 'xml' | 'json' | 'hcl'
  extra?: { content: string; filename: string; label: string } | null
}>()

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
    <!-- Toolbar: title on its own line, actions below -->
    <div class="flex flex-col gap-1.5 px-4 py-2 border-b border-slate-100 bg-white shrink-0 rounded-t-xl">
      <span class="text-[11px] font-semibold text-ztl-anthracite/50 uppercase tracking-wide truncate">{{ label }}</span>
      <div class="flex flex-wrap gap-1.5">
        <button
          class="text-[11px] px-2 py-1 rounded border transition-colors"
          :class="copied
            ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
            : 'text-slate-600 border-slate-200 hover:bg-slate-50'"
          @click="copy"
        >{{ copied ? 'Copied!' : 'Copy' }}</button>
        <button
          class="text-[11px] px-2 py-1 rounded bg-ztl-anthracite text-white hover:bg-ztl-anthracite/90 transition-colors font-medium max-w-[14rem] flex items-center gap-1 min-w-0"
          :title="`Download ${filename}`"
          @click="downloadFile(content, filename)"
        ><Icon name="lucide:download" class="w-3 h-3 shrink-0" /> <span class="truncate">{{ filename }}</span></button>
        <button
          v-if="extra"
          class="text-[11px] px-2 py-1 rounded border border-ztl-anthracite text-ztl-anthracite hover:bg-slate-50 transition-colors font-medium max-w-[14rem] flex items-center gap-1 min-w-0"
          :title="`Download the .mobileconfig referenced by filebase64()`"
          @click="downloadFile(extra.content, extra.filename)"
        ><Icon name="lucide:download" class="w-3 h-3 shrink-0" /> <span class="truncate">{{ extra.filename }}</span></button>
      </div>
    </div>

    <!-- Code -->
    <div class="flex-1 min-h-0 overflow-hidden bg-slate-50">
      <BuilderCodeEditor :content="content" :lang="lang" />
    </div>
  </div>
</template>
