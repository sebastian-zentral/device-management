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
    <!-- Hero -->
    <div class="mb-12">
      <h1 class="text-4xl font-bold text-slate-900 mb-3">Apple Device Management</h1>
      <p class="text-xl text-slate-500">
        Build and validate MDM profiles and Declarative Device Management configurations —
        backed by <strong class="text-slate-700">{{ totalSchemas }}</strong> schemas.
      </p>
    </div>

    <!-- Primary tools -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-14">
      <NuxtLink
        to="/builder"
        class="group block p-6 rounded-2xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 transition-colors"
      >
        <div class="flex items-center gap-3 mb-3">
          <span class="text-2xl">🔧</span>
          <span class="text-xl font-bold text-blue-800">Profile Builder</span>
        </div>
        <p class="text-sm text-blue-700">
          Interactively create MDM profiles and DDM declarations. Pick payloads, fill in fields, and download a ready-to-deploy <code class="bg-blue-100 px-1 rounded">.mobileconfig</code> file.
        </p>
        <div class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 group-hover:text-blue-900">
          Open Builder <span class="transition-transform group-hover:translate-x-1">→</span>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/validator"
        class="group block p-6 rounded-2xl border-2 border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100 transition-colors"
      >
        <div class="flex items-center gap-3 mb-3">
          <span class="text-2xl">✅</span>
          <span class="text-xl font-bold text-violet-800">Profile Validator</span>
        </div>
        <p class="text-sm text-violet-700">
          Paste or drop an existing <code class="bg-violet-100 px-1 rounded">.mobileconfig</code> file and check it against the schema library. Catch errors, unknown keys, and type mismatches.
        </p>
        <div class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-violet-700 group-hover:text-violet-900">
          Open Validator <span class="transition-transform group-hover:translate-x-1">→</span>
        </div>
      </NuxtLink>
    </div>

    <!-- Schema reference -->
    <div class="mb-4">
      <h2 class="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-6">Schema Reference</h2>
      <div
        v-for="group in GROUPS"
        :key="group"
        class="mb-8"
      >
        <h3 class="text-base font-semibold text-slate-600 mb-3 pb-2 border-b border-slate-100">{{ group }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NuxtLink
            v-for="section in sectionsForGroup(group)"
            :key="section.id"
            :to="`/${section.urlPrefix}`"
            class="group flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <span class="font-medium text-slate-700 group-hover:text-slate-900">{{ section.label }}</span>
            <span class="text-xs text-slate-400 group-hover:text-slate-500 tabular-nums">{{ section.schemas.length }}</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
