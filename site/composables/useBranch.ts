import { loadBranches } from '~/utils/schemaData'

// Empty string = the branch bundled into the app at build time (served locally).
export const BUNDLED = ''

// App-wide selected schema branch + the list of available branches.
export function useBranch() {
  const branch = useState<string>('schema:branch', () => BUNDLED)
  const remote = useState<{ value: string; label: string }[]>('schema:remoteBranches', () => [])
  const loading = useState<boolean>('schema:branchesLoading', () => false)
  const error = useState<string>('schema:branchesError', () => '')

  const branches = computed(() => [
    { value: BUNDLED, label: 'Bundled (built-in)' },
    ...remote.value,
  ])

  // Fetch the branch list once, on the client.
  async function ensureBranches() {
    if (!import.meta.client || remote.value.length || loading.value) return
    loading.value = true
    error.value = ''
    try {
      remote.value = (await loadBranches()).filter(b => b.value !== 'main')
    } catch {
      // GitHub API unavailable (offline / rate-limited) — offer known branches.
      error.value = 'Could not list branches from GitHub'
      remote.value = [
        { value: 'release', label: 'release' },
        { value: 'seed_OS_27_0', label: 'seed_OS_27_0' },
      ]
    } finally {
      loading.value = false
    }
  }

  return { branch, branches, remote, loading, error, ensureBranches, BUNDLED }
}
