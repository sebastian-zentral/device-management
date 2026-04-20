<script setup lang="ts">
interface NavSchema { slug: string; title: string; url: string }
interface NavSection { id: string; label: string; group: string; urlPrefix: string; schemas: NavSchema[] }

const props = defineProps<{ mode: 'profile' | 'declaration' }>()
const emit = defineEmits<{ select: [schema: Record<string, any>]; close: [] }>()

const { data: nav } = await useAsyncData('nav', () => $fetch<NavSection[]>('/api/nav'))
const search = ref('')
const loading = ref(false)

const relevantPrefixes = computed(() =>
  props.mode === 'profile'
    ? ['mdm/profiles']
    : ['declarative/configurations', 'declarative/activations', 'declarative/assets', 'declarative/management'],
)

const sections = computed(() => {
  const q = search.value.toLowerCase().trim()
  return (nav.value ?? [])
    .filter(s => relevantPrefixes.value.includes(s.urlPrefix))
    .map(s => ({
      ...s,
      schemas: q
        ? s.schemas.filter(sc => sc.title.toLowerCase().includes(q) || sc.slug.includes(q))
        : s.schemas,
    }))
    .filter(s => s.schemas.length > 0)
})

async function pick(schema: NavSchema) {
  loading.value = true
  try {
    const data = await $fetch<Record<string, any>>(`/api/schema/${schema.url.replace(/^\//, '')}`)
    emit('select', data)
  } finally {
    loading.value = false
  }
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-ztl-navy/60 backdrop-blur-sm"
    @click="onBackdrop"
  >
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh] overflow-hidden">
      <!-- Header -->
      <div class="p-4 border-b border-slate-100 shrink-0">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-ztl-anthracite">
            Select {{ mode === 'profile' ? 'Profile Type' : 'Declaration Type' }}
          </h3>
          <button class="text-slate-400 hover:text-ztl-anthracite text-lg leading-none" @click="emit('close')">✕</button>
        </div>
        <input
          v-model="search"
          type="text"
          placeholder="Search…"
          autofocus
          class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-ztl-cyan"
        >
      </div>

      <!-- List -->
      <div class="overflow-y-auto flex-1">
        <template v-for="section in sections" :key="section.id">
          <div class="px-4 py-2 text-xs font-bold uppercase tracking-wider text-ztl-anthracite/40 bg-slate-50 sticky top-0">
            {{ section.label }}
          </div>
          <button
            v-for="s in section.schemas"
            :key="s.slug"
            :disabled="loading"
            class="w-full text-left px-4 py-2.5 hover:bg-ztl-cyan/10 border-b border-slate-50 disabled:opacity-50 transition-colors"
            @click="pick(s)"
          >
            <div class="font-medium text-ztl-anthracite text-sm">{{ s.title }}</div>
            <div class="font-mono text-xs text-slate-400 mt-0.5">{{ s.slug }}</div>
          </button>
        </template>
        <div v-if="!sections.length" class="p-8 text-center text-slate-400 text-sm">No results</div>
      </div>
    </div>
  </div>
</template>
