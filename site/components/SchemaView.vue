<script setup lang="ts">
import type { PlatformContext } from '~/utils/platformCompat'

const props = defineProps<{
  schema: Record<string, any>
  urlPath: string
  platformContext?: PlatformContext
}>()

const schemaType = computed(() => {
  const p = props.schema.payload
  if (!p) return null
  return p.requesttype ?? p.payloadtype ?? p.declarationtype ?? p.checkintype
    ?? p.statusitemtype ?? p.credentialtype ?? null
})

const schemaKind = computed(() => {
  const p = props.schema.payload
  if (!p) return null
  if (p.requesttype)     return 'COMMAND'
  if (p.payloadtype)     return 'PROFILE'
  if (p.declarationtype) return 'DECLARATION'
  if (p.checkintype)     return 'CHECK-IN'
  if (p.statusitemtype)  return 'STATUS'
  if (p.credentialtype)  return 'CREDENTIAL'
  return null
})

const KIND_COLORS: Record<string, string> = {
  COMMAND:     'bg-ztl-cyan/20 text-ztl-anthracite',
  PROFILE:     'bg-ztl-anthracite/10 text-ztl-anthracite',
  DECLARATION: 'bg-teal-100 text-teal-700',
  'CHECK-IN':  'bg-ztl-red/15 text-ztl-red',
  STATUS:      'bg-emerald-100 text-emerald-700',
  CREDENTIAL:  'bg-indigo-100 text-indigo-700',
}
</script>

<template>
  <article class="max-w-4xl">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-2 flex-wrap">
        <span
          v-if="schemaKind"
          class="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded"
          :class="KIND_COLORS[schemaKind] ?? 'bg-slate-100 text-slate-600'"
        >{{ schemaKind }}</span>
        <code v-if="schemaType" class="font-mono text-sm text-slate-400">{{ schemaType }}</code>
      </div>
      <h1 class="text-3xl font-bold text-ztl-anthracite mb-3">{{ schema.title }}</h1>
      <p v-if="schema.description" class="text-lg text-ztl-anthracite/70">{{ schema.description }}</p>
      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
        <div v-if="schema.payload?.apply">
          <span class="font-medium text-slate-500">Apply:</span>
          <code class="ml-1 font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{{ schema.payload.apply }}</code>
        </div>
        <span
          v-if="schema.payload?.beta"
          class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold"
        >BETA</span>
      </div>
    </div>

    <!-- Long-form payload description -->
    <section v-if="schema.payload?.content" class="mb-8 prose prose-slate max-w-none">
      <MdContent :text="schema.payload.content" />
    </section>

    <!-- Notes -->
    <section v-if="schema.notes?.length" class="mb-8">
      <h2 class="text-base font-semibold text-ztl-anthracite mb-3 pb-2 border-b border-slate-200">Notes</h2>
      <div class="space-y-4">
        <div
          v-for="(note, i) in schema.notes"
          :key="i"
          class="bg-amber-50 border border-amber-200 rounded-lg p-4"
        >
          <p v-if="note.title" class="font-semibold text-amber-800 mb-2">{{ note.title }}</p>
          <MdContent v-if="note.content" :text="note.content" />
        </div>
      </div>
    </section>

    <!-- Platform Support -->
    <section v-if="schema.payload?.supportedOS" class="mb-8">
      <h2 class="text-base font-semibold text-ztl-anthracite mb-3 pb-2 border-b border-slate-200">Platform Support</h2>
      <PlatformMatrix :supportedOS="schema.payload.supportedOS" />
    </section>

    <!-- Payload Keys -->
    <section v-if="schema.payloadkeys?.length" class="mb-8">
      <h2 class="text-base font-semibold text-ztl-anthracite mb-1 pb-2 border-b border-slate-200">
        {{ schemaKind === 'COMMAND' ? 'Request Keys' : 'Payload Keys' }}
      </h2>
      <div class="divide-y divide-slate-100">
        <PayloadKeyNode
          v-for="key in schema.payloadkeys"
          :key="key.key"
          :keyData="key"
          :platformContext="platformContext"
        />
      </div>
    </section>

    <!-- Response Keys -->
    <section v-if="schema.responsekeys?.length" class="mb-8">
      <h2 class="text-base font-semibold text-ztl-anthracite mb-1 pb-2 border-b border-slate-200">Response Keys</h2>
      <div class="divide-y divide-slate-100">
        <PayloadKeyNode
          v-for="key in schema.responsekeys"
          :key="key.key"
          :keyData="key"
          :platformContext="platformContext"
        />
      </div>
    </section>

    <!-- Related status items -->
    <section v-if="schema['related-status-items']?.length" class="mb-8">
      <h2 class="text-base font-semibold text-ztl-anthracite mb-3 pb-2 border-b border-slate-200">Related Status Items</h2>
      <div class="space-y-3">
        <div v-for="(rel, i) in schema['related-status-items']" :key="i" class="text-sm">
          <div class="flex flex-wrap gap-1.5">
            <code v-for="s in rel['status-items']" :key="s" class="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{{ s }}</code>
          </div>
          <p v-if="rel.note" class="mt-1 text-slate-600">{{ rel.note }}</p>
        </div>
      </div>
    </section>

    <!-- Reasons (declarative status) -->
    <section v-if="schema.reasons?.length" class="mb-8">
      <h2 class="text-base font-semibold text-ztl-anthracite mb-3 pb-2 border-b border-slate-200">Reasons</h2>
      <div class="divide-y divide-slate-100">
        <div v-for="r in schema.reasons" :key="r.value" class="py-3">
          <code class="font-mono font-semibold text-sm text-ztl-anthracite">{{ r.value }}</code>
          <div v-if="r.description" class="mt-1 text-sm text-slate-600">
            <MdContent :text="r.description" />
          </div>
          <div v-if="r.details?.length" class="mt-2 ml-4 pl-4 border-l border-slate-200 space-y-1">
            <div v-for="d in r.details" :key="d.key" class="text-sm">
              <code class="font-mono font-semibold text-ztl-anthracite">{{ d.key }}</code>
              <span v-if="d.type" class="ml-1.5 font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{{ d.type }}</span>
              <div v-if="d.description" class="mt-0.5 text-slate-600">{{ d.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

  </article>
</template>
