export function apiUrl(path: string): string {
  const base = useRuntimeConfig().app.baseURL || '/'
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path : '/' + path
  return b + p
}

// Prerendered API files have no extension, so static hosts serve them as
// application/octet-stream — which makes ofetch return a Blob. Force JSON.
export function apiFetch<T = unknown>(path: string): Promise<T> {
  return $fetch<T>(apiUrl(path), { responseType: 'json' }) as Promise<T>
}
