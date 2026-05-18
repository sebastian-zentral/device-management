<script setup lang="ts">
const { data: nav } = await useAsyncData('nav', () => $fetch('/api/nav'))

const totalSchemas = computed(() =>
  (nav.value ?? []).reduce((sum, s) => sum + s.schemas.length, 0),
)

const GROUPS = ['MDM Protocol', 'Declarative', 'Other']

function sectionsForGroup(group: string) {
  return (nav.value ?? []).filter(s => s.group === group)
}
</script>

<template>
  <div class="max-w-4xl">
    <div class="mb-10">
      <h1 class="text-4xl font-bold text-slate-900 mb-3">Device Management Schema Reference</h1>
      <p class="text-xl text-slate-500">
        Browse Apple's MDM and Declarative Device Management schemas —
        <strong class="text-slate-700">{{ totalSchemas }}</strong> schemas across all platforms.
      </p>
    </div>

    <div
      v-for="group in GROUPS"
      :key="group"
      class="mb-10"
    >
      <h2 class="text-lg font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-200">{{ group }}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NuxtLink
          v-for="section in sectionsForGroup(group)"
          :key="section.id"
          :to="`/${section.urlPrefix}`"
          class="group block p-5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="font-semibold text-slate-800 group-hover:text-blue-700">{{ section.label }}</span>
            <span class="text-sm text-slate-400 group-hover:text-blue-500">{{ section.schemas.length }}</span>
          </div>
          <p class="text-sm text-slate-500">{{ section.schemas.slice(0, 3).map(s => s.title).join(', ') }}…</p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
