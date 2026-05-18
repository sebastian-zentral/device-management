<script setup lang="ts">
const props = defineProps<{ schema: Record<string, any>; urlPath: string }>()

const schemaType = computed(() => {
  const p = props.schema.payload
  if (!p) return null
  return p.requesttype ?? p.payloadtype ?? p.declarationtype ?? p.checkintype ?? null
})

const schemaKind = computed(() => {
  const p = props.schema.payload
  if (!p) return null
  if (p.requesttype)    return 'COMMAND'
  if (p.payloadtype)    return 'PROFILE'
  if (p.declarationtype) return 'DECLARATION'
  if (p.checkintype)    return 'CHECK-IN'
  return null
})

const KIND_COLORS: Record<string, string> = {
  COMMAND:     'bg-sky-100 text-sky-700',
  PROFILE:     'bg-violet-100 text-violet-700',
  DECLARATION: 'bg-teal-100 text-teal-700',
  'CHECK-IN':  'bg-orange-100 text-orange-700',
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
        <code v-if="schemaType" class="font-mono text-sm text-slate-500">{{ schemaType }}</code>
      </div>
      <h1 class="text-3xl font-bold text-slate-900 mb-3">{{ schema.title }}</h1>
      <p v-if="schema.description" class="text-lg text-slate-600">{{ schema.description }}</p>
    </div>

    <!-- Platform Support -->
    <section v-if="schema.payload?.supportedOS" class="mb-8">
      <h2 class="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">Platform Support</h2>
      <PlatformMatrix :supportedOS="schema.payload.supportedOS" />
    </section>

    <!-- Payload Keys -->
    <section v-if="schema.payloadkeys?.length" class="mb-8">
      <h2 class="text-lg font-semibold text-slate-800 mb-1 pb-2 border-b border-slate-200">
        {{ schemaKind === 'COMMAND' ? 'Request Keys' : 'Payload Keys' }}
      </h2>
      <div class="divide-y divide-slate-100">
        <PayloadKeyNode
          v-for="key in schema.payloadkeys"
          :key="key.key"
          :keyData="key"
        />
      </div>
    </section>

    <!-- Response Keys -->
    <section v-if="schema.responsekeys?.length" class="mb-8">
      <h2 class="text-lg font-semibold text-slate-800 mb-1 pb-2 border-b border-slate-200">Response Keys</h2>
      <div class="divide-y divide-slate-100">
        <PayloadKeyNode
          v-for="key in schema.responsekeys"
          :key="key.key"
          :keyData="key"
        />
      </div>
    </section>

    <!-- Notes -->
    <section v-if="schema.notes?.length" class="mb-8">
      <h2 class="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">Notes</h2>
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
  </article>
</template>
