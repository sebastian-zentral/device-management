<script setup lang="ts">
import { SECTIONS } from '~/utils/sections'

const route = useRoute()

const platformContext = reactive({
  platforms: ['iOS', 'macOS'] as string[],
  supervised: false,
  enrollment: 'mdm',
})

const urlPath = computed(() =>
  Array.isArray(route.params.slug)
    ? route.params.slug.join('/')
    : route.params.slug ?? '',
)

const matchedSection = computed(() =>
  SECTIONS.find(s => s.urlPrefix === urlPath.value),
)
const isCategory = computed(() => !!matchedSection.value)

const { data: nav } = await useAsyncData('nav', () => $fetch(apiUrl('/api/nav')))

const { data: schema, error } = await useAsyncData(
  `schema-${urlPath.value}`,
  async () => {
    if (isCategory.value) return null
    return $fetch(apiUrl(`/api/schema/${urlPath.value}`))
  },
  { watch: [urlPath] },
)

interface NavSchema {
  slug: string
  title: string
  url: string
  platforms: string[]
  constraints: Record<string, { supervised: boolean; requiresdep: boolean; forbidsUserEnrollment: boolean }>
}

const categorySchemas = computed(() => {
  if (!isCategory.value) return []
  const section = nav.value?.find((s: any) => s.urlPrefix === urlPath.value)
  return (section?.schemas ?? []) as NavSchema[]
})

function schemaMatchesContext(s: NavSchema): boolean {
  if (s.platforms.length === 0) return true
  return s.platforms.some(p => {
    if (!platformContext.platforms.includes(p)) return false
    const c = s.constraints[p]
    if (!c) return true
    if (!platformContext.supervised && c.supervised) return false
    if (platformContext.enrollment === 'user' && c.forbidsUserEnrollment) return false
    if (platformContext.enrollment !== 'dep' && c.requiresdep) return false
    return true
  })
}

const filteredSchemas = computed(() => categorySchemas.value.filter(schemaMatchesContext))

// Schema-level platform support (for detail view banner)
const unsupportedPlatforms = computed(() => {
  const s = schema.value as any
  if (!s?.payload?.supportedOS) return []
  return platformContext.platforms.filter(p => {
    const osData = s.payload.supportedOS[p]
    return osData && osData.introduced === 'n/a'
  })
})

const categoryTitle = computed(() => matchedSection.value?.label ?? '')

useHead({
  title: computed(() =>
    isCategory.value
      ? `${categoryTitle.value} — Device Management`
      : schema.value
        ? `${(schema.value as any).title} — Device Management`
        : 'Device Management',
  ),
})
</script>

<template>
  <div>
    <!-- 404 -->
    <div v-if="error && !isCategory" class="text-center py-20">
      <p class="text-6xl mb-4">🔍</p>
      <h1 class="text-2xl font-bold text-slate-700 mb-2">Schema not found</h1>
      <p class="text-slate-500 mb-6 font-mono text-sm">{{ urlPath }}</p>
      <NuxtLink to="/" class="text-blue-600 hover:underline">← Back to home</NuxtLink>
    </div>

    <!-- Category index -->
    <div v-else-if="isCategory">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-ztl-anthracite mb-4">{{ categoryTitle }}</h1>
        <BuilderPlatformBar
          v-model:platforms="platformContext.platforms"
          v-model:supervised="platformContext.supervised"
          v-model:enrollment="platformContext.enrollment"
        />
      </div>

      <p class="text-slate-500 text-sm mb-4">
        {{ filteredSchemas.length }}
        <span v-if="filteredSchemas.length !== categorySchemas.length"> of {{ categorySchemas.length }}</span>
        schemas
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <NuxtLink
          v-for="s in filteredSchemas"
          :key="s.slug"
          :to="s.url"
          class="block p-4 rounded-lg border border-slate-200 bg-white hover:border-ztl-cyan hover:bg-ztl-cyan/5 transition-colors"
        >
          <p class="font-medium text-ztl-anthracite text-sm leading-snug">{{ s.title }}</p>
          <p class="font-mono text-xs text-slate-400 mt-1 truncate">{{ s.slug }}</p>
          <div v-if="s.platforms.length" class="flex gap-1 mt-2 flex-wrap">
            <span
              v-for="p in s.platforms"
              :key="p"
              class="text-xs px-1.5 py-0.5 rounded"
              :class="platformContext.platforms.includes(p)
                ? 'bg-ztl-cyan/20 text-ztl-anthracite font-medium'
                : 'bg-slate-100 text-slate-400'"
            >{{ p }}</span>
          </div>
        </NuxtLink>
      </div>

      <p v-if="filteredSchemas.length === 0" class="text-center py-16 text-slate-400 text-sm">
        No schemas support the selected platforms.
      </p>
    </div>

    <!-- Schema detail -->
    <div v-else-if="schema">
      <div class="flex items-center justify-between mb-4 gap-4">
        <BuilderPlatformBar
          v-model:platforms="platformContext.platforms"
          v-model:supervised="platformContext.supervised"
          v-model:enrollment="platformContext.enrollment"
          class="flex-1"
        />
        <NuxtLink
          :to="`/builder?schema=${urlPath}`"
          class="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-ztl-anthracite text-white rounded-lg text-sm font-medium hover:bg-ztl-anthracite/90 transition-colors"
        >🛠 Open in Builder</NuxtLink>
      </div>

      <!-- Schema not available on selected platform(s) -->
      <div
        v-if="unsupportedPlatforms.length"
        class="mb-6 px-4 py-3 rounded-xl bg-ztl-red/10 border border-ztl-red/20 text-sm text-ztl-red"
      >
        This schema is not available on
        <strong>{{ unsupportedPlatforms.join(', ') }}</strong>.
      </div>

      <SchemaView :schema="schema as any" :urlPath="urlPath" :platformContext="platformContext" />
    </div>

    <!-- Loading -->
    <div v-else class="py-20 text-center text-slate-400">Loading…</div>
  </div>
</template>
