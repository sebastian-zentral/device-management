export function apiUrl(path: string): string {
  const base = useRuntimeConfig().app.baseURL || '/'
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path : '/' + path
  return b + p
}
