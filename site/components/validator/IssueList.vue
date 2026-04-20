<script setup lang="ts">
import type { ValidationIssue } from '~/utils/validateProfile'

defineProps<{ issues: ValidationIssue[] }>()

const STYLES = {
  error:   { dot: 'bg-ztl-red',    label: 'bg-ztl-red/15 text-ztl-red' },
  warning: { dot: 'bg-amber-400',  label: 'bg-amber-100 text-amber-700' },
  info:    { dot: 'bg-ztl-cyan',   label: 'bg-ztl-cyan/20 text-ztl-navy' },
}
</script>

<template>
  <ul class="divide-y divide-slate-100">
    <li v-for="(issue, i) in issues" :key="i" class="flex items-start gap-3 px-4 py-3">
      <span class="mt-1.5 w-2 h-2 rounded-full shrink-0" :class="STYLES[issue.severity].dot" />
      <div class="min-w-0 flex-1">
        <code v-if="issue.path" class="font-mono text-xs text-slate-400 mr-2">{{ issue.path }}</code>
        <span class="text-sm text-ztl-anthracite">{{ issue.message }}</span>
      </div>
      <span
        class="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded"
        :class="STYLES[issue.severity].label"
      >{{ issue.severity }}</span>
    </li>
  </ul>
</template>
