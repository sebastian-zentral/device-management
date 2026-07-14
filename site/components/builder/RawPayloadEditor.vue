<script setup lang="ts">
// Editable JSON view for payloads whose type isn't in the schema library
// (e.g. third-party types like com.northpolesec.santa). Lets the imported
// values be edited directly, since there are no generated form fields.
const props = defineProps<{ modelValue: Record<string, any> }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, any>] }>()

const text = ref(JSON.stringify(props.modelValue ?? {}, null, 2))
const error = ref('')

// Reflect external changes (e.g. re-import) unless the user is mid-edit here.
watch(() => props.modelValue, (v) => {
  const incoming = JSON.stringify(v ?? {}, null, 2)
  try {
    if (JSON.stringify(JSON.parse(text.value)) !== JSON.stringify(v ?? {})) text.value = incoming
  } catch {
    text.value = incoming
  }
})

function onInput(e: Event) {
  text.value = (e.target as HTMLTextAreaElement).value
  try {
    const parsed = JSON.parse(text.value)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      error.value = 'Expected a JSON object'
      return
    }
    error.value = ''
    emit('update:modelValue', parsed)
  } catch (e: any) {
    error.value = e.message ?? 'Invalid JSON'
  }
}
</script>

<template>
  <div>
    <p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
      This payload type isn't in the schema library, so it's shown as raw JSON. Edit the values directly — they're included in the output as-is.
    </p>
    <textarea
      :value="text"
      rows="10"
      spellcheck="false"
      class="w-full px-3 py-2 font-mono text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-ztl-cyan resize-y"
      :class="error ? 'border-ztl-red' : 'border-slate-200'"
      @input="onInput"
    />
    <p v-if="error" class="text-xs text-ztl-red mt-1">{{ error }}</p>
  </div>
</template>
