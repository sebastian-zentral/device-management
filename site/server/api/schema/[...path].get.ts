import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import yaml from 'js-yaml'

const REPO_ROOT = join(process.cwd(), '..')

const SECTIONS = [
  { urlPrefix: 'mdm/commands',               filePath: 'mdm/commands' },
  { urlPrefix: 'mdm/profiles',               filePath: 'mdm/profiles' },
  { urlPrefix: 'mdm/checkin',                filePath: 'mdm/checkin' },
  { urlPrefix: 'mdm/errors',                 filePath: 'mdm/errors' },
  { urlPrefix: 'declarative/configurations', filePath: 'declarative/declarations/configurations' },
  { urlPrefix: 'declarative/activations',    filePath: 'declarative/declarations/activations' },
  { urlPrefix: 'declarative/assets',         filePath: 'declarative/declarations/assets' },
  { urlPrefix: 'declarative/management',     filePath: 'declarative/declarations/management' },
  { urlPrefix: 'declarative/status',         filePath: 'declarative/status' },
  { urlPrefix: 'other',                      filePath: 'other' },
]

export default defineEventHandler(async (event) => {
  const pathParam = getRouterParam(event, 'path')
  if (!pathParam) throw createError({ statusCode: 400, message: 'Missing path' })

  const section = [...SECTIONS]
    .sort((a, b) => b.urlPrefix.length - a.urlPrefix.length)
    .find(s => pathParam === s.urlPrefix || pathParam.startsWith(s.urlPrefix + '/'))

  if (!section) throw createError({ statusCode: 404, message: 'Section not found' })

  const slug = pathParam.slice(section.urlPrefix.length).replace(/^\//, '')
  const filePath = join(REPO_ROOT, section.filePath, `${slug}.yaml`)

  try {
    const raw = await readFile(filePath, 'utf-8')
    return yaml.load(raw)
  } catch {
    throw createError({ statusCode: 404, message: `Schema not found: ${slug}` })
  }
})
