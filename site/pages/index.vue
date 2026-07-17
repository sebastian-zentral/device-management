<script setup lang="ts">
const { data: nav } = await useNav()

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
      <h1 class="text-4xl font-bold text-ztl-anthracite mb-3">Apple Device Management</h1>
      <p class="text-xl text-ztl-anthracite/70">
        Build and validate MDM profiles and Declarative Device Management configurations —
        backed by <strong class="text-ztl-anthracite">{{ totalSchemas }}</strong> schemas.
      </p>
      <p class="text-xl text-ztl-anthracite/70">Schema data mirrors Apple's open-source
        <a
          href="https://github.com/apple/device-management"
          target="_blank"
          rel="noopener noreferrer"
          class="text-black font-medium hover:underline inline-flex items-center gap-1"
        >
          <Icon name="lucide:github" class="w-4 h-4" />apple/device-management<Icon name="lucide:external-link" class="w-3 h-3" />
        </a>
        repository. </p>
    </div>

    <!-- Primary tools -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-14">
      <NuxtLink
        to="/builder"
        class="group block p-6 rounded-2xl bg-ztl-anthracite hover:bg-ztl-anthracite/90 transition-colors"
      >
        <div class="flex items-center gap-3 mb-3">
          <span class="w-9 h-9 rounded-lg bg-ztl-cyan/20 flex items-center justify-center text-ztl-cyan"><Icon name="lucide:blocks" class="w-5 h-5" /></span>
          <span class="text-xl font-bold text-white">Builder</span>
        </div>
        <p class="text-sm text-white/60 mb-4">
          Interactively create MDM profiles, DDM declarations, and MDM commands. Pick a type, fill in fields, and download a ready-to-deploy
          <code class="bg-white/10 px-1 rounded text-white/80">.mobileconfig</code> or <code class="bg-white/10 px-1 rounded text-white/80">.plist</code> file.
        </p>
        <div class="inline-flex items-center gap-1 text-sm font-semibold text-ztl-cyan group-hover:gap-2 transition-all">
          Open Builder <Icon name="lucide:arrow-right" class="w-4 h-4" />
        </div>
      </NuxtLink>

      <NuxtLink
        to="/validator"
        class="group block p-6 rounded-2xl border-2 border-ztl-cyan bg-ztl-cyan/5 hover:bg-ztl-cyan/10 transition-colors"
      >
        <div class="flex items-center gap-3 mb-3">
          <span class="w-9 h-9 rounded-lg bg-ztl-cyan/20 flex items-center justify-center text-ztl-anthracite"><Icon name="lucide:circle-check" class="w-5 h-5" /></span>
          <span class="text-xl font-bold text-ztl-anthracite">Profile Validator</span>
        </div>
        <p class="text-sm text-ztl-anthracite/70 mb-4">
          Paste or drop an existing <code class="bg-ztl-navy/10 px-1 rounded">.mobileconfig</code> file and check it against the schema library. Catch errors, unknown keys, and type mismatches.
        </p>
        <div class="inline-flex items-center gap-1 text-sm font-semibold text-ztl-anthracite group-hover:gap-2 transition-all">
          Open Validator <Icon name="lucide:arrow-right" class="w-4 h-4" />
        </div>
      </NuxtLink>
    </div>

    <!-- Schema reference -->
    <div>
      <h2 class="text-xs font-bold uppercase tracking-widest text-ztl-anthracite/40 mb-6">Schema Reference</h2>
      <div v-for="group in GROUPS" :key="group" class="mb-8">
        <h3 class="text-sm font-semibold text-ztl-anthracite mb-3 pb-2 border-b border-slate-200">{{ group }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <NuxtLink
            v-for="section in sectionsForGroup(group)"
            :key="section.id"
            :to="`/${section.urlPrefix}`"
            class="group flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-ztl-cyan hover:bg-ztl-cyan/5 transition-colors"
          >
            <span class="font-medium text-ztl-anthracite group-hover:text-ztl-anthracite text-sm">{{ section.label }}</span>
            <span class="text-xs text-slate-400 tabular-nums">{{ section.schemas.length }}</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Source attribution -->
    <footer class="mt-14 pt-6 border-t border-slate-200 text-sm text-ztl-anthracite/60">
      <p>
        All schema content is © Apple; this tool only renders it.
      </p>
    </footer>
  </div>
</template>
