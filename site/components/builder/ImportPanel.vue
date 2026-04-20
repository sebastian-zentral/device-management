<script setup lang="ts">
import { parsePlist } from '~/utils/parsePlist'

const emit = defineEmits<{ import: [parsed: Record<string, any>]; close: [] }>()

const fileInput = ref<HTMLInputElement>()
const pastedXml = ref('')
const isDragging = ref(false)
const error = ref('')

function readFile(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => { pastedXml.value = (e.target?.result as string) ?? ''; error.value = '' }
  reader.readAsText(file)
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) readFile(file)
}

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) readFile(file)
}

function doImport() {
  error.value = ''
  try {
    const parsed = parsePlist(pastedXml.value)
    if (!parsed.PayloadContent) throw new Error('No PayloadContent found — is this a Configuration profile?')
    emit('import', parsed)
  } catch (e: any) {
    error.value = e.message ?? 'Failed to parse plist'
  }
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-ztl-navy/60 backdrop-blur-sm"
    @click="onBackdrop"
  >
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 class="font-semibold text-ztl-navy">Import .mobileconfig</h3>
        <button class="text-slate-400 hover:text-ztl-navy text-lg leading-none" @click="emit('close')">✕</button>
      </div>

      <div class="p-5 space-y-4">
        <!-- Drop zone -->
        <div
          class="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
          :class="isDragging
            ? 'border-ztl-cyan bg-ztl-cyan/10'
            : 'border-slate-200 hover:border-ztl-cyan hover:bg-ztl-cyan/5'"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          @click="fileInput?.click()"
        >
          <input ref="fileInput" type="file" accept=".mobileconfig,.plist,.xml" class="hidden" @change="handleFileChange">
          <div class="text-3xl mb-2">📂</div>
          <p class="text-sm font-medium text-ztl-anthracite">
            Drag & drop a <code class="font-mono bg-slate-100 px-1 rounded">.mobileconfig</code> file here
          </p>
          <p class="text-xs text-slate-400 mt-1">or click to browse</p>
        </div>

        <!-- Paste -->
        <div>
          <p class="text-xs font-semibold text-ztl-anthracite/50 uppercase tracking-wide mb-2">Or paste XML</p>
          <textarea
            v-model="pastedXml"
            rows="7"
            spellcheck="false"
            placeholder="<?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?>&#10;<!DOCTYPE plist …>"
            class="w-full px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ztl-cyan resize-y placeholder:text-slate-300"
          />
        </div>

        <p v-if="error" class="text-sm text-ztl-red bg-ztl-red/10 rounded-lg px-3 py-2">{{ error }}</p>
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
        <button
          class="px-4 py-2 text-sm text-slate-500 hover:text-ztl-navy font-medium"
          @click="emit('close')"
        >Cancel</button>
        <button
          class="px-4 py-2 text-sm bg-ztl-anthracite text-white rounded-lg font-medium hover:bg-ztl-anthracite/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :disabled="!pastedXml.trim()"
          @click="doImport"
        >Import</button>
      </div>
    </div>
  </div>
</template>
