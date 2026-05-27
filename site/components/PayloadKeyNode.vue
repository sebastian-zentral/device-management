<script setup lang="ts">
import { checkCompatibility, type PlatformContext } from '~/utils/platformCompat'

const props = defineProps<{
  keyData: Record<string, any>
  depth?: number
  platformContext?: PlatformContext
}>()

const depth = computed(() => props.depth ?? 0)
const expanded = ref(true)
const hasSubkeys = computed(() => props.keyData.subkeys?.length > 0)

const compatibility = computed(() =>
  checkCompatibility(props.keyData, props.platformContext, props.keyData.presence === 'required'),
)

const TYPE_COLORS: Record<string, string> = {
  '<string>':     'bg-ztl-cyan/20 text-ztl-anthracite',
  '<integer>':    'bg-amber-100 text-amber-700',
  '<boolean>':    'bg-emerald-100 text-emerald-700',
  '<array>':      'bg-purple-100 text-purple-700',
  '<dictionary>': 'bg-indigo-100 text-indigo-700',
  '<data>':       'bg-yellow-100 text-yellow-700',
  '<date>':       'bg-teal-100 text-teal-700',
  '<real>':       'bg-orange-100 text-orange-700',
  '<any>':        'bg-slate-100 text-slate-600',
}

function typeColor(t: string) { return TYPE_COLORS[t] ?? 'bg-slate-100 text-slate-600' }
</script>

<template>
  <!-- Hidden: unavailable on all selected platforms -->
  <div
    v-if="compatibility.hidden"
    class="flex items-center gap-2 py-1.5 opacity-35"
    :class="depth > 0 ? 'ml-5 pl-4 border-l border-slate-200' : ''"
  >
    <span class="w-[1em] shrink-0" />
    <code class="font-mono text-sm text-slate-400 line-through">{{ keyData.key }}</code>
    <span class="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">Not on selected platforms</span>
  </div>

  <div
    v-else
    class="group"
    :class="depth > 0 ? 'ml-5 pl-4 border-l border-slate-200' : ''"
  >
    <!-- Key header row -->
    <div
      class="flex items-start gap-2 py-2.5 cursor-pointer select-none"
      @click="hasSubkeys && (expanded = !expanded)"
    >
      <span
        v-if="hasSubkeys"
        class="mt-0.5 text-slate-400 transition-transform shrink-0"
        :class="expanded ? 'rotate-90' : ''"
      >▶</span>
      <span v-else class="w-[1em] shrink-0" />

      <code class="font-mono font-semibold text-ztl-anthracite text-sm leading-snug shrink-0">{{ keyData.key }}</code>
      <span v-if="keyData.title" class="text-slate-500 text-sm">— {{ keyData.title }}</span>

      <!-- Badges -->
      <div class="flex items-center gap-1.5 flex-wrap ml-auto shrink-0">
        <span
          v-for="w in compatibility.warnings"
          :key="w"
          class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
        >{{ w }}</span>
        <span
          v-if="keyData.type"
          class="font-mono text-xs px-1.5 py-0.5 rounded"
          :class="typeColor(keyData.type)"
        >{{ keyData.type }}</span>
        <span
          v-if="keyData.presence"
          class="text-xs px-1.5 py-0.5 rounded"
          :class="keyData.presence === 'required'
            ? 'bg-ztl-red/15 text-ztl-red'
            : 'bg-slate-100 text-slate-500'"
        >{{ keyData.presence }}</span>
      </div>
    </div>

    <!-- Key details -->
    <div class="pl-6 pb-2 space-y-1.5 text-sm">
      <div v-if="keyData.content"><MdContent :text="keyData.content" /></div>
      <div v-if="keyData.default !== undefined" class="text-slate-600">
        <span class="font-medium text-slate-500">Default:</span>
        <code class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ keyData.default }}</code>
      </div>
      <div v-if="keyData.rangelist?.length" class="text-slate-600">
        <span class="font-medium text-slate-500">Values:</span>
        <code v-for="v in keyData.rangelist" :key="v" class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ v }}</code>
      </div>
      <div v-if="keyData.format" class="text-slate-600">
        <span class="font-medium text-slate-500">Format:</span>
        <code class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ keyData.format }}</code>
      </div>
      <div v-if="keyData.valuetype" class="text-slate-600">
        <span class="font-medium text-slate-500">Value type:</span>
        <code class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ keyData.valuetype }}</code>
      </div>
      <div v-if="keyData.subtype" class="text-slate-600">
        <span class="font-medium text-slate-500">Subtype:</span>
        <code class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ keyData.subtype }}</code>
        <span class="ml-1 text-xs text-amber-700">(deprecated — use valuetype)</span>
      </div>
      <div v-if="keyData.range" class="text-slate-600">
        <span class="font-medium text-slate-500">Range:</span>
        <code class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ keyData.range.min }} … {{ keyData.range.max }}</code>
      </div>
      <div v-if="keyData.repetition" class="text-slate-600">
        <span class="font-medium text-slate-500">Repetition:</span>
        <code class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ keyData.repetition.min }} … {{ keyData.repetition.max }}</code>
      </div>
      <div v-if="keyData.combinetype" class="text-slate-600">
        <span class="font-medium text-slate-500">Combine type:</span>
        <code class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ keyData.combinetype }}</code>
      </div>
      <div v-if="keyData.assettypes?.length" class="text-slate-600">
        <span class="font-medium text-slate-500">Asset types:</span>
        <code v-for="a in keyData.assettypes" :key="a" class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ a }}</code>
      </div>
    </div>

    <!-- Subkeys (recursive) -->
    <div v-if="hasSubkeys && expanded" class="pb-1">
      <PayloadKeyNode
        v-for="sub in keyData.subkeys"
        :key="sub.key"
        :keyData="sub"
        :depth="depth + 1"
        :platformContext="platformContext"
      />
    </div>
  </div>
</template>
