/**
 * Lee colores del tema para APIs que no entienden `var(--token)`: Chart.js, canvas y SVG
 * generado como string. Devuelve el color resuelto (`oklch(...)`, `rgb(...)`) del token, así
 * que sigue al modo claro/oscuro. Solo cliente: la app corre con `ssr: false`.
 */
export type TokenColor =
  | 'foreground'
  | 'background'
  | 'card'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'muted'
  | 'muted-foreground'
  | 'accent'
  | 'border'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'chart-1'
  | 'chart-2'
  | 'chart-3'
  | 'chart-4'
  | 'chart-5'
  | 'unergy-purple'
  | 'unergy-deep'

export function useThemeColors() {
  const colorMode = useColorMode()

  /** Color resuelto del token; `alpha` (0–1) lo mezcla con transparente. */
  function color(token: TokenColor, alpha?: number): string {
    // Dependencia reactiva: el llamador (computed/watch) se re-evalúa al cambiar de tema.
    void colorMode.value
    const base = token.startsWith('unergy-') ? `--color-${token}` : `--${token}`
    const valor = getComputedStyle(document.documentElement).getPropertyValue(base).trim()
    if (alpha === undefined) return valor
    return `color-mix(in oklab, ${valor} ${Math.round(alpha * 100)}%, transparent)`
  }

  return { color }
}
