<script setup lang="ts">
import { toPlist } from '~/utils/plist'
import { initFormData } from '~/utils/formInit'

useHead({ title: 'Profile Builder — Device Management' })

type Mode = 'profile' | 'declaration'
const mode = ref<Mode>('profile')
const showPicker = ref(false)
const showImport = ref(false)
const mobileTab = ref<'form' | 'output'>('form')

// ── MDM Profile ────────────────────────────────────────────────────────────────
const profileMeta = reactive({
  PayloadDisplayName: '',
  PayloadIdentifier: '',
  PayloadDescription: '',
  PayloadOrganization: '',
})

interface PayloadEntry {
  id: string
  uuid: string
  schema: Record<string, any>
  formData: Record<string, any>
  collapsed: boolean
}

const payloads = ref<PayloadEntry[]>([])
const profileUuid = ref(genUuid())

function addPayload(schema: Record<string, any>) {
  payloads.value.push({
    id: genUuid(),
    uuid: genUuid(),
    schema,
    formData: initFormData(schema.payloadkeys ?? []),
    collapsed: false,
  })
  showPicker.value = false
}

function removePayload(id: string) {
  payloads.value = payloads.value.filter(p => p.id !== id)
}

function updatePayloadKey(entry: PayloadEntry, key: string, val: any) {
  if (val === undefined) {
    delete entry.formData[key]
  } else {
    entry.formData[key] = val
  }
}

// ── DDM Declaration ────────────────────────────────────────────────────────────
const declSchema = ref<Record<string, any> | null>(null)
const declIdentifier = ref('')
const declServerToken = ref('')
const declFormData = ref<Record<string, any>>({})

function setDeclSchema(schema: Record<string, any>) {
  declSchema.value = schema
  declFormData.value = initFormData(schema.payloadkeys ?? [])
  showPicker.value = false
}

// ── Platform context ───────────────────────────────────────────────────────────
const platformContext = reactive({
  platforms: ['iOS', 'macOS'] as string[],
  supervised: false,
  enrollment: 'mdm',
})

// ── UUID helper ────────────────────────────────────────────────────────────────
function genUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// ── Output generation ──────────────────────────────────────────────────────────
const output = computed(() =>
  mode.value === 'profile' ? buildProfile() : buildDeclaration(),
)

const outputFilename = computed(() =>
  mode.value === 'profile'
    ? `${(profileMeta.PayloadIdentifier || 'profile').replace(/[^a-zA-Z0-9._-]/g, '_')}.mobileconfig`
    : `${(declIdentifier.value || 'declaration').replace(/[^a-zA-Z0-9._-]/g, '_')}.json`,
)

const outputLabel = computed(() =>
  mode.value === 'profile' ? 'Plist XML (.mobileconfig)' : 'JSON Declaration',
)

function buildProfile(): string {
  if (!payloads.value.length && !profileMeta.PayloadDisplayName) return ''

  const content = payloads.value.map((p, i) => {
    const payloadType = p.schema.payload?.payloadtype
    return {
      PayloadType: payloadType,
      PayloadVersion: 1,
      PayloadIdentifier: `${profileMeta.PayloadIdentifier || 'com.example.profile'}.payload${i + 1}`,
      PayloadUUID: p.uuid,
      ...p.formData,
    }
  })

  const profile: Record<string, any> = {
    PayloadDisplayName: profileMeta.PayloadDisplayName || 'My Profile',
    PayloadIdentifier: profileMeta.PayloadIdentifier || 'com.example.profile',
    PayloadType: 'Configuration',
    PayloadUUID: profileUuid.value,
    PayloadVersion: 1,
    PayloadContent: content,
  }
  if (profileMeta.PayloadDescription) profile.PayloadDescription = profileMeta.PayloadDescription
  if (profileMeta.PayloadOrganization) profile.PayloadOrganization = profileMeta.PayloadOrganization

  return toPlist(profile)
}

function buildDeclaration(): string {
  if (!declSchema.value) return ''
  const decl = {
    Type: declSchema.value.payload?.declarationtype ?? '',
    Identifier: declIdentifier.value || 'com.example.declaration',
    ServerToken: declServerToken.value || genUuid(),
    Payload: declFormData.value,
  }
  return JSON.stringify(decl, null, 2)
}

// ── Import .mobileconfig ───────────────────────────────────────────────────────
const PAYLOAD_META_KEYS = new Set([
  'PayloadType', 'PayloadVersion', 'PayloadIdentifier', 'PayloadUUID',
  'PayloadDisplayName', 'PayloadDescription', 'PayloadOrganization',
  'PayloadEnabled', 'PayloadScope',
])

// Fetch nav once so we can look up schemas by PayloadType
const { data: navData } = await useAsyncData('nav', () =>
  $fetch<Array<{ id: string; urlPrefix: string; schemas: Array<{ slug: string; url: string }> }>>('/api/nav'),
)

