import { loadNav, type NavSection } from '~/utils/schemaData'

// Shared navigation index, reactive to the selected branch. Centralised so every
// consumer uses one cache key + handler (avoids duplicate-key warnings).
export function useNav() {
  const { branch } = useBranch()
  return useAsyncData<NavSection[]>('nav', () => loadNav(branch.value), {
    watch: [branch],
    default: () => [],
  })
}
