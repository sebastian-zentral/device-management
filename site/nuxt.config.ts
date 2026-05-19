import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

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

async function collectRoutes(dir: string, urlPrefix: string, rel = ''): Promise<string[]> {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return [] }
  const routes: string[] = []
  for (const e of entries) {
    if (e.isDirectory()) {
      routes.push(...await collectRoutes(join(dir, e.name), urlPrefix, rel ? `${rel}/${e.name}` : e.name))
    } else if (e.name.endsWith('.yaml')) {
      const slug = e.name.replace(/\.yaml$/, '')
      routes.push(`/${urlPrefix}/${rel ? `${rel}/${slug}` : slug}`)
    }
  }
  return routes
}

export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss', '@vite-pwa/nuxt'],
  tailwindcss: {
    configPath: './tailwind.config.ts',
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Apple Device Management',
      short_name: 'DevMgmt',
      description: 'Build and validate MDM profiles and Declarative Device Management configurations',
      theme_color: '#79C6BC',
      background_color: '#F5F4FF',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: null,
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    },
    client: {
      installPrompt: true,
    },
  },
  nitro: {
    prerender: {
      crawlLinks: false,
      routes: ['/', '/builder', '/validator'],
    },
  },
  hooks: {
    async 'nitro:config'(nitroConfig) {
      const repoRoot = resolve(process.cwd(), '..')
      const pageRoutes: string[] = []
      const apiRoutes: string[] = ['/api/nav']
      for (const s of SECTIONS) {
        pageRoutes.push(`/${s.urlPrefix}`)
        const itemRoutes = await collectRoutes(join(repoRoot, s.filePath), s.urlPrefix)
        pageRoutes.push(...itemRoutes)
        // Mirror each schema page as a static /api/schema/... JSON file
        for (const r of itemRoutes) apiRoutes.push(`/api/schema${r}`)
      }
      nitroConfig.prerender!.routes = [
        ...nitroConfig.prerender!.routes as string[],
        ...pageRoutes,
        ...apiRoutes,
      ]
    },
  },
})
