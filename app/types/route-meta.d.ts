/**
 * El `meta` de ruta propio de esta app, más allá de lo que trae `vue-router`.
 *
 * `roles`/`requireEmail`/`public` desaparecieron con `legacy-auth.global.ts` en
 * la fase 3, ola 1: el acceso de página se decide en una matriz central
 * (`AUTH_ROUTE_PERMISSIONS`), no en el meta de cada página — así una página que
 * se olvida de declararse no queda abierta por accidente.
 *
 * `mobile` se queda: distingue la app móvil (`/m/*`), que tiene su propio login
 * y su propio layout, y lo sigue leyendo `app/middleware/mobile.global.ts`.
 */
declare module 'vue-router' {
  interface RouteMeta {
    /** Pertenece a la app móvil (`/m/*`): otro login y otro layout. */
    mobile?: boolean
  }
}

export {}
