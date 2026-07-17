import yaml from 'js-yaml'
import { SECTIONS, findSection } from '~/utils/sections'

// The upstream schema repository. The default ("bundled") branch is baked into
// the app at build time and served from /api/*; any other branch is fetched
// live from GitHub in the browser.
export const UPSTREAM_REPO = 'apple/device-management'

export interface NavSchema {
  slug: string
  title: string
  url: string
  platforms?: string[]
  constraints?: Record<string, any>
}
export interface NavSection {
  id: string
  label: string
  group: string
  urlPrefix: string
  schemas: NavSchema[]
}

// Apple's YAML uses self-referential anchors that js-yaml turns into cyclic
// objects; replace repeated nodes with a marker so they can be serialized/used.
function breakCycles(node: any, ancestors: WeakSet<object> = new WeakSet()): any {
  if (node === null || typeof node !== 'object') return node
  if (ancestors.has(node)) return { $recursive: true }
  ancestors.add(node)
  const result: any = Array.isArray(node)
    ? node.map(c => breakCycles(c, ancestors))
    : Object.fromEntries(Object.entries(node).map(([k, v]) => [k, breakCycles(v, ancestors)]))
  ancestors.delete(node)
  return result
}

const navCache = new Map<string, NavSection[]>()
const schemaCache = new Map<string, any>()

async function fetchTree(branch: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${UPSTREAM_REPO}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  const res = await $fetch<{ tree?: { path: string; type: string }[] }>(url)
  if (!res?.tree) throw new Error(`Could not read file tree for branch "${branch}"`)
  return res.tree.filter(n => n.type === 'blob' && n.path.endsWith('.yaml')).map(n => n.path)
}

/**
 * Navigation index. For the bundled branch ("") this is the prerendered
 * /api/nav (with platform/constraint metadata). For a remote branch it is built
 * from the GitHub file tree — titles fall back to the slug and there is no
 * platform metadata (which would require fetching every file).
 */
export async function loadNav(branch: string): Promise<NavSection[]> {
  if (!branch) return apiFetch<NavSection[]>('/api/nav')
  if (navCache.has(branch)) return navCache.get(branch)!

  const paths = await fetchTree(branch)
  const nav = SECTIONS.map((s) => {
    const prefix = s.filePath + '/'
    const schemas = paths
      .filter(p => p.startsWith(prefix))
      .map((p): NavSchema => {
        const slug = p.slice(prefix.length).replace(/\.yaml$/, '')
        return { slug, title: slug, url: `/${s.urlPrefix}/${slug}`, platforms: [], constraints: {} }
      })
      .sort((a, b) => a.slug.localeCompare(b.slug))
    return { id: s.id, label: s.label, group: s.group, urlPrefix: s.urlPrefix, schemas }
  }).filter(s => s.schemas.length)

  navCache.set(branch, nav)
  return nav
}

/** A single schema by its url path (e.g. "mdm/profiles/com.apple.wifi.managed"). */
export async function loadSchema(branch: string, urlPath: string): Promise<Record<string, any>> {
  const clean = urlPath.replace(/^\//, '')
  if (!branch) return apiFetch<Record<string, any>>(`/api/schema/${clean}`)

  const key = `${branch}:${clean}`
  if (schemaCache.has(key)) return schemaCache.get(key)

  const section = findSection(clean)
  if (!section) throw new Error(`Unknown schema path: ${clean}`)
  const slug = clean.slice(section.urlPrefix.length).replace(/^\//, '')
  const rawUrl = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${encodeURIComponent(branch)}/${section.filePath}/${slug}.yaml`
  const text = await $fetch<string>(rawUrl, { responseType: 'text' })
  const parsed = breakCycles(yaml.load(text)) as Record<string, any>
  schemaCache.set(key, parsed)
  return parsed
}

/** All branches of the upstream repo (for the branch switcher). */
export async function loadBranches(): Promise<{ value: string; label: string }[]> {
  const res = await $fetch<{ name: string }[]>(`https://api.github.com/repos/${UPSTREAM_REPO}/branches?per_page=100`)
  return (res ?? []).map(b => ({ value: b.name, label: b.name }))
}
