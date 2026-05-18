export interface Section {
  id: string
  label: string
  group: string
  urlPrefix: string
  filePath: string // relative to repo root (parent of site/)
}

export const SECTIONS: Section[] = [
  { id: 'mdm-commands',   label: 'Commands',       group: 'MDM Protocol', urlPrefix: 'mdm/commands',                filePath: 'mdm/commands' },
  { id: 'mdm-profiles',   label: 'Profiles',        group: 'MDM Protocol', urlPrefix: 'mdm/profiles',                filePath: 'mdm/profiles' },
  { id: 'mdm-checkin',    label: 'Check-in',        group: 'MDM Protocol', urlPrefix: 'mdm/checkin',                 filePath: 'mdm/checkin' },
  { id: 'mdm-errors',     label: 'Errors',          group: 'MDM Protocol', urlPrefix: 'mdm/errors',                  filePath: 'mdm/errors' },
  { id: 'decl-configs',   label: 'Configurations',  group: 'Declarative',  urlPrefix: 'declarative/configurations',  filePath: 'declarative/declarations/configurations' },
  { id: 'decl-activations', label: 'Activations',   group: 'Declarative',  urlPrefix: 'declarative/activations',     filePath: 'declarative/declarations/activations' },
  { id: 'decl-assets',    label: 'Assets',          group: 'Declarative',  urlPrefix: 'declarative/assets',          filePath: 'declarative/declarations/assets' },
  { id: 'decl-management',label: 'Management',      group: 'Declarative',  urlPrefix: 'declarative/management',      filePath: 'declarative/declarations/management' },
  { id: 'decl-status',    label: 'Status',          group: 'Declarative',  urlPrefix: 'declarative/status',          filePath: 'declarative/status' },
  { id: 'other',          label: 'Other',           group: 'Other',        urlPrefix: 'other',                       filePath: 'other' },
]

export const GROUPS = ['MDM Protocol', 'Declarative', 'Other']

export function findSection(urlPath: string): Section | undefined {
  // Sort by urlPrefix length descending to match the most specific prefix first
  return [...SECTIONS]
    .sort((a, b) => b.urlPrefix.length - a.urlPrefix.length)
    .find(s => urlPath === s.urlPrefix || urlPath.startsWith(s.urlPrefix + '/'))
}
