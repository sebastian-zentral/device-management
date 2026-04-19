<script setup lang="ts">
import { SECTIONS } from '~/utils/sections'

const route = useRoute()

const urlPath = computed(() =>
  Array.isArray(route.params.slug)
    ? route.params.slug.join('/')
    : route.params.slug ?? '',
)

// Determine if this is a category index page or a schema detail page
const matchedSection = computed(() =>
  SECTIONS.find(s => s.urlPrefix === urlPath.value),
)
const isCategory = computed(() => !!matchedSection.value)

// Fetch nav for category page
const { data: nav } = await useAsyncData('nav', () => $fetch('/api/nav'))

// Fetch schema for detail page
const { data: schema, error } = await useAsyncData(
  `schema-${urlPath.value}`,
  async () => {
    if (isCategory.value) return null
    return $fetch(`/api/schema/${urlPath.value}`)
  },
  { watch: [urlPath] },
)

// Category schemas from nav
const categorySchemas = computed(() => {
  if (!isCategory.value) return []
  const section = nav.value?.find(s => s.urlPrefix === urlPath.value)
  return section?.schemas ?? []
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
      <h1 class="text-3xl font-bold text-slate-900 mb-2">{{ categoryTitle }}</h1>
      <p class="text-slate-500 mb-8">{{ categorySchemas.length }} schemas</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <NuxtLink
          v-for="s in categorySchemas"
          :key="s.slug"
          :to="s.url"
          class="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <p class="font-medium text-slate-800 text-sm leading-snug">{{ s.title }}</p>
          <p class="font-mono text-xs text-slate-400 mt-1 truncate">{{ s.slug }}</p>
        </NuxtLink>
      </div>
    </div>

    <!-- Schema detail -->
    <div v-else-if="schema">
      <div class="flex items-center justify-between mb-6">
        <div />
        <NuxtLink
          :to="`/builder?schema=${urlPath}`"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >🛠 Open in Builder</NuxtLink>
      </div>
      <SchemaView :schema="schema as any" :urlPath="urlPath" />
    </div>

    <!-- Loading -->
    <div v-else class="py-20 text-center text-slate-400">Loading…</div>
  </div>
</template>
