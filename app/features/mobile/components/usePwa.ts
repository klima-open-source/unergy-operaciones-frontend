// Registra el service worker de la app móvil con scope '/m/'.
// Solo en producción (en dev el SW interfiere con el HMR de Vite).
export function usePwa() {
  function register(): void {
    if (!import.meta.env.PROD) return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw-mobile.js', { scope: '/m/' }).catch(() => {
      /* silencioso — la app funciona igual sin SW */
    })
  }
  return { register }
}
