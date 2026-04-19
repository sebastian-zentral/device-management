<script setup lang="ts">
interface NavSchema { slug: string; title: string; url: string }
interface NavSection { id: string; label: string; group: string; urlPrefix: string; schemas: NavSchema[] }

const props = defineProps<{ nav: NavSection[] }>()

const route = useRoute()
const search = ref('')
const expandedGroups = ref<Set<string>>(new Set(['MDM Protocol', 'Declarative', 'Other']))
const expandedSections = ref<Set<string>>(new Set())

const GROUPS = ['MDM Protocol', 'Declarative', 'Other']

const currentPath = computed(() => route.path.replace(/^\//, ''))

// Auto-expand the section containing the current page
watch(currentPath, (path) => {
  const nav = props.nav
  const active = nav.find(s => path.startsWith(s.urlPrefix + '/') || path === s.urlPrefix)
  if (active) expandedSections.value.add(active.id)
}, { immediate: true })

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return props.nav
  return props.nav.map(section => ({
    ...section,
    schemas: section.schemas.filter(s =>
      s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q),
    ),
  })).filter(s => s.schemas.length > 0)
})

function sectionsForGroup(group: string) {
  return filtered.value.filter(s => s.group === group)
}

function toggleGroup(group: string) {
  expandedGroups.value.has(group)
    ? expandedGroups.value.delete(group)
    : expandedGroups.value.add(group)
  // Force reactivity
  expandedGroups.value = new Set(expandedGroups.value)
}

function toggleSection(id: string) {
  expandedSections.value.has(id)
    ? expandedSections.value.delete(id)
    : expandedSections.value.add(id)
  expandedSections.value = new Set(expandedSections.value)
}

function isActive(url: string) {
  return route.path === url
}
</script>

<template>
  <nav class="flex flex-col h-full">
    <!-- Logo / title -->
    <div class="px-4 py-4 border-b border-slate-200 shrink-0">
      <NuxtLink to="/" class="block">
        <div class="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Apple</div>
        <div class="text-base font-bold text-slate-900">Device Management</div>
        <div class="text-xs text-slate-500">Schema Reference</div>
      </NuxtLink>
      <NuxtLink
        to="/builder"
        class="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="route.path === '/builder'
          ? 'bg-blue-600 text-white'
          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'"
      >
        <span>🛠</span> Profile Builder
      </NuxtLink>
    </div>

    <!-- Search -->
    <div class="px-3 py-3 border-b border-slate-200 shrink-0">
      <div class="relative">
        <svg class="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Search schemas…"
          class="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
        >
      </div>
    </div>

    <!-- Nav tree -->
    <div class="flex-1 overflow-y-auto py-2">
      <template v-for="group in GROUPS" :key="group">
        <template v-if="sectionsForGroup(group).length">
          <!-- Group header -->
          <button
            class="w-full flex items-center justify-between px-4 py-1.5 text-left"
            @click="toggleGroup(group)"
          >
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">{{ group }}</span>
            <svg
              class="w-3 h-3 text-slate-400 transition-transform"
              :class="expandedGroups.has(group) ? '' : '-rotate-90'"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          <template v-if="expandedGroups.has(group)">
            <div
              v-for="section in sectionsForGroup(group)"
              :key="section.id"
              class="mb-0.5"
            >
              <!-- Section header -->
              <button
                class="w-full flex items-center justify-between px-4 py-1.5 text-left hover:bg-slate-50 rounded-md mx-1"
                @click="toggleSection(section.id)"
              >
                <span class="text-sm font-medium text-slate-700">{{ section.label }}</span>
                <span class="text-xs text-slate-400 ml-2">{{ section.schemas.length }}</span>
              </button>

              <!-- Schema list -->
              <div v-if="expandedSections.has(section.id)" class="mt-0.5">
                <NuxtLink
                  v-for="schema in section.schemas"
                  :key="schema.slug"
                  :to="schema.url"
                  class="block px-4 py-1 text-sm rounded-md mx-1 truncate transition-colors"
                  :class="isActive(schema.url)
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
                >
                  {{ schema.title }}
                </NuxtLink>
              </div>
            </div>
          </template>
        </template>
      </template>
    </div>
  </nav>
</template>
