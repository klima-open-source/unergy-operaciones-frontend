/**
 * The half of the configuration that is not environment-driven.
 *
 * Everything here changes once per project, not once per deploy — so it is a
 * plain module, importable from anywhere including Nitro, with no `useRuntimeConfig()`
 * and no context to be inside of.
 *
 * The env-driven half lives in `runtimeConfig` (`nuxt.config.ts`) and is read
 * with `useRuntimeConfig()`: API base URLs, the auth feature flags and the
 * cookie options. That split is the Nuxt idiom, and it is also the honest one —
 * a value you would never change per environment does not belong in `.env`.
 */
export const APP_BRANDING = {
  name: 'Plataforma Operaciones',
  logo: '/favicon.png',
  favicon: '/favicon.png',
  seo: {
    title: 'Plataforma Operaciones',
    description: 'Plataforma de operaciones de Unergy.',
  },
} as const

/** Where an anonymous visitor is sent, and where a completed sign-in lands. */
export const AUTH_LOGIN_PATH = '/login'
export const AUTH_DEFAULT_REDIRECT_PATH = '/'

/** Colors of the animated gradient on the auth layout's hero panel. */
export const AUTH_HERO_GRADIENT_COLORS = {
  from: '#ffb1c1',
  via: '#271f9d',
  to: '#caff98',
} as const

/** Wordmark shown on the auth layout's hero panel. */
export const AUTH_LOGO = '/logos/Logo_avena.png'

/** The "U" icon shown at the top left of the auth layout, per color mode. */
export const AUTH_ICON = {
  light: '/logos/Icono_purpura_profundo.png',
  dark: '/logos/Icono_purpura_energico.png',
} as const
