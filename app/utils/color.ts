/** Converts a `#rrggbb` (or `rrggbb`) hex color to normalized `[r, g, b]` (0-1), for shader uniforms. */
export function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  const [, r, g, b] = match ?? []
  if (!r || !g || !b) return [1, 1, 1]
  return [Number.parseInt(r, 16) / 255, Number.parseInt(g, 16) / 255, Number.parseInt(b, 16) / 255]
}
