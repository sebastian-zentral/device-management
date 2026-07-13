<script setup lang="ts">
import { toPlist } from '~/utils/plist'
import { initFormData } from '~/utils/formInit'
import {
  tfString, tfStringArray, tfSlug, toHcl, escapeHeredoc,
  mapPlatforms, declarationArtifactType, platformLines,
} from '~/utils/terraform'
import {
  type Channel,
  profilePayloadChannels, combineProfileChannels, declarationChannels, resolveChannel,
} from '~/utils/channel'
import { parsePlist } from '~/utils/parsePlist'
import { type RepoArtifact, type RepoParseResult, type TfImportResult, parseTerraform, platformsToBuilder } from '~/utils/parseTerraform'

useHead({ title: 'Builder — Device Management' })

type Mode = 'profile' | 'declaration' | 'command'
const mode = ref<Mode>('profile')

// Output serialization format. Terraform is offered for profile and declaration
// modes (the provider has no resource for one-off MDM commands).
type OutputFormat = 'native' | 'terraform'
const outputFormat = ref<OutputFormat>('native')

const formatOptions = computed<Array<{ value: OutputFormat; label: string }>>(() => {
  if (mode.value === 'command') return [{ value: 'native', label: 'Plist' }]
  return [
    { value: 'native', label: mode.value === 'profile' ? '.mobileconfig' : 'JSON' },
    { value: 'terraform', label: 'Terraform' },
  ]
})

// Command mode has no Terraform output — fall back to native when switching to it.
watch(mode, () => {
  if (mode.value === 'command') outputFormat.value = 'native'
  artifactName.value = ''
  artifactVersion.value = 1
  externalFile.value = false
  mobileconfigNameOverride.value = ''
  for (const k of ['ios', 'ipados', 'macos', 'tvos'] as const) {
    versionConstraints[k].min = ''
    versionConstraints[k].max = ''
  }
})

// Zentral artifact name — a human-readable label, distinct from the profile's
// PayloadIdentifier or the declaration's Identifier (e.g. name "macOS 27 Beta
// Program" vs identifier "com.zentral.beta.macosx27.required").
const artifactName = ref('')

// ── Terraform artifact options ────────────────────────────────────────────────
const artifactVersion = ref(1)
// Reference an external .mobileconfig via filebase64() instead of inlining it.
const externalFile = ref(false)
// Optional override for the external .mobileconfig file name (to match a repo's
// naming convention, e.g. "santa.tcc.v1.mobileconfig").
const mobileconfigNameOverride = ref('')

// The .mobileconfig file name referenced by filebase64() and used for the
// companion download — kept in sync so the pair drops into a repo cleanly.
const mobileconfigFilename = computed(() => {
  const slug = tfSlug(artifactName.value || profileMeta.PayloadDisplayName || profileMeta.PayloadIdentifier || 'profile')
  let n = mobileconfigNameOverride.value.trim()
  if (!n) return `${slug}.v${artifactVersion.value}.mobileconfig`
  if (!n.endsWith('.mobileconfig')) n += '.mobileconfig'
  return n
})
// Per-platform min/max OS version constraints on the profile/declaration.
const versionConstraints = reactive<Record<'ios' | 'ipados' | 'macos' | 'tvos', { min: string; max: string }>>({
  ios: { min: '', max: '' },
  ipados: { min: '', max: '' },
  macos: { min: '', max: '' },
  tvos: { min: '', max: '' },
})

const PLATFORM_LABELS: Record<string, string> = { ios: 'iOS', ipados: 'iPadOS', macos: 'macOS', tvos: 'tvOS' }

// The resource-channel platforms currently enabled (drives the constraint inputs).
const activePlatforms = computed(() => {
  const bools = mapPlatforms(platformContext.platforms).bools
  return (['ios', 'ipados', 'macos', 'tvos'] as const).filter(k => bools[k])
})

// ── Artifact channel (Device / User) ─────────────────────────────────────────────
// Derived from the schema (profile devicechannel/userchannel, declaration
// allowed-scopes) but overridable by the user when the schema allows both.
const channelOverride = ref<Channel | null>(null)

const channelInfo = computed(() => {
  if (mode.value === 'profile') {
    return resolveChannel(combineProfileChannels(
      payloads.value.map(p => profilePayloadChannels(p.schema, platformContext.platforms)),
    ))
  }
  if (mode.value === 'declaration' && declSchema.value) {
    return resolveChannel(declarationChannels(declSchema.value, platformContext.platforms))
  }
  return { allowed: ['Device', 'User'] as Channel[], default: 'Device' as Channel }
})

