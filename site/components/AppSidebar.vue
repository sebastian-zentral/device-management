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

watch(currentPath, (path) => {
  const active = props.nav.find(s => path.startsWith(s.urlPrefix + '/') || path === s.urlPrefix)
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
    <!-- Logo -->
    <div class="px-4 py-5 shrink-0 border-b border-ztl-anthracite/10">
      <NuxtLink to="/" class="block mb-4">
        <svg width="120" height="22" viewBox="0 0 150 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M26.9307 20.4755H23.6909L10.417 7.52441H14.4599L26.9307 20.4755Z" fill="#494F57"/>
          <path d="M27.1795 20.3766L37.2489 10.5486C37.3849 10.4165 37.3849 10.2006 37.2489 10.0679L27.0351 0.0996464C26.9789 0.0447922 26.8685 0 26.7893 0H6.64845C6.18582 0 6.0744 0.260963 6.40167 0.580676L26.6869 20.3766C26.8223 20.5087 27.0434 20.5087 27.1795 20.3766Z" fill="#EA5165"/>
          <path d="M10.172 7.62349L0.101523 17.4512C-0.0338409 17.5833 -0.0338409 17.7991 0.101523 17.9319L10.3156 27.9001C10.3725 27.9549 10.4833 27.9997 10.5624 27.9997H30.703C31.1656 27.9997 31.2764 27.7388 30.9488 27.4191L10.6645 7.62349C10.5292 7.49139 10.307 7.49139 10.172 7.62349Z" fill="#79C6BC"/>
          <path d="M44.9336 9.55405V6.6286H57.9232V9.70628L48.5868 19.8232H58.4228V22.7791H44.3087V19.4577L53.396 9.55405H44.9336Z" fill="#333333"/>
          <path d="M64.1889 13.4847H73.7126C73.7126 12.1247 73.2753 11.0776 72.4005 10.3464C71.5275 9.61508 70.4499 9.24961 69.1695 9.24961C67.889 9.24961 66.7392 9.63066 65.7192 10.3921C64.6985 11.1542 64.1889 12.1858 64.1889 13.4847ZM77.2098 16.1664H64.1889C64.2721 17.3456 64.8238 18.2954 65.8446 19.0159C66.8636 19.7375 68.0297 20.0974 69.3411 20.0974C71.4224 20.0974 73.0052 19.4577 74.0881 18.1779L76.0856 20.311C74.2956 22.1196 71.9642 23.0226 69.0913 23.0226C66.7602 23.0226 64.777 22.2666 63.1429 20.7521C61.5089 19.2392 60.6918 17.208 60.6918 14.6584C60.6918 12.1088 61.5242 10.0828 63.1898 8.5787C64.8554 7.07556 66.8171 6.32318 69.0767 6.32318C71.3363 6.32318 73.255 6.98922 74.8374 8.31936C76.4185 9.65079 77.2101 11.4847 77.2101 13.8197V16.1661L77.2098 16.1664Z" fill="#333333"/>
          <path d="M84.5479 14.0031V22.7794H81.0508V6.56792H84.5479V9.52323C85.1107 8.52871 85.8853 7.74615 86.8744 7.17683C87.8629 6.60816 88.9305 6.32318 90.0749 6.32318C91.948 6.32318 93.463 6.88276 94.6181 7.99964C95.7731 9.11718 96.3512 10.7323 96.3512 12.8447V22.7791H92.854V13.8807C92.854 10.8952 91.5842 9.40183 89.0439 9.40183C87.8363 9.40183 86.7849 9.79328 85.8909 10.5749C84.9946 11.3571 84.5473 12.4996 84.5473 14.0028L84.5479 14.0031Z" fill="#333333"/>
          <path d="M105.312 9.3103V17.5381C105.312 18.31 105.521 18.9244 105.937 19.3817C106.353 19.8384 106.937 20.0672 107.686 20.0672C108.435 20.0672 109.154 19.7118 109.84 19.0007L111.277 21.4078C110.049 22.4851 108.69 23.0229 107.202 23.0229C105.714 23.0229 104.444 22.5204 103.393 21.5146C102.342 20.5093 101.815 19.1532 101.815 17.4466V9.3103H99.724V6.56791H101.815V1.47913H105.312V6.56791H109.684V9.3103H105.312Z" fill="#333333"/>
          <path d="M123.393 9.76794C121.664 9.76794 120.363 10.3155 119.489 11.4129C118.615 12.5097 118.177 13.9836 118.177 15.8311V22.7794H114.68V6.5679H118.177V9.82864C118.739 8.81237 119.505 7.9795 120.473 7.32936C121.441 6.67988 122.465 6.34458 123.548 6.32349L123.579 9.76794H123.392H123.393Z" fill="#333333"/>
          <path d="M136.881 16.7461V15.3741H132.947C130.428 15.3741 129.168 16.1466 129.168 17.6903C129.168 18.4823 129.48 19.087 130.105 19.5035C130.73 19.9199 131.599 20.1283 132.712 20.1283C133.825 20.1283 134.799 19.8228 135.632 19.2139C136.464 18.604 136.88 17.7819 136.88 16.7461H136.881ZM140.379 22.7791H137.193V20.6158C135.819 22.2202 133.977 23.0229 131.666 23.0229C129.939 23.0229 128.507 22.5457 127.373 21.5908C126.238 20.6359 125.672 19.3616 125.672 17.766C125.672 16.1703 126.275 14.9778 127.482 14.1858C128.69 13.3939 130.324 12.9975 132.385 12.9975H136.913V12.3877C136.913 10.2341 135.683 9.15775 133.229 9.15775C131.688 9.15775 130.084 9.70597 128.419 10.8034L126.859 8.67023C128.877 7.1064 131.167 6.32318 133.727 6.32318C135.683 6.32318 137.282 6.80616 138.52 7.77146C139.759 8.73612 140.379 10.2542 140.379 12.327V22.7788L140.379 22.7791Z" fill="#333333"/>
          <path d="M149.059 22.7791H145.562V1.50183H149.059V22.7791Z" fill="#333333"/>
        </svg>
        <p class="text-xs text-ztl-anthracite/40 mt-1">Device Management</p>
      </NuxtLink>

      <!-- Tool links -->
      <div class="flex flex-col gap-1">
        <NuxtLink
          to="/builder"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="route.path === '/builder'
            ? 'bg-ztl-cyan text-ztl-anthracite'
            : 'text-ztl-anthracite/70 hover:bg-ztl-anthracite/8 hover:text-ztl-anthracite'"
        >
          <span class="text-base leading-none">⊞</span> Builder
        </NuxtLink>
        <NuxtLink
          to="/validator"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="route.path === '/validator'
            ? 'bg-ztl-cyan text-ztl-anthracite'
            : 'text-ztl-anthracite/70 hover:bg-ztl-anthracite/8 hover:text-ztl-anthracite'"
        >
          <span class="text-base leading-none">✓</span> Validator
        </NuxtLink>
      </div>
    </div>

    <!-- Search -->
    <div class="px-3 py-3 border-b border-ztl-anthracite/10 shrink-0">
      <div class="relative">
        <svg class="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-ztl-anthracite/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Search schemas…"
          class="w-full pl-8 pr-3 py-1.5 text-sm bg-white rounded-md border border-ztl-anthracite/15 text-ztl-anthracite placeholder:text-ztl-anthracite/35 focus:outline-none focus:ring-2 focus:ring-ztl-cyan"
        >
      </div>
    </div>

    <!-- Nav tree -->
    <div class="flex-1 overflow-y-auto py-2">
      <template v-for="group in GROUPS" :key="group">
        <template v-if="sectionsForGroup(group).length">
          <button
            class="w-full flex items-center justify-between px-4 py-1.5 text-left"
            @click="toggleGroup(group)"
          >
            <span class="text-xs font-bold uppercase tracking-wider text-ztl-anthracite/40">{{ group }}</span>
            <svg
              class="w-3 h-3 text-ztl-anthracite/40 transition-transform"
              :class="expandedGroups.has(group) ? '' : '-rotate-90'"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          <template v-if="expandedGroups.has(group)">
            <div v-for="section in sectionsForGroup(group)" :key="section.id" class="mb-0.5">
              <button
                class="w-full flex items-center justify-between px-4 py-1.5 text-left rounded-md mx-1 hover:bg-ztl-anthracite/8 transition-colors"
                @click="toggleSection(section.id)"
              >
                <span class="text-sm font-medium text-ztl-anthracite/70">{{ section.label }}</span>
                <span class="text-xs text-ztl-anthracite/35 ml-2">{{ section.schemas.length }}</span>
              </button>

              <div v-if="expandedSections.has(section.id)" class="mt-0.5">
                <NuxtLink
                  v-for="schema in section.schemas"
                  :key="schema.slug"
                  :to="schema.url"
                  class="block px-4 py-1 text-sm rounded-md mx-1 truncate transition-colors"
                  :class="isActive(schema.url)
                    ? 'bg-ztl-cyan text-ztl-anthracite font-medium'
                    : 'text-ztl-anthracite/55 hover:bg-ztl-anthracite/8 hover:text-ztl-anthracite'"
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
