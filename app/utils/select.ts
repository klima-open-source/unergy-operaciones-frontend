/**
 * Reka UI no admite `value=""` en un `SelectItem`: el string vacío es lo que limpia la
 * selección y muestra el placeholder. Para una opción explícita «Todos» / «Ninguno» se usa
 * este centinela, y el estado de la vista conserva `''` (o `null`) para decir «sin valor».
 */
export const VALOR_SELECT_VACIO = '__vacio__'

/** Estado de la vista → valor que ve el `Select`. */
export function aValorSelect(valor: string | null | undefined): string {
  return valor ? valor : VALOR_SELECT_VACIO
}

/** Valor que emite el `Select` → estado de la vista (`''` para el centinela). */
export function deValorSelect<T extends string = string>(valor: unknown): T | '' {
  return valor === VALOR_SELECT_VACIO || valor === undefined || valor === null
    ? ''
    : (String(valor) as T)
}