// Effective channel: the user's pick when it's still allowed, else the schema default.
const channel = computed<Channel>(() => {
  const { allowed, default: def } = channelInfo.value
  return channelOverride.value && allowed.includes(channelOverride.value)
    ? channelOverride.value
    : def
})
const showPicker = ref(false)
const showImport = ref(false)
const showTfImport = ref(false)
const showRepoImport = ref(false)
const showImportMenu = ref(false)
const importNote = ref('')
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

// ── MDM Command ────────────────────────────────────────────────────────────────
const cmdSchema = ref<Record<string, any> | null>(null)
const cmdUuid = ref(genUuid())
const cmdFormData = ref<Record<string, any>>({})

function setCmdSchema(schema: Record<string, any>) {
  cmdSchema.value = schema
  cmdFormData.value = initFormData(schema.payloadkeys ?? [])
  cmdUuid.value = genUuid()
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
const output = computed(() => {
  if (mode.value === 'command') return buildCommand()
  if (mode.value === 'profile') {
    return outputFormat.value === 'terraform' ? buildProfileTerraform() : buildProfile()
  }
  return outputFormat.value === 'terraform' ? buildDeclarationTerraform() : buildDeclaration()
})

const outputFilename = computed(() => {
  if (outputFormat.value === 'terraform' && mode.value !== 'command') {
    const base = artifactName.value || (mode.value === 'profile'
      ? (profileMeta.PayloadDisplayName || profileMeta.PayloadIdentifier || 'profile')
      : (declSchema.value?.title || declIdentifier.value || 'declaration'))
    return `${tfSlug(base)}.tf`
  }
  if (mode.value === 'profile') {
    return `${(profileMeta.PayloadIdentifier || 'profile').replace(/[^a-zA-Z0-9._-]/g, '_')}.mobileconfig`
  }
  if (mode.value === 'command') {
    const rt = cmdSchema.value?.payload?.requesttype ?? 'command'
    return `${rt.replace(/[^a-zA-Z0-9._-]/g, '_')}.plist`
  }
  return `${(declIdentifier.value || 'declaration').replace(/[^a-zA-Z0-9._-]/g, '_')}.json`
})

const outputLabel = computed(() => {
  if (outputFormat.value === 'terraform' && mode.value !== 'command') {
    return mode.value === 'profile'
      ? 'Terraform (zentral_mdm_profile)'
      : 'Terraform (zentral_mdm_declaration)'
  }
  if (mode.value === 'profile') return 'Plist XML (.mobileconfig)'
  if (mode.value === 'command') return 'Plist XML (MDM Command)'
  return 'JSON Declaration'
})

// Syntax-highlighting language for the output panel.
const outputLang = computed<'xml' | 'json' | 'hcl'>(() => {
  if (outputFormat.value === 'terraform' && mode.value !== 'command') return 'hcl'
  if (mode.value === 'declaration') return 'json'
  return 'xml' // profile / command native (plist)
})

// Companion .mobileconfig download for external-file Terraform profiles, so the
// .tf and the file it references (filebase64) can be committed together.
const outputExtra = computed(() => {
  if (outputFormat.value === 'terraform' && mode.value === 'profile' && externalFile.value) {
    const content = buildProfile()
    if (content) return { content, filename: mobileconfigFilename.value, label: `↓ ${mobileconfigFilename.value}` }
  }
  return null
})

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

function buildCommand(): string {
  if (!cmdSchema.value) return ''
  const requestType = cmdSchema.value.payload?.requesttype ?? ''
  const command: Record<string, any> = {
    RequestType: requestType,
    ...cmdFormData.value,
  }
  return toPlist({
    CommandUUID: cmdUuid.value,
    Command: command,
  })
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

// ── Terraform output (terraform-provider-zentral) ────────────────────────────────
function buildProfileTerraform(): string {
  const profile = buildProfile()
  if (!profile) return ''

  const name = artifactName.value || profileMeta.PayloadDisplayName || profileMeta.PayloadIdentifier || 'My Profile'
  const slug = tfSlug(name || profileMeta.PayloadIdentifier || 'profile')
  const pm = mapPlatforms(platformContext.platforms)
  const version = artifactVersion.value
  const filePath = `mobileconfigs/${mobileconfigFilename.value}`

  const lines: string[] = []
  if (pm.dropped.length) {
    lines.push(`# Note: ${pm.dropped.join(', ')} — no Zentral MDM artifact platform equivalent; omitted.`)
  }
  lines.push(`resource "zentral_mdm_artifact" "${slug}" {`)
  lines.push(`  name      = ${tfString(name)}`)
  lines.push(`  type      = "Profile"`)
  lines.push(`  channel   = ${tfString(channel.value)}`)
  lines.push(`  platforms = ${tfStringArray(pm.platforms)}`)
  lines.push(`}`)
  lines.push(``)
  if (externalFile.value) {
    lines.push(`# Save the profile (the ".mobileconfig" output) to: ${filePath}`)
  }
  lines.push(`resource "zentral_mdm_profile" "${slug}" {`)
  lines.push(`  artifact_id = zentral_mdm_artifact.${slug}.id`)
  if (externalFile.value) {
    lines.push(`  source      = filebase64("\${path.module}/${filePath}")`)
  } else {
    lines.push(`  source      = base64encode(<<PROFILE`)
    lines.push(escapeHeredoc(profile))
    lines.push(`PROFILE`)
    lines.push(`  )`)
  }
  lines.push(...platformLines(pm.bools, versionConstraints))
  lines.push(`  version = ${version}`)
  lines.push(`}`)
  return lines.join('\n') + '\n'
}

function buildDeclarationTerraform(): string {
  if (!declSchema.value) return ''

  const declType = declSchema.value.payload?.declarationtype ?? ''
  const decl = {
    Type: declType,
    Identifier: declIdentifier.value || 'com.example.declaration',
    ServerToken: declServerToken.value || genUuid(),
    Payload: declFormData.value,
  }

  const name = artifactName.value || declSchema.value.title || declIdentifier.value || 'Declaration'
  const slug = tfSlug(name || declIdentifier.value || 'declaration')
  const at = declarationArtifactType(declType)
  const pm = mapPlatforms(platformContext.platforms)

  const lines: string[] = []
  if (at.note) lines.push(`# Note: ${at.note}`)
  if (pm.dropped.length) {
    lines.push(`# Note: ${pm.dropped.join(', ')} — no Zentral MDM artifact platform equivalent; omitted.`)
  }
  lines.push(`resource "zentral_mdm_artifact" "${slug}" {`)
  lines.push(`  name      = ${tfString(name)}`)
  lines.push(`  type      = ${tfString(at.type)}`)
  lines.push(`  channel   = ${tfString(channel.value)}`)
  lines.push(`  platforms = ${tfStringArray(pm.platforms)}`)
  lines.push(`}`)
  lines.push(``)
  lines.push(`resource "zentral_mdm_declaration" "${slug}" {`)
  lines.push(`  artifact_id = zentral_mdm_artifact.${slug}.id`)
  lines.push(`  source      = jsonencode(${toHcl(decl, 2)})`)
  lines.push(...platformLines(pm.bools, versionConstraints))
  lines.push(`  version = ${artifactVersion.value}`)
  lines.push(`}`)
  return lines.join('\n') + '\n'
}

// ── Import .mobileconfig ───────────────────────────────────────────────────────
const PAYLOAD_META_KEYS = new Set([
  'PayloadType', 'PayloadVersion', 'PayloadIdentifier', 'PayloadUUID',
  'PayloadDisplayName', 'PayloadDescription', 'PayloadOrganization',
  'PayloadEnabled', 'PayloadScope',
])

// Fetch nav once so we can look up schemas by PayloadType
const { data: navData } = await useAsyncData('nav', () =>
  apiFetch<Array<{ id: string; urlPrefix: string; schemas: Array<{ slug: string; url: string }> }>>('/api/nav'),
)

async function schemaForPayloadType(payloadType: string): Promise<Record<string, any>> {
  const section = navData.value?.find(s => s.id === 'mdm-profiles')
  const match = section?.schemas.find(s => s.slug === payloadType)
  if (match) {
    try {
      return await apiFetch<Record<string, any>>(`/api/schema/mdm/profiles/${payloadType}`)
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

// ── Import Terraform (reverse builder) ───────────────────────────────────────────
const DECL_BUCKETS: Record<string, string> = {
  configuration: 'declarative/configurations',
  activation: 'declarative/activations',
  asset: 'declarative/assets',
  management: 'declarative/management',
}

async function schemaForDeclarationType(type: string): Promise<Record<string, any>> {
  const m = /^com\.apple\.(configuration|activation|asset|management)\.(.+)$/.exec(type || '')
  if (m) {
    try {
      return await apiFetch<Record<string, any>>(`/api/schema/${DECL_BUCKETS[m[1]]}/${m[2]}`)
    } catch { /* fall through to stub */ }
  }
  return { title: type, payload: { declarationtype: type }, payloadkeys: [], _unknown: true }
}

// Apply a parsed artifact (from paste or a repo folder) to the builder state.
// Mode is set first — the mode watcher clears the Terraform options, so metadata
// must be applied afterwards.
async function applyParsedArtifact(result: TfImportResult | RepoArtifact) {
  importNote.value = ''
  const src = result.kind === 'profile' ? result.profileSource : undefined

  if (result.kind === 'profile') {
    if ((src?.kind === 'xml' || src?.kind === 'template') && src.xml) {
      await handleImport(parsePlist(src.xml)) // sets mode = 'profile', payloads, metadata
    } else {
      mode.value = 'profile'
      payloads.value = []
      profileMeta.PayloadDisplayName = result.artifact.name ?? ''
      profileMeta.PayloadIdentifier = ''
      profileMeta.PayloadDescription = ''
      profileMeta.PayloadOrganization = ''
    }
    if (src && src.kind !== 'xml' && src.note) importNote.value = src.note
  } else {
    mode.value = 'declaration'
    const decl = result.declaration ?? {}
    declSchema.value = await schemaForDeclarationType(decl.Type ?? '')
    declIdentifier.value = decl.Identifier ?? ''
    declServerToken.value = decl.ServerToken ?? ''
    declFormData.value = decl.Payload ?? {}
  }

  // Apply the artifact metadata / Terraform options.
  outputFormat.value = 'terraform'
  artifactName.value = result.artifact.name ?? ''
  if (result.version != null) artifactVersion.value = result.version
  if (result.artifact.channel === 'Device' || result.artifact.channel === 'User') {
    channelOverride.value = result.artifact.channel
  }
  platformContext.platforms = platformsToBuilder(result.artifact.platforms, result.platformBools)
  externalFile.value = !!src?.external
  mobileconfigNameOverride.value = src?.fileName ?? ''
  for (const k of ['ios', 'ipados', 'macos', 'tvos'] as const) {
    versionConstraints[k].min = result.constraints[k]?.min ?? ''
    versionConstraints[k].max = result.constraints[k]?.max ?? ''
  }
}

async function handleTfImport(hcl: string) {
  await applyParsedArtifact(parseTerraform(hcl))
  showTfImport.value = false
}

// The parsed repo list persists so the import modal can be reopened to pick
// another artifact without re-selecting the folder.
const repoImport = ref<{ result: RepoParseResult; tfFileCount: number; mcFileCount: number } | null>(null)
const repoPickedLabel = ref('')

async function handleRepoImport(a: RepoArtifact) {
  await applyParsedArtifact(a)
  if (a.warnings?.length) importNote.value = [importNote.value, ...a.warnings].filter(Boolean).join(' · ')
  repoPickedLabel.value = a.label
  showRepoImport.value = false
}

// ── "Open in builder" from schema page ─────────────────────────────────────────
const route = useRoute()
const preloadPath = route.query.schema as string | undefined
if (preloadPath) {
  const data = await useAsyncData(`preload-${preloadPath}`, () =>
    apiFetch<Record<string, any>>(`/api/schema/${preloadPath}`),
  )
  if (data.data.value) {
    const schema = data.data.value
    if (schema.payload?.declarationtype) {
      mode.value = 'declaration'
      setDeclSchema(schema)
    } else if (schema.payload?.requesttype) {
      mode.value = 'command'
      setCmdSchema(schema)
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
          <h1 class="text-2xl font-bold text-ztl-anthracite mb-1">Builder</h1>
          <p class="text-ztl-anthracite/60 text-sm">Build and export Apple device management profiles, declarations, and commands.</p>
        </div>
        <div class="shrink-0 relative">
          <button
            class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-ztl-anthracite transition-colors bg-white"
            @click="showImportMenu = !showImportMenu"
          >📥 Import <span class="text-xs text-slate-400">▾</span></button>

          <div v-if="showImportMenu" class="fixed inset-0 z-40" @click="showImportMenu = false" />
          <div
            v-if="showImportMenu"
            class="absolute right-0 mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1"
          >
            <button class="w-full text-left px-3 py-2 text-sm text-ztl-anthracite hover:bg-slate-50 flex items-center gap-2" @click="showImportMenu = false; showImport = true">
              <span>📄</span><span>.mobileconfig file…</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-ztl-anthracite hover:bg-slate-50 flex items-center gap-2" @click="showImportMenu = false; showTfImport = true">
              <span>🧩</span><span>Terraform block…</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-ztl-anthracite hover:bg-slate-50 flex items-center gap-2" @click="showImportMenu = false; showRepoImport = true">
              <span>📁</span><span>Repo folder…</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Import note (e.g. external-file profiles) -->
      <div v-if="importNote" class="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <span>{{ importNote }}</span>
        <button class="ml-auto text-amber-500 hover:text-amber-700 leading-none" @click="importNote = ''">✕</button>
      </div>

      <!-- Mode tabs -->
      <div class="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          v-for="m in (['profile', 'declaration', 'command'] as Mode[])"
          :key="m"
          class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="mode === m
            ? 'bg-white text-ztl-anthracite shadow-sm'
            : 'text-slate-500 hover:text-ztl-anthracite'"
          @click="mode = m"
        >{{ m === 'profile' ? 'MDM Profile' : m === 'declaration' ? 'DDM Declaration' : 'MDM Command' }}</button>
      </div>

      <!-- Platform context bar -->
      <BuilderPlatformBar
        v-if="mode === 'profile' || mode === 'command' || (mode === 'declaration' && outputFormat === 'terraform')"
        v-model:platforms="platformContext.platforms"
        v-model:supervised="platformContext.supervised"
        v-model:enrollment="platformContext.enrollment"
        :channel="outputFormat === 'terraform' && mode !== 'command' ? channel : undefined"
        :channel-options="outputFormat === 'terraform' && mode !== 'command' ? channelInfo.allowed : undefined"
        @update:channel="(c) => channelOverride = (c as Channel)"
      />

      <!-- ── MDM Profile mode ── -->
      <template v-if="mode === 'profile'">
        <!-- Profile metadata -->
        <div class="rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-4 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-ztl-anthracite text-sm">
            Profile Metadata
          </div>
          <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div v-if="outputFormat === 'terraform'" class="sm:col-span-2">
              <label class="block text-xs font-medium text-slate-600 mb-1">Artifact Name <span class="text-slate-400 font-normal">— Zentral artifact label</span></label>
              <input v-model="artifactName" type="text" :placeholder="profileMeta.PayloadDisplayName || 'e.g. Corporate Wi-Fi'" class="builder-input" />
            </div>
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
      <template v-else-if="mode === 'declaration'">
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
              <div v-if="outputFormat === 'terraform'" class="sm:col-span-2">
                <label class="block text-xs font-medium text-slate-600 mb-1">Artifact Name <span class="text-slate-400 font-normal">— Zentral artifact label</span></label>
                <input v-model="artifactName" type="text" :placeholder="declSchema?.title || 'e.g. macOS 27 Beta Program'" class="builder-input" />
              </div>
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

      <!-- ── MDM Command mode ── -->
      <template v-else>
        <!-- Select type -->
        <div v-if="!cmdSchema" class="text-center py-10">
          <p class="text-slate-500 mb-4 text-sm">Choose a command type to get started.</p>
          <button
            class="px-5 py-2.5 bg-ztl-anthracite text-white rounded-lg font-medium hover:bg-ztl-anthracite/90 text-sm"
            @click="showPicker = true"
          >Select Command Type</button>
        </div>

        <template v-else>
          <!-- Command metadata -->
          <div class="rounded-xl border border-slate-200 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div>
                <span class="font-semibold text-ztl-anthracite text-sm">{{ cmdSchema.title }}</span>
                <code class="ml-2 font-mono text-xs text-slate-400">{{ cmdSchema.payload?.requesttype }}</code>
              </div>
              <button class="text-xs text-slate-400 hover:text-blue-600" @click="showPicker = true">Change</button>
            </div>
            <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Command UUID</label>
                <input v-model="cmdUuid" type="text" class="builder-input font-mono" />
              </div>
            </div>
          </div>

          <!-- Command payload keys -->
          <div v-if="(cmdSchema.payloadkeys ?? []).length" class="rounded-xl border border-slate-200 overflow-hidden">
            <div class="px-4 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-ztl-anthracite text-sm">Parameters</div>
            <div class="p-4 divide-y divide-slate-100">
              <BuilderFieldInput
                v-for="key in (cmdSchema.payloadkeys ?? [])"
                :key="key.key"
                :keyData="key"
                :platformContext="platformContext"
                :model-value="cmdFormData[key.key]"
                @update:model-value="(v) => { if (v === undefined) delete cmdFormData[key.key]; else cmdFormData[key.key] = v }"
              />
            </div>
          </div>
          <div v-else class="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            This command has no parameters.
          </div>
        </template>
      </template>

      <!-- ── Terraform artifact options ── -->
      <div v-if="outputFormat === 'terraform' && output" class="rounded-xl border border-slate-200 overflow-hidden">
        <div class="px-4 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-ztl-anthracite text-sm">Terraform Options</div>
        <div class="p-4 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Version</label>
              <input v-model.number="artifactVersion" type="number" min="1" step="1" class="builder-input" />
            </div>
          </div>

          <label v-if="mode === 'profile'" class="flex items-center gap-2 text-sm text-ztl-anthracite select-none cursor-pointer">
            <input v-model="externalFile" type="checkbox" class="rounded border-slate-300 text-ztl-cyan focus:ring-ztl-cyan" />
            Reference an external <code class="font-mono text-xs">.mobileconfig</code> via <code class="font-mono text-xs">filebase64()</code>
          </label>

          <div v-if="mode === 'profile' && externalFile">
            <label class="block text-xs font-medium text-slate-600 mb-1">Mobileconfig file name</label>
            <input v-model="mobileconfigNameOverride" type="text" :placeholder="mobileconfigFilename" class="builder-input font-mono" />
            <p class="text-xs text-slate-400 mt-1">Referenced by <code class="font-mono">filebase64()</code> and used for the companion download. Drop it into <code class="font-mono">mobileconfigs/</code>.</p>
          </div>

          <div v-if="activePlatforms.length">
            <div class="text-xs font-medium text-slate-600 mb-2">OS version constraints <span class="text-slate-400 font-normal">— optional, per platform</span></div>
            <div class="space-y-2">
              <div
                v-for="p in activePlatforms"
                :key="p"
                class="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-2"
              >
                <span class="text-xs font-medium text-slate-600">{{ PLATFORM_LABELS[p] }}</span>
                <input v-model="versionConstraints[p].min" type="text" placeholder="min (e.g. 14.0)" class="builder-input" />
                <input v-model="versionConstraints[p].max" type="text" placeholder="max (e.g. 18.0)" class="builder-input" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Right: Output ── -->
    <div
      class="w-full md:w-96 md:shrink-0 md:sticky md:top-8"
      :class="{ 'hidden md:block': mobileTab === 'form' }"
    >
      <!-- Output format toggle -->
      <div v-if="formatOptions.length > 1" class="flex gap-1 p-1 mb-3 bg-slate-100 rounded-xl w-fit">
        <button
          v-for="opt in formatOptions"
          :key="opt.value"
          class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="outputFormat === opt.value
            ? 'bg-white text-ztl-anthracite shadow-sm'
            : 'text-slate-500 hover:text-ztl-anthracite'"
          @click="outputFormat = opt.value"
        >{{ opt.label }}</button>
      </div>

      <div
        class="rounded-xl border border-slate-200 overflow-hidden flex flex-col"
        style="height: calc(100vh - 4rem); min-height: 400px;"
      >
        <BuilderOutputPanel
          v-if="output"
          :content="output"
          :filename="outputFilename"
          :label="outputLabel"
          :lang="outputLang"
          :extra="outputExtra"
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
    :platform-context="(mode === 'profile' || mode === 'command') ? platformContext : undefined"
    @select="(s) => { if (mode === 'profile') addPayload(s); else if (mode === 'command') setCmdSchema(s); else setDeclSchema(s) }"
    @close="showPicker = false"
  />

  <!-- Import modal -->
  <BuilderImportPanel
    v-if="showImport"
    @import="handleImport"
    @close="showImport = false"
  />

  <!-- Import Terraform modal -->
  <BuilderImportTfPanel
    v-if="showTfImport"
    @import="handleTfImport"
    @close="showTfImport = false"
  />

  <!-- Import repo folder modal -->
  <BuilderImportRepoPanel
    v-if="showRepoImport"
    :initial="repoImport"
    :picked-label="repoPickedLabel"
    @parsed="(p) => { repoImport = p; repoPickedLabel = '' }"
    @pick="handleRepoImport"
    @close="showRepoImport = false"
  />
</template>

<style>
.builder-input {
  @apply w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500;
}
</style>
