<script setup lang="ts">
const props = defineProps<{
  keyData: Record<string, any>
  depth?: number
}>()

const depth = computed(() => props.depth ?? 0)
const expanded = ref(true)
const hasSubkeys = computed(() => props.keyData.subkeys?.length > 0)

const TYPE_COLORS: Record<string, string> = {
  '<string>':     'bg-blue-100 text-blue-700',
  '<integer>':    'bg-amber-100 text-amber-700',
  '<boolean>':    'bg-emerald-100 text-emerald-700',
  '<array>':      'bg-purple-100 text-purple-700',
  '<dictionary>': 'bg-indigo-100 text-indigo-700',
  '<data>':       'bg-yellow-100 text-yellow-700',
  '<date>':       'bg-teal-100 text-teal-700',
  '<real>':       'bg-orange-100 text-orange-700',
  '<any>':        'bg-slate-100 text-slate-600',
}

function typeColor(t: string) {
  return TYPE_COLORS[t] ?? 'bg-slate-100 text-slate-600'
}
</script>

<template>
  <div
    class="group"
    :class="[depth > 0 ? 'ml-5 pl-4 border-l border-slate-200' : '']"
  >
    <!-- Key header row -->
    <div
      class="flex items-start gap-2 py-2.5 cursor-pointer select-none"
      @click="hasSubkeys && (expanded = !expanded)"
    >
      <!-- Expand toggle -->
      <span
        v-if="hasSubkeys"
        class="mt-0.5 text-slate-400 transition-transform shrink-0"
        :class="expanded ? 'rotate-90' : ''"
      >▶</span>
      <span v-else class="w-[1em] shrink-0" />

      <!-- Key name -->
      <code class="font-mono font-semibold text-slate-800 text-sm leading-snug shrink-0">
        {{ keyData.key }}
      </code>
      <span v-if="keyData.title" class="text-slate-500 text-sm">— {{ keyData.title }}</span>

      <!-- Badges -->
      <div class="flex items-center gap-1.5 flex-wrap ml-auto shrink-0">
        <span
          v-if="keyData.type"
          class="font-mono text-xs px-1.5 py-0.5 rounded"
          :class="typeColor(keyData.type)"
        >{{ keyData.type }}</span>
        <span
          v-if="keyData.presence"
          class="text-xs px-1.5 py-0.5 rounded"
          :class="keyData.presence === 'required'
            ? 'bg-red-100 text-red-700'
            : 'bg-slate-100 text-slate-500'"
        >{{ keyData.presence }}</span>
      </div>
    </div>

    <!-- Key details -->
    <div class="pl-6 pb-2 space-y-1.5 text-sm">
      <div v-if="keyData.content">
        <MdContent :text="keyData.content" />
      </div>
      <div v-if="keyData.default !== undefined" class="text-slate-600">
        <span class="font-medium text-slate-500">Default:</span>
        <code class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ keyData.default }}</code>
      </div>
      <div v-if="keyData.rangelist?.length" class="text-slate-600">
        <span class="font-medium text-slate-500">Values:</span>
        <code
          v-for="v in keyData.rangelist"
          :key="v"
          class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded"
        >{{ v }}</code>
      </div>
      <div v-if="keyData.format" class="text-slate-600">
        <span class="font-medium text-slate-500">Format:</span>
        <code class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ keyData.format }}</code>
      </div>
    </div>

    <!-- Subkeys (recursive) -->
    <div v-if="hasSubkeys && expanded" class="pb-1">
      <PayloadKeyNode
        v-for="sub in keyData.subkeys"
        :key="sub.key"
        :keyData="sub"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>
