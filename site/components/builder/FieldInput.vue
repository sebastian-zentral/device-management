<script setup lang="ts">
import { defaultValue } from '~/utils/formInit'
import { checkCompatibility, type PlatformContext } from '~/utils/platformCompat'

const props = defineProps<{
  keyData: Record<string, any>
  platformContext?: PlatformContext
}>()
const model = defineModel<any>()

const isRequired = computed(() => props.keyData.presence === 'required')
const isEnabled = ref(isRequired.value || model.value !== undefined)

if (isRequired.value && model.value === undefined) {
  model.value = defaultValue(props.keyData)
}

watch(isEnabled, (enabled) => {
  if (!enabled) model.value = undefined
  else if (model.value === undefined) model.value = defaultValue(props.keyData)
})

// ── Platform compatibility ─────────────────────────────────────────────────────
const compatibility = computed(() =>
  checkCompatibility(props.keyData, props.platformContext, isRequired.value),
)

// ── Array helpers ─────────────────────────────────────────────────────────────
const arraySubkey = computed(() => props.keyData.subkeys?.[0] as Record<string, any> | undefined)

const arrayItemIsDictWithFields = computed(() => {
  const sub = arraySubkey.value
  return sub?.type === '<dictionary>'
    && (sub.subkeys?.filter((s: any) => s.key !== 'ANY') ?? []).length > 0
})

function ensureArray() {
  if (!Array.isArray(model.value)) model.value = []
}

function addArrayItem() {
  ensureArray()
  const sub = arraySubkey.value
  model.value = [...model.value, sub ? defaultValue(sub) : '']
}

function removeArrayItem(i: number) {
  model.value = model.value.filter((_: any, idx: number) => idx !== i)
}

function updateArrayItem(i: number, val: any) {
  const arr = [...model.value]; arr[i] = val; model.value = arr
}

function updateArrayDictItem(i: number, key: string, val: any) {
  const arr = [...model.value]
  const item = { ...(arr[i] ?? {}) }
  if (val === undefined) delete item[key]; else item[key] = val
  arr[i] = item; model.value = arr
}

// ── Dictionary helpers ─────────────────────────────────────────────────────────
const namedSubkeys = computed(() =>
  (props.keyData.subkeys ?? []).filter((s: any) => s.key !== 'ANY'),
)
const isDictWithFields = computed(() => namedSubkeys.value.length > 0)

function getSubValue(key: string) {
  return typeof model.value === 'object' && model.value !== null && !Array.isArray(model.value)
    ? model.value[key] : undefined
}

function setSubValue(key: string, val: any) {
  const current = typeof model.value === 'object' && model.value !== null && !Array.isArray(model.value)
    ? model.value : {}
  const updated = { ...current }
  if (val === undefined) delete updated[key]; else updated[key] = val
  model.value = updated
}

// ── Type badge color ───────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  '<string>':     'bg-ztl-cyan/20 text-ztl-anthracite',
  '<integer>':    'bg-amber-100 text-amber-700',
  '<boolean>':    'bg-emerald-100 text-emerald-700',
  '<array>':      'bg-purple-100 text-purple-700',
  '<dictionary>': 'bg-indigo-100 text-indigo-700',
  '<real>':       'bg-orange-100 text-orange-700',
  '<data>':       'bg-yellow-100 text-yellow-700',
}
function typeColor(t: string) { return TYPE_COLORS[t] ?? 'bg-slate-100 text-slate-600' }

