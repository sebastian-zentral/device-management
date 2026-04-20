<script setup lang="ts">
const PLATFORMS = ['iOS', 'macOS', 'tvOS', 'visionOS', 'watchOS'] as const

const props = defineProps<{
  platforms: string[]
  supervised: boolean
  enrollment: string
}>()

const emit = defineEmits<{
  'update:platforms': [value: string[]]
  'update:supervised': [value: boolean]
  'update:enrollment': [value: string]
}>()

function togglePlatform(p: string) {
  const set = new Set(props.platforms)
  if (set.has(p)) {
    if (set.size > 1) { set.delete(p); emit('update:platforms', [...set]) }
  } else {
    set.add(p); emit('update:platforms', [...set])
  }
}
</script>

<template>
  <div class="flex items-center gap-x-4 gap-y-2 flex-wrap px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm">
    <!-- Platform toggles -->
    <div class="flex items-center gap-1">
      <span class="text-xs font-semibold text-ztl-anthracite/50 uppercase tracking-wide mr-1">Target</span>
      <button
        v-for="p in PLATFORMS"
        :key="p"
        class="px-2.5 py-1 rounded-md font-medium text-xs transition-colors border"
        :class="platforms.includes(p)
          ? 'bg-ztl-anthracite text-white border-ztl-anthracite'
          : 'bg-white text-slate-500 border-slate-200 hover:border-ztl-cyan hover:text-ztl-anthracite'"
        @click="togglePlatform(p)"
      >{{ p }}</button>
    </div>

    <div class="w-px h-4 bg-slate-200 hidden sm:block" />

    <!-- Supervised toggle -->
    <button
      class="flex items-center gap-1.5 select-none"
      @click="emit('update:supervised', !supervised)"
    >
      <div
        class="relative w-8 h-4 rounded-full transition-colors"
        :class="supervised ? 'bg-ztl-cyan' : 'bg-slate-200'"
      >
        <div
          class="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform"
          :class="supervised ? 'translate-x-4' : ''"
        />
      </div>
      <span class="text-xs font-medium text-ztl-anthracite">Supervised</span>
    </button>

    <div class="w-px h-4 bg-slate-200 hidden sm:block" />

    <!-- Enrollment segmented control -->
    <div class="flex items-center gap-1.5">
      <span class="text-xs font-semibold text-ztl-anthracite/50 uppercase tracking-wide">Enrollment</span>
      <div class="flex gap-0.5 p-0.5 bg-slate-100 rounded-lg">
        <button
          v-for="[val, label] in [['mdm', 'MDM'], ['user', 'User'], ['dep', 'DEP/ADE']]"
          :key="val"
          class="px-2.5 py-0.5 rounded text-xs font-medium transition-colors"
          :class="enrollment === val
            ? 'bg-white text-ztl-navy shadow-sm'
            : 'text-slate-500 hover:text-ztl-anthracite'"
          @click="emit('update:enrollment', val)"
        >{{ label }}</button>
      </div>
    </div>
  </div>
</template>
