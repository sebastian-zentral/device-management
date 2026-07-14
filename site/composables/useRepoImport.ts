import type { RepoArtifact, RepoParseResult } from '~/utils/parseTerraform'

export interface RepoImportData {
  result: RepoParseResult
  tfFileCount: number
  mcFileCount: number
}

// App-wide shared state for a folder import, so the parsed artifact list can be
// shown both in the import modal and in the left sidebar, and picking one from
// anywhere loads it into the builder.
export function useRepoImport() {
  const data = useState<RepoImportData | null>('repoImport:data', () => null)
  const pickedLabel = useState<string>('repoImport:pickedLabel', () => '')
  // Bumped when the sidebar (or elsewhere) requests loading an artifact by label.
  const loadRequest = useState<{ label: string; n: number } | null>('repoImport:loadRequest', () => null)
  // Bumped when a bulk "export all" is requested.
  const exportRequest = useState<number>('repoImport:exportRequest', () => 0)

  function requestLoad(label: string) {
    loadRequest.value = { label, n: (loadRequest.value?.n ?? 0) + 1 }
  }

  function requestExport() {
    exportRequest.value++
  }

  return { data, pickedLabel, loadRequest, exportRequest, requestLoad, requestExport }
}

export type { RepoArtifact }