async function schemaForPayloadType(payloadType: string): Promise<Record<string, any>> {
  const section = navData.value?.find(s => s.id === 'mdm-profiles')
  const match = section?.schemas.find(s => s.slug === payloadType)
  if (match) {
    try {
      return await $fetch<Record<string, any>>(`/api/schema/mdm/profiles/${payloadType}`)
    } catch { /* fall through to stub */ }
  }
  // Unknown type — return a stub so the form still shows imported values
  return {
    title: payloadType,
    payload: { payloadtype: payloadType },
    payloadkeys: [],
    _unknown: true,
  }
}

async function handleImport(parsed: Record<string, any>) {
  // Profile-level metadata
  profileMeta.PayloadDisplayName = parsed.PayloadDisplayName ?? ''
  profileMeta.PayloadIdentifier  = parsed.PayloadIdentifier  ?? ''
  profileMeta.PayloadDescription = parsed.PayloadDescription ?? ''
  profileMeta.PayloadOrganization= parsed.PayloadOrganization ?? ''
  profileUuid.value = parsed.PayloadUUID ?? genUuid()

  // Rebuild payload list
  payloads.value = []
  for (const rawPayload of (parsed.PayloadContent ?? [])) {
    const schema = await schemaForPayloadType(rawPayload.PayloadType ?? '')
    // Strip standard keys; keep everything else as formData
    const formData: Record<string, any> = {}
    for (const [k, v] of Object.entries(rawPayload)) {
      if (!PAYLOAD_META_KEYS.has(k)) formData[k] = v
    }
    payloads.value.push({
      id: genUuid(),
      uuid: rawPayload.PayloadUUID ?? genUuid(),
      schema,
      formData,
      collapsed: false,
    })
  }

  mode.value = 'profile'
  showImport.value = false
}

// ── "Open in builder" from schema page ─────────────────────────────────────────
const route = useRoute()
const preloadPath = route.query.schema as string | undefined
if (preloadPath) {
  const data = await useAsyncData(`preload-${preloadPath}`, () =>
    $fetch<Record<string, any>>(`/api/schema/${preloadPath}`),
  )
  if (data.data.value) {
    const schema = data.data.value
    const isDecl = !!schema.payload?.declarationtype
    if (isDecl) {
      mode.value = 'declaration'
      setDeclSchema(schema)
    } else {
      addPayload(schema)
    }
  }
}
</script>

