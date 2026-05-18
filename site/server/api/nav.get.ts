import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import yaml from 'js-yaml'

interface NavSchema {
  slug: string
  title: string
  url: string
}

interface NavSection {
  id: string
  label: string
  group: string
  urlPrefix: string
  schemas: NavSchema[]
}

const REPO_ROOT = join(process.cwd(), '..')

const SECTIONS = [
  { id: 'mdm-commands',    label: 'Commands',       group: 'MDM Protocol', urlPrefix: 'mdm/commands',               filePath: 'mdm/commands' },
  { id: 'mdm-profiles',    label: 'Profiles',       group: 'MDM Protocol', urlPrefix: 'mdm/profiles',               filePath: 'mdm/profiles' },
  { id: 'mdm-checkin',     label: 'Check-in',       group: 'MDM Protocol', urlPrefix: 'mdm/checkin',                filePath: 'mdm/checkin' },
  { id: 'mdm-errors',      label: 'Errors',         group: 'MDM Protocol', urlPrefix: 'mdm/errors',                 filePath: 'mdm/errors' },
  { id: 'decl-configs',    label: 'Configurations', group: 'Declarative',  urlPrefix: 'declarative/configurations', filePath: 'declarative/declarations/configurations' },
  { id: 'decl-activations',label: 'Activations',    group: 'Declarative',  urlPrefix: 'declarative/activations',    filePath: 'declarative/declarations/activations' },
  { id: 'decl-assets',     label: 'Assets',         group: 'Declarative',  urlPrefix: 'declarative/assets',         filePath: 'declarative/declarations/assets' },
  { id: 'decl-management', label: 'Management',     group: 'Declarative',  urlPrefix: 'declarative/management',     filePath: 'declarative/declarations/management' },
  { id: 'decl-status',     label: 'Status',         group: 'Declarative',  urlPrefix: 'declarative/status',         filePath: 'declarative/status' },
  { id: 'other',           label: 'Other',          group: 'Other',        urlPrefix: 'other',                      filePath: 'other' },
]

async function scanDir(dir: string, urlPrefix: string, relPath = ''): Promise<NavSchema[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const schemas: NavSchema[] = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sub = await scanDir(
        join(dir, entry.name),
        urlPrefix,
        relPath ? `${relPath}/${entry.name}` : entry.name,
      )
      schemas.push(...sub)
    } else if (entry.name.endsWith('.yaml')) {
      const slug = entry.name.replace(/\.yaml$/, '')
      const urlSlug = relPath ? `${relPath}/${slug}` : slug
      try {
        const raw = await readFile(join(dir, entry.name), 'utf-8')
        const parsed = yaml.load(raw) as { title?: string }
        schemas.push({
          slug: urlSlug,
          title: parsed?.title ?? urlSlug,
          url: `/${urlPrefix}/${urlSlug}`,
        })
      } catch {
        schemas.push({ slug: urlSlug, title: urlSlug, url: `/${urlPrefix}/${urlSlug}` })
      }
    }
  }
  return schemas
}

let cache: NavSection[] | null = null

export default defineEventHandler(async (): Promise<NavSection[]> => {
  if (cache) return cache

  const nav: NavSection[] = []
  for (const section of SECTIONS) {
    const dir = join(REPO_ROOT, section.filePath)
    const schemas = await scanDir(dir, section.urlPrefix)
    schemas.sort((a, b) => a.title.localeCompare(b.title))
    nav.push({
      id: section.id,
      label: section.label,
      group: section.group,
      urlPrefix: section.urlPrefix,
      schemas,
    })
  }
  cache = nav
  return nav
})