const hint = computed(() => {
  const c = props.keyData.content as string | undefined
  if (!c) return ''
  return c.split('\n')[0].replace(/`([^`]+)`/g, '$1')
})
</script>

<template>
  <!-- Hidden: unavailable on all selected platforms -->
  <div v-if="compatibility.hidden" class="py-1.5 flex items-center gap-2 opacity-40">
    <span class="w-4 shrink-0" />
    <code class="font-mono text-sm text-slate-500 line-through">{{ keyData.key }}</code>
    <span class="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Not on selected platforms</span>
  </div>

  <div v-else class="py-2.5">
    <!-- Row: toggle + label + type badge + warnings -->
    <div class="flex items-center gap-2 flex-wrap">
      <input
        v-if="!isRequired"
        :id="`field-${keyData.key}`"
        type="checkbox"
        v-model="isEnabled"
        class="h-4 w-4 rounded border-slate-300 text-ztl-cyan focus:ring-ztl-cyan shrink-0"
      >
      <span v-else class="w-4 shrink-0" />

      <label :for="`field-${keyData.key}`" class="flex items-center gap-1.5 cursor-pointer select-none min-w-0">
        <code class="font-mono font-semibold text-sm text-ztl-anthracite shrink-0">{{ keyData.key }}</code>
        <span v-if="keyData.title" class="text-slate-400 text-sm truncate">— {{ keyData.title }}</span>
      </label>

      <span class="font-mono text-xs px-1.5 py-0.5 rounded shrink-0" :class="typeColor(keyData.type)">
        {{ keyData.type }}
      </span>
      <span v-if="isRequired" class="text-xs px-1.5 py-0.5 rounded bg-ztl-red/15 text-ztl-red shrink-0">required</span>
      <span
        v-for="w in compatibility.warnings"
        :key="w"
        class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0"
      >{{ w }}</span>
    </div>

    <p v-if="isEnabled && hint" class="text-xs text-slate-400 mt-1 ml-6 leading-relaxed">{{ hint }}</p>

    <div v-if="isEnabled" class="mt-2 ml-6">
      <!-- Boolean -->
      <label v-if="keyData.type === '<boolean>'" class="inline-flex items-center gap-2 cursor-pointer">
        <div
          class="relative w-10 h-5 rounded-full transition-colors"
          :class="model ? 'bg-ztl-cyan' : 'bg-slate-300'"
          @click="model = !model"
        >
          <div
            class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
            :class="model ? 'translate-x-5' : ''"
          />
        </div>
        <span class="text-sm text-ztl-anthracite">{{ model ? 'true' : 'false' }}</span>
      </label>

      <!-- Select (rangelist) -->
      <select
        v-else-if="keyData.rangelist?.length"
        v-model="model"
        class="w-full max-w-sm px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ztl-cyan"
      >
        <option v-for="v in keyData.rangelist" :key="String(v)" :value="v">{{ v }}</option>
      </select>

      <!-- Integer / Real -->
      <input
        v-else-if="keyData.type === '<integer>' || keyData.type === '<real>'"
        type="number"
        :step="keyData.type === '<real>' ? 'any' : '1'"
        v-model.number="model"
        class="w-full max-w-sm px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ztl-cyan"
      >

      <!-- String -->
      <input
        v-else-if="keyData.type === '<string>'"
        type="text"
        v-model="model"
        :placeholder="keyData.key"
        class="w-full max-w-sm px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ztl-cyan"
      >

      <!-- Array -->
      <div v-else-if="keyData.type === '<array>'" class="space-y-1.5">
        <div v-for="(item, i) in (Array.isArray(model) ? model : [])" :key="i" class="flex items-start gap-2">
          <div v-if="arrayItemIsDictWithFields" class="flex-1 border border-slate-200 rounded-lg p-3 bg-slate-50">
            <BuilderFieldInput
              v-for="sub in (arraySubkey?.subkeys ?? []).filter((s: any) => s.key !== 'ANY')"
              :key="sub.key"
              :keyData="sub"
              :platformContext="platformContext"
              :model-value="item?.[sub.key]"
              @update:model-value="(v) => updateArrayDictItem(i, sub.key, v)"
            />
          </div>
          <input
            v-else-if="arraySubkey?.type === '<boolean>'"
            type="checkbox"
            :checked="item"
            class="mt-1.5"
            @change="updateArrayItem(i, ($event.target as HTMLInputElement).checked)"
          >
          <input
            v-else-if="arraySubkey?.type === '<integer>'"
            type="number"
            :value="item"
            class="flex-1 max-w-xs px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ztl-cyan"
            @input="updateArrayItem(i, Number(($event.target as HTMLInputElement).value))"
          >
          <input
            v-else
            type="text"
            :value="item"
            :placeholder="`Item ${i + 1}`"
            class="flex-1 max-w-sm px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ztl-cyan"
            @input="updateArrayItem(i, ($event.target as HTMLInputElement).value)"
          >
          <button
            class="mt-1 text-slate-400 hover:text-ztl-red text-xs font-medium shrink-0"
            @click="removeArrayItem(i)"
          >✕</button>
        </div>
        <button class="text-sm text-ztl-cyan hover:text-ztl-anthracite font-medium" @click="addArrayItem">+ Add item</button>
      </div>

      <!-- Dictionary with named subkeys -->
      <div
        v-else-if="keyData.type === '<dictionary>' && isDictWithFields"
        class="border border-slate-200 rounded-lg p-3 bg-slate-50 divide-y divide-slate-100"
      >
        <BuilderFieldInput
          v-for="sub in namedSubkeys"
          :key="sub.key"
          :keyData="sub"
          :platformContext="platformContext"
          :model-value="getSubValue(sub.key)"
          @update:model-value="setSubValue(sub.key, $event)"
        />
      </div>

      <!-- Fallback -->
      <textarea
        v-else
        v-model="model"
        rows="3"
        :placeholder="keyData.type === '<data>' ? 'Base64-encoded data' : 'Raw value'"
        class="w-full max-w-sm px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ztl-cyan resize-y"
      />
    </div>
  </div>
</template>

<style>
.builder-input {
  @apply w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ztl-cyan;
}
</style>
