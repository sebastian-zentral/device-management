<script setup lang="ts">
const props = defineProps<{ supportedOS: Record<string, any> }>()

const PLATFORMS = ['iOS', 'macOS', 'tvOS', 'visionOS', 'watchOS']
const PLATFORM_COLORS: Record<string, string> = {
  iOS:       'bg-ztl-cyan/20 text-ztl-anthracite ring-ztl-cyan/30',
  macOS:     'bg-ztl-anthracite/10 text-ztl-anthracite ring-ztl-navy/20',
  tvOS:      'bg-purple-100 text-purple-800 ring-purple-200',
  visionOS:  'bg-indigo-100 text-indigo-800 ring-indigo-200',
  watchOS:   'bg-rose-100 text-rose-800 ring-rose-200',
}

const platforms = computed(() =>
  PLATFORMS.filter(p => props.supportedOS[p] && props.supportedOS[p].introduced !== 'n/a'),
)

function rowVal(p: string, key: string) {
  const val = props.supportedOS[p]?.[key]
  if (val === undefined || val === null) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'object' && val.mode) return val.mode
  return String(val)
}

const rows = [
  { key: 'introduced',      label: 'Introduced' },
  { key: 'supervised',      label: 'Supervised' },
  { key: 'requiresdep',     label: 'Requires DEP' },
  { key: 'userapprovedmdm', label: 'User-approved MDM' },
  { key: 'accessrights',    label: 'Access Rights' },
  { key: 'userenrollment',  label: 'User Enrollment' },
  { key: 'multiple',        label: 'Multiple Payloads' },
]

const activeRows = computed(() =>
  rows.filter(r => platforms.value.some(p => props.supportedOS[p]?.[r.key] !== undefined)),
)
</script>

<template>
  <div class="overflow-x-auto">
    <div class="flex gap-2 mb-3 flex-wrap">
      <span
        v-for="p in platforms"
        :key="p"
        class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1"
        :class="PLATFORM_COLORS[p]"
      >{{ p }}</span>
    </div>
    <table class="min-w-full text-sm border-collapse">
      <thead>
        <tr class="border-b border-slate-200">
          <th class="text-left py-2 pr-6 text-xs font-semibold text-slate-400 uppercase tracking-wide w-40">Property</th>
          <th
            v-for="p in platforms"
            :key="p"
            class="text-left py-2 pr-4 text-xs font-semibold text-ztl-anthracite"
          >{{ p }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in activeRows" :key="row.key" class="border-b border-slate-100 hover:bg-ztl-cyan/5">
          <td class="py-2 pr-6 text-slate-500 text-xs font-medium">{{ row.label }}</td>
          <td v-for="p in platforms" :key="p" class="py-2 pr-4 text-ztl-anthracite text-sm">
            <span v-if="supportedOS[p]?.[row.key] === undefined" class="text-slate-300">—</span>
            <span v-else>{{ rowVal(p, row.key) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
