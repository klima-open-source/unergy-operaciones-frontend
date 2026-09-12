/**
 * Fechas en hora de Colombia.
 *
 * `new Date().toISOString().slice(0, 10)` es la trampa que esto evita: da la
 * fecha en UTC, y Colombia es UTC−5. Entre las 19:00 y la medianoche de Bogotá
 * adelanta un día todo lo que dependa de "hoy" — en la ficha de Representación
 * eso hacía que la víspera de un aniversario ya mostrara la tarifa indexada.
 *
 * Se resta el desfase en vez de usar `Intl` con `timeZone: 'America/Bogota'`:
 * Colombia no tiene horario de verano, así que el corrimiento es fijo, y así no
 * se depende de que el runtime traiga los datos de zonas horarias.
 *
 * Hay dos copias anteriores de esta función —`app/features/solar/serieSolar.js`
 * y `ReporteEnergiaAutomatizacionView.vue`— que deberían converger acá; no se
 * tocan en este cambio para no arrastrar features ajenas.
 */

const DESFASE_COLOMBIA_MS = 5 * 60 * 60 * 1000

/** La fecha de hoy en Colombia (UTC−5), como `YYYY-MM-DD`. */
export function hoyColombia(): string {
  return new Date(Date.now() - DESFASE_COLOMBIA_MS).toISOString().slice(0, 10)
}
