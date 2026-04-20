<script setup lang="ts">
import { parsePlist } from '~/utils/parsePlist'
import { validateProfile, type ProfileValidationResult, type ValidationIssue } from '~/utils/validateProfile'

useHead({ title: 'Profile Validator — Device Management' })

// ── Nav for schema lookup ──────────────────────────────────────────────────────
const { data: navData } = await useAsyncData('nav', () =>
  $fetch<Array<{ id: string; urlPrefix: string; schemas: Array<{ slug: string }> }>>('/api/nav'),
)

const schemaCache = new Map<string, Record<string, any> | null>()

async function fetchSchema(payloadType: string): Promise<Record<string, any> | null> {
  if (schemaCache.has(payloadType)) return schemaCache.get(payloadType)!
  const section = navData.value?.find(s => s.id === 'mdm-profiles')
  const match = section?.schemas.find(s => s.slug === payloadType)
  if (!match) { schemaCache.set(payloadType, null); return null }
  try {
    const schema = await $fetch<Record<string, any>>(`/api/schema/mdm/profiles/${payloadType}`)
    schemaCache.set(payloadType, schema)
    return schema
  } catch {
    schemaCache.set(payloadType, null)
    return null
  }
}

// ── Input state ────────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement>()
const xmlInput  = ref('')
const isDragging = ref(false)
const parseError = ref('')

function readFile(file: File) {
  const reader = new FileReader()
  reader.onload = e => { xmlInput.value = (e.target?.result as string) ?? ''; parseError.value = '' }
  reader.readAsText(file)
}
function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) readFile(file)
}
function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) readFile(file)
}

// ── Validation ─────────────────────────────────────────────────────────────────
const result = ref<ProfileValidationResult | null>(null)
const validating = ref(false)

async function validate() {
  parseError.value = ''
  result.value = null
  validating.value = true
  try {
    const parsed = parsePlist(xmlInput.value)
    result.value = await validateProfile(parsed, fetchSchema)
  } catch (e: any) {
    parseError.value = e.message ?? 'Failed to parse plist'
  } finally {
    validating.value = false
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const SEVERITY_STYLES = {
  error:   { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',    label: 'Error' },
  warning: { dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700', label: 'Warning' },
  info:    { dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700',   label: 'Info' },
}

function payloadStatus(issues: ValidationIssue[]) {
  if (issues.some(i => i.severity === 'error'))   return { icon: '✕', class: 'text-red-600 bg-red-50 border-red-200' }
  if (issues.some(i => i.severity === 'warning')) return { icon: '!', class: 'text-amber-600 bg-amber-50 border-amber-200' }
  return { icon: '✓', class: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
}

function countBySeverity(issues: ValidationIssue[], sev: string) {
  return issues.filter(i => i.severity === sev).length
}
</script>

<template>
  <div class="max-w-3xl">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-slate-900 mb-1">Profile Validator</h1>
      <p class="text-slate-500 text-sm">
        Validate a <code class="font-mono bg-slate-100 px-1 rounded">.mobileconfig</code> against the Apple schema —
        checks required keys, types, and allowed values.
      </p>
    </div>

    <!-- Input area -->
    <div class="space-y-4 mb-6">
      <!-- Drop zone -->
      <div
        class="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
        :class="isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-300 hover:bg-slate-50'"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
        @click="fileInput?.click()"
      >
        <input ref="fileInput" type="file" accept=".mobileconfig,.plist,.xml" class="hidden" @change="onFileChange">
        <div class="text-3xl mb-2">📋</div>
        <p class="text-sm font-medium text-slate-600">
          Drop a <code class="font-mono bg-slate-100 px-1 rounded">.mobileconfig</code> file here or click to browse
        </p>
      </div>

      <!-- Paste -->
      <div>
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Or paste XML</p>
        <textarea
          v-model="xmlInput"
          rows="8"
          spellcheck="false"
          placeholder="<?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?>&#10;<!DOCTYPE plist …>"
          class="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y placeholder:text-slate-300"
        />
      </div>

      <div class="flex items-center gap-3">
        <button
          class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          :disabled="!xmlInput.trim() || validating"
          @click="validate"
        >
          <span v-if="validating">Validating…</span>
          <span v-else>Validate</span>
        </button>
        <button
          v-if="xmlInput || result"
          class="text-sm text-slate-500 hover:text-slate-700"
          @click="xmlInput = ''; result = null; parseError = ''"
        >Clear</button>
      </div>

      <p v-if="parseError" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
        <strong>Parse error:</strong> {{ parseError }}
      </p>
    </div>

    <!-- Results -->
    <div v-if="result" class="space-y-4">
      <!-- Summary banner -->
      <div
        class="flex items-center gap-4 px-5 py-4 rounded-xl border font-medium"
        :class="result.errorCount > 0
          ? 'bg-red-50 border-red-200 text-red-800'
          : result.warningCount > 0
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'"
      >
        <span class="text-2xl">
          {{ result.errorCount > 0 ? '✕' : result.warningCount > 0 ? '!' : '✓' }}
        </span>
        <div>
          <div v-if="result.errorCount === 0 && result.warningCount === 0">
            Profile is valid — no issues found across {{ result.payloads.length }} payload(s).
          </div>
          <div v-else>
            Found
            <strong v-if="result.errorCount">{{ result.errorCount }} error{{ result.errorCount !== 1 ? 's' : '' }}</strong>
            <span v-if="result.errorCount && result.warningCount"> and </span>
            <strong v-if="result.warningCount">{{ result.warningCount }} warning{{ result.warningCount !== 1 ? 's' : '' }}</strong>
            across {{ result.payloads.length }} payload(s).
          </div>
        </div>
      </div>

      <!-- Profile-level issues -->
      <div v-if="result.profileIssues.length" class="rounded-xl border border-slate-200 overflow-hidden">
        <div class="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span
            class="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0"
            :class="payloadStatus(result.profileIssues).class"
          >{{ payloadStatus(result.profileIssues).icon }}</span>
          <span class="font-semibold text-slate-800 text-sm">Profile Structure</span>
          <span class="ml-auto text-xs text-slate-400">
            {{ countBySeverity(result.profileIssues, 'error') }} errors,
            {{ countBySeverity(result.profileIssues, 'warning') }} warnings
          </span>
        </div>
        <IssueList :issues="result.profileIssues" />
      </div>

      <!-- Per-payload results -->
      <div
        v-for="payload in result.payloads"
        :key="payload.index"
        class="rounded-xl border border-slate-200 overflow-hidden"
      >
        <div class="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span
            class="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0"
            :class="payloadStatus(payload.issues).class"
          >{{ payloadStatus(payload.issues).icon }}</span>
          <div class="min-w-0 flex-1">
            <span class="font-semibold text-slate-800 text-sm">{{ payload.schemaTitle }}</span>
            <code class="ml-2 font-mono text-xs text-slate-400">{{ payload.payloadType }}</code>
            <span v-if="!payload.schemaFound" class="ml-2 text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">schema not found</span>
          </div>
          <span class="ml-auto text-xs text-slate-400 shrink-0">
            {{ countBySeverity(payload.issues, 'error') }} errors,
            {{ countBySeverity(payload.issues, 'warning') }} warnings
          </span>
        </div>
        <IssueList v-if="payload.issues.length" :issues="payload.issues" />
        <div v-else class="px-4 py-3 text-sm text-emerald-600">No issues found.</div>
      </div>
    </div>
  </div>
</template>