<template>
  <!-- Mobile tab bar -->
  <div class="flex md:hidden mb-4 gap-1 p-1 bg-slate-100 rounded-xl">
    <button
      v-for="[tab, label] in [['form', 'Form'], ['output', 'Output']]"
      :key="tab"
      class="flex-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
      :class="mobileTab === tab
        ? 'bg-white text-ztl-anthracite shadow-sm'
        : 'text-slate-500 hover:text-ztl-anthracite'"
      @click="mobileTab = (tab as 'form' | 'output')"
    >
      {{ label }}
      <span v-if="tab === 'output' && output" class="w-1.5 h-1.5 rounded-full bg-ztl-cyan" />
    </button>
  </div>

  <div class="flex gap-6 items-start">
    <!-- ── Left: Form ── -->
    <div class="flex-1 min-w-0 space-y-6" :class="{ 'hidden md:block': mobileTab === 'output' }">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-ztl-anthracite mb-1">Profile Builder</h1>
          <p class="text-ztl-anthracite/60 text-sm">Build and export Apple device management profiles and declarations.</p>
        </div>
        <button
          class="shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-ztl-anthracite transition-colors bg-white"
          @click="showImport = true"
        >📥 Import .mobileconfig</button>
      </div>

      <!-- Mode tabs -->
      <div class="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          v-for="m in (['profile', 'declaration'] as Mode[])"
          :key="m"
          class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="mode === m
            ? 'bg-white text-ztl-anthracite shadow-sm'
            : 'text-slate-500 hover:text-ztl-anthracite'"
          @click="mode = m"
        >{{ m === 'profile' ? 'MDM Profile' : 'DDM Declaration' }}</button>
      </div>

      <!-- Platform context bar -->
      <BuilderPlatformBar
        v-if="mode === 'profile'"
        v-model:platforms="platformContext.platforms"
        v-model:supervised="platformContext.supervised"
        v-model:enrollment="platformContext.enrollment"
      />

      <!-- ── MDM Profile mode ── -->
      <template v-if="mode === 'profile'">
        <!-- Profile metadata -->
        <div class="rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-4 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-ztl-anthracite text-sm">
            Profile Metadata
          </div>
          <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Display Name <span class="text-red-500">*</span></label>
              <input v-model="profileMeta.PayloadDisplayName" type="text" placeholder="My Wi-Fi Profile" class="builder-input" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Identifier <span class="text-red-500">*</span></label>
              <input v-model="profileMeta.PayloadIdentifier" type="text" placeholder="com.example.profile" class="builder-input" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <input v-model="profileMeta.PayloadDescription" type="text" placeholder="Optional description" class="builder-input" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Organization</label>
              <input v-model="profileMeta.PayloadOrganization" type="text" placeholder="Acme Corp" class="builder-input" />
            </div>
          </div>
        </div>

        <!-- Payloads -->
        <div
          v-for="entry in payloads"
          :key="entry.id"
          class="rounded-xl border border-slate-200 overflow-hidden"
        >
          <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <button
              class="flex items-center gap-2 text-left"
              @click="entry.collapsed = !entry.collapsed"
            >
              <span
                class="text-slate-400 text-xs transition-transform"
                :class="entry.collapsed ? '-rotate-90' : 'rotate-0'"
              >▼</span>
              <span class="font-semibold text-ztl-anthracite text-sm">{{ entry.schema.title }}</span>
              <code class="font-mono text-xs text-slate-400">{{ entry.schema.payload?.payloadtype }}</code>
            </button>
            <button
              class="text-slate-400 hover:text-ztl-red text-xs font-medium"
              @click="removePayload(entry.id)"
            >Remove</button>
          </div>

          <div v-if="!entry.collapsed" class="p-4">
            <!-- Known schema: render form fields -->
            <div v-if="!entry.schema._unknown" class="divide-y divide-slate-100">
              <BuilderFieldInput
                v-for="key in (entry.schema.payloadkeys ?? [])"
                :key="key.key"
                :keyData="key"
                :platformContext="platformContext"
                :model-value="entry.formData[key.key]"
                @update:model-value="(v) => updatePayloadKey(entry, key.key, v)"
              />
            </div>
            <!-- Unknown type: show imported values as editable key-value pairs -->
            <div v-else>
              <p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                This payload type is not in the schema library. Imported values are shown below and will be included in the output as-is.
              </p>
              <div class="space-y-2">
                <div
                  v-for="(val, key) in entry.formData"
                  :key="key"
                  class="flex items-start gap-3 text-sm"
                >
                  <code class="font-mono font-semibold text-slate-700 shrink-0 min-w-32">{{ key }}</code>
                  <span class="text-slate-500 font-mono text-xs bg-slate-50 px-2 py-1 rounded border border-slate-200 break-all">
                    {{ JSON.stringify(val) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Add payload -->
        <button
          class="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-ztl-cyan hover:text-ztl-anthracite text-sm font-medium transition-colors bg-white"
          @click="showPicker = true"
        >+ Add Payload</button>
      </template>

      <!-- ── DDM Declaration mode ── -->
      <template v-else>
        <!-- Select type -->
        <div v-if="!declSchema" class="text-center py-10">
          <p class="text-slate-500 mb-4 text-sm">Choose a declaration type to get started.</p>
          <button
            class="px-5 py-2.5 bg-ztl-anthracite text-white rounded-lg font-medium hover:bg-ztl-anthracite/90 text-sm"
            @click="showPicker = true"
          >Select Declaration Type</button>
        </div>

        <template v-else>
          <!-- Declaration metadata -->
          <div class="rounded-xl border border-slate-200 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div>
                <span class="font-semibold text-ztl-anthracite text-sm">{{ declSchema.title }}</span>
                <code class="ml-2 font-mono text-xs text-slate-400">{{ declSchema.payload?.declarationtype }}</code>
              </div>
              <button class="text-xs text-slate-400 hover:text-blue-600" @click="showPicker = true">Change</button>
            </div>
            <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Identifier <span class="text-red-500">*</span></label>
                <input v-model="declIdentifier" type="text" placeholder="com.example.caldav" class="builder-input" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Server Token</label>
                <input v-model="declServerToken" type="text" placeholder="Leave blank to auto-generate" class="builder-input" />
              </div>
            </div>
          </div>

          <!-- Declaration payload keys -->
          <div class="rounded-xl border border-slate-200 overflow-hidden">
            <div class="px-4 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-ztl-anthracite text-sm">Payload</div>
            <div class="p-4 divide-y divide-slate-100">
              <BuilderFieldInput
                v-for="key in (declSchema.payloadkeys ?? [])"
                :key="key.key"
                :keyData="key"
                :model-value="declFormData[key.key]"
                @update:model-value="(v) => { if (v === undefined) delete declFormData[key.key]; else declFormData[key.key] = v }"
              />
            </div>
          </div>
        </template>
      </template>
    </div>

    <!-- ── Right: Output ── -->
    <div
      class="w-full md:w-96 md:shrink-0 md:sticky md:top-8"
      :class="{ 'hidden md:block': mobileTab === 'form' }"
    >
      <div
        class="rounded-xl border border-slate-200 overflow-hidden"
        style="max-height: calc(100vh - 4rem); min-height: 400px;"
      >
        <BuilderOutputPanel
          v-if="output"
          :content="output"
          :filename="outputFilename"
          :label="outputLabel"
        />
        <div v-else class="flex items-center justify-center h-64 text-slate-300 text-sm">
          <div class="text-center">
            <div class="text-4xl mb-3">📄</div>
            <p>Output will appear here</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Type picker modal -->
  <BuilderTypePicker
    v-if="showPicker"
    :mode="mode"
    @select="mode === 'profile' ? addPayload($event) : setDeclSchema($event)"
    @close="showPicker = false"
  />

  <!-- Import modal -->
  <BuilderImportPanel
    v-if="showImport"
    @import="handleImport"
    @close="showImport = false"
  />
</template>

<style>
.builder-input {
  @apply w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500;
}
</style>
