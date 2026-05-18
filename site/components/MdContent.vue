<script setup lang="ts">
import { marked } from 'marked'

const props = defineProps<{ text: string; inline?: boolean }>()
const html = ref('')

async function render(text: string) {
  if (!text) { html.value = ''; return }
  html.value = props.inline
    ? (marked.parseInline(text) as string)
    : (marked.parse(text) as string)
}

onMounted(() => render(props.text))
watch(() => props.text, render)
</script>

<template>
  <div v-if="!inline" class="prose prose-sm max-w-none prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-slate-700 prose-blockquote:border-l-blue-400 prose-blockquote:bg-blue-50 prose-blockquote:py-1 prose-blockquote:rounded-r" v-html="html || text" />
  <span v-else class="prose prose-sm" v-html="html || text" />
</template>
