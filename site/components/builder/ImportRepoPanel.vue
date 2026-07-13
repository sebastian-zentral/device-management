<script setup lang="ts">
import { type RepoArtifact, type RepoParseResult, parseTerraformRepo } from '~/utils/parseTerraform'

const emit = defineEmits<{ pick: [artifact: RepoArtifact]; close: [] }>()

const folderInput = ref<HTMLInputElement>()
const result = ref<RepoParseResult | null>(null)
const tfFileCount = ref(0)
const mcFileCount = ref(0)
const busy = ref(false)
const error = ref('')

async function handleFolder(e: Event) {
  const list = (e.target as HTMLInputElement).files
  if (!list || !list.length) return
  busy.value = true
  error.value = ''
  result.value = null
  try {
    const tfSources: string[] = []
    const files: Record<string, string> = {}
    for (const f of Array.from(list)) {
      if (f.name.endsWith('.tf')) tfSources.push(await f.text())
      else if (f.name.endsWith('.mobileconfig')) files[f.name] = await f.text()
    }
    tfFileCount.value = tfSources.length
    mcFileCount.value = Object.keys(files).length
    if (!tfSources.length) throw new Error('No .tf files found in the selected folder.')
    result.value = parseTerraformRepo(tfSources, files)
    if (!result.value.artifacts.length) throw new Error('No MDM profile or declaration artifacts found.')
  } catch (e: any) {
    error.value = e.message ?? 'Failed to read the folder'
  } finally {
    busy.value = false
  }
}

const skippedTotal = computed(() =>
  (result.value?.skipped ?? []).reduce((n, s) => n + s.count, 0))

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-ztl-navy/60 backdrop-blur-sm"
    @click="onBackdrop"
  >
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col" style="max-height: 85vh;">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
        <h3 class="font-semibold text-ztl-navy">Import repo folder</h3>
        <button class="text-slate-400 hover:text-ztl-navy text-lg leading-none" @click="emit('close')">✕</button>
      </div>

      <div class="p-5 space-y-4 overflow-y-auto">
        <p class="text-xs text-slate-500">
          Select a Zentral Terraform config folder (e.g. the starter kit). The MDM profile and declaration
          artifacts are parsed from all <code class="font-mono bg-slate-100 px-1 rounded">.tf</code> files,
          resolving profile content from the included
          <code class="font-mono bg-slate-100 px-1 rounded">mobileconfigs/</code>. Other resource types
          (osquery, santa, monolith, blueprints, …) aren't modeled by the builder and are skipped.
        </p>

        <div>
          <input
            ref="folderInput"
            type="file"
            webkitdirectory
            directory
            multiple
            class="hidden"
            @change="handleFolder"
          >
          <button
            class="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-ztl-cyan hover:text-ztl-anthracite text-sm font-medium transition-colors"
            @click="folderInput?.click()"
          >📁 Choose a repository folder</button>
        </div>

        <p v-if="busy" class="text-sm text-slate-500">Reading folder…</p>
        <p v-if="error" class="text-sm text-ztl-red bg-ztl-red/10 rounded-lg px-3 py-2">{{ error }}</p>

        <template v-if="result">
          <div class="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Found <b>{{ result.artifacts.length }}</b> MDM artifacts
            ({{ result.artifacts.filter(a => a.kind === 'profile').length }} profiles,
            {{ result.artifacts.filter(a => a.kind === 'declaration').length }} declarations)
            across {{ tfFileCount }} .tf files · {{ mcFileCount }} .mobileconfig files.
            <span v-if="skippedTotal">Skipped {{ skippedTotal }} non-MDM resources across {{ result.skipped.length }} kinds.</span>
          </div>

          <div class="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            <button
              v-for="a in result.artifacts"
              :key="a.label"
              class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
              @click="emit('pick', a)"
            >
              <span
                class="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                :class="a.kind === 'profile' ? 'bg-ztl-cyan/15 text-ztl-navy' : 'bg-purple-100 text-purple-700'"
              >{{ a.kind === 'profile' ? 'Profile' : 'Decl' }}</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-ztl-anthracite truncate">{{ a.artifact.name || a.label }}</div>
                <div class="text-xs text-slate-400 font-mono truncate">
                  {{ a.kind === 'declaration' ? a.declaration?.Type : (a.profileSource?.fileName || a.artifact.type) }}
                </div>
              </div>
              <span v-if="a.warnings.length" class="shrink-0 text-amber-500 text-xs" :title="a.warnings.join('; ')">⚠</span>
              <span class="shrink-0 text-slate-300 text-xs">→</span>
            </button>
          </div>
        </template>
      </div>

      <div class="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
        <button class="px-4 py-2 text-sm text-slate-500 hover:text-ztl-navy font-medium" @click="emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>
