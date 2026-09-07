// Service worker de la app móvil "Unergy Solar".
// Se registra SOLO con scope '/m/', así que nunca controla las páginas de la
// plataforma. Estrategia: network-first con caché de respaldo para el shell.
// Los datos (/api) NUNCA se cachean — siempre van en vivo.

// `v2` desde el paso a Nuxt, y el número importa: `activate` borra toda caché
// cuyo nombre no sea este. La `v1` la llenó el build de Vite del legacy, y sus
// entradas apuntan a archivos que este build ya no publica (`/index.html`,
// `/assets/index-*.js`) — servirlas sin red daba una pantalla en blanco en vez
// de la app.
const CACHE = 'unergy-solar-v2'

// A dónde recurre una navegación sin red cuando la ruta pedida no está en
// caché. Nuxt corre como SPA: cualquiera de estas devuelve el mismo shell, así
// que sirve la primera que el dispositivo haya visitado. (El legacy recurría a
// '/index.html', que era el artefacto de Vite y aquí no existe.)
const SHELL_FALLBACKS = ['/m/solar', '/m/login']

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api')) return // datos siempre en vivo

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req)
        if (res && res.ok) {
          const cache = await caches.open(CACHE)
          cache.put(req, res.clone()).catch(() => {})
        }
        return res
      } catch (err) {
        const cached = await caches.match(req)
        if (cached) return cached
        if (req.mode === 'navigate') {
          for (const ruta of SHELL_FALLBACKS) {
            const shell = await caches.match(ruta)
            if (shell) return shell
          }
        }
        throw err
      }
    })(),
  )
})
