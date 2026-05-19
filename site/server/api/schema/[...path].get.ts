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

// Some Apple schema YAMLs use anchor recursion (e.g. ApplicationItem referencing
// itself via `subkeys: *id001`). js-yaml resolves these into cyclic JS objects,
// which JSON.stringify can't serialize. Walk the tree and replace any node that
// appears as its own ancestor with a recursion marker.
function breakCycles(node: any, ancestors: WeakSet<object> = new WeakSet()): any {
  if (node === null || typeof node !== 'object') return node
  if (ancestors.has(node)) return { $recursive: true }
  ancestors.add(node)
  let result: any
  if (Array.isArray(node)) {
    result = node.map(child => breakCycles(child, ancestors))
  } else {
    result = {}
    for (const [k, v] of Object.entries(node)) result[k] = breakCycles(v, ancestors)
  }
  ancestors.delete(node)
  return result
}

export default defineEventHandler(async (event) => {
  const pathParam = getRouterParam(event, 'path')
  if (!pathParam) throw createError({ statusCode: 400, message: 'Missing path' })

  const section = [...SECTIONS]
    .sort((a, b) => b.urlPrefix.length - a.urlPrefix.length)
    .find(s => pathParam === s.urlPrefix || pathParam.startsWith(s.urlPrefix + '/'))

  if (!section) throw createError({ statusCode: 404, message: 'Section not found' })

  const slug = pathParam.slice(section.urlPrefix.length).replace(/^\//, '')
  const filePath = join(REPO_ROOT, section.filePath, `${slug}.yaml`)

  let raw: string
  try {
    raw = await readFile(filePath, 'utf-8')
  } catch {
    throw createError({ statusCode: 404, message: `Schema not found: ${slug}` })
  }
  return breakCycles(yaml.load(raw))
})
