/**
 * Generación Solar en vivo: los datos y las DECISIONES que comparten la vista
 * de escritorio (`SolarLiveView.vue`) y la app móvil (`MobileSolarView.vue`).
 *
 * Existe porque las dos vistas ya se separaron dos veces leyendo el mismo
 * endpoint (`GET /generacion-solar/monitoring/{id}`):
 *
 *   1. 2026-09-03 -- el detalle dejó de mandar `gaia_snapshot_*` y pasó a
 *      mandar `medidor` ya resuelto. El escritorio se corrigió, el móvil no,
 *      y su gráfica de medidores quedó vacía sin que nada fallara.
 *   2. 2026-09-05 -- el número grande del escritorio pasó a ser la ENERGÍA
 *      acumulada del día (`eae`, kWh) y el móvil se quedó mostrando la
 *      POTENCIA instantánea (`ap`, kW). Los dos números eran correctos y
 *      distintos, porque miden cosas distintas; visto de una pantalla a la
 *      otra parecía que uno estaba mal.
 *
 * El patrón es el mismo las dos veces: la lógica estaba copiada en los dos
 * archivos (`TIME_LABELS`, `gaiaTime` y `mapMinutes` eran duplicados literales)
 * y un cambio tocó una copia. Lo que vive acá no es solo utilería: es **qué
 * campo es el número de cada panel**, que es justo lo que divergió.
 */

// ── Ejes de tiempo ────────────────────────────────────────────────────────

/** Etiquetas cada 5 min (00:00–23:55) → 288 slots. */
export const TIME_LABELS = Array.from({ length: 288 }, (_, i) => {
  const h = Math.floor((i * 5) / 60)
  const m = (i * 5) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

/** Hora `HH:MM` de un timestamp de Gaia (medidor). */
export function gaiaTime(t) {
  if (!t) return ''
  const idx = t.indexOf('T')
  return idx >= 0 ? t.slice(idx + 1, idx + 6) : t.slice(0, 5)
}

/** Agrupa puntos en buckets de 5 min y promedia. */
export function mapMinutes(points, getTime, getKw) {
  const buckets = {}
  for (const pt of points) {
    const raw = getTime(pt)
    if (!raw) continue
    const m = raw.match(/(\d{1,2}):(\d{2})/)
    if (!m) continue
    const slot = parseInt(m[1], 10) * 12 + Math.floor(parseInt(m[2], 10) / 5)
    if (!buckets[slot]) buckets[slot] = []
    const v = getKw(pt)
    if (v != null) buckets[slot].push(v)
  }
  return TIME_LABELS.map((_, i) => {
    const arr = buckets[i]
    if (!arr?.length) return null
    return +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(3)
  })
}

// ── Curvas de potencia (kW) ───────────────────────────────────────────────

/**
 * El medidor a mostrar lo elige el BACKEND y llega resuelto en `medidor`.
 * Antes se re-decidía en cada vista, y podían mostrar medidores distintos.
 */
export function medidorDelDetalle(detail) {
  return detail?.medidor ?? null
}

/** Serie de inversores: 288 valores kW o null. */
export function inverterSeries(detail) {
  const curve = detail?.power_curve ?? []
  if (!curve.length) return null
  const data = mapMinutes(
    curve,
    (pt) => {
      const t = pt.time || ''
      return t.includes(' ') ? t.split(' ')[1] : t
    },
    (pt) => (pt.kw != null ? +pt.kw : null),
  )
  return data.every((v) => v == null) ? null : data
}

/**
 * Serie de medidor: 288 valores kW o null.
 *
 * `curva` viene sin rellenar y con el signo y la unidad ya resueltos por el
 * backend: si la telemetría de potencia se cayó, el hueco se ve.
 */
export function meterSeries(detail) {
  const rows = (medidorDelDetalle(detail)?.curva ?? []).filter((r) => r.kw != null)
  if (!rows.length) return null
  const data = mapMinutes(
    rows,
    (r) => gaiaTime(r.time),
    (r) => +r.kw,
  )
  return data.every((v) => v == null) ? null : data
}

/** Último valor no nulo de una serie (la potencia "de ahora"). */
export function latest(series) {
  if (!series) return null
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i]
  }
  return null
}

// ── El número de cada panel: ENERGÍA acumulada del día, en kWh ────────────
//
// No es la potencia instantánea, a propósito: es lo que alguien quiere saber
// de un vistazo, y no se cae a cero de noche. Las dos vistas tienen que usar
// estas dos funciones -- si una lee el campo crudo, vuelven a divergir.

/** Fecha de hoy en Colombia (UTC−5), `YYYY-MM-DD`. */
export function hoyColombia() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function horasEntre(t1, t2) {
  if (!t1 || !t2) return 0
  try {
    const aMin = (t) => {
      const s = t.replace('T', ' ').split(' ').pop()
      const [h, m] = s.split(':').map(Number)
      return h * 60 + (m || 0)
    }
    return Math.abs(aMin(t2) - aMin(t1)) / 60
  } catch {
    return 0
  }
}

/**
 * Generación acumulada de hoy según los INVERSORES, en kWh. null si no hay.
 *
 * Tres fuentes en orden de confianza:
 *   1. el total que calcula SolarView (`/generation/`), más preciso que
 *      integrar nosotros la curva;
 *   2. la fila de hoy del histórico de 30 días, si el día ya cerró;
 *   3. integración trapezoidal de la curva de potencia, último recurso.
 */
export function acumuladoInversores(detail, hoyStr = hoyColombia()) {
  const genHoy = detail?.generation_today_kwh
  if (genHoy != null && genHoy > 0) return genHoy

  const hoy = (detail?.generation_30d ?? []).find((d) => d.date === hoyStr)
  if (hoy?.kwh > 0) return hoy.kwh

  const curve = detail?.power_curve ?? []
  if (curve.length < 2) return null
  let kwh = 0
  for (let i = 1; i < curve.length; i++) {
    const dtH = horasEntre(curve[i - 1].time, curve[i].time)
    const avgKw = (+(curve[i - 1].kw || 0) + +(curve[i].kw || 0)) / 2
    kwh += avgKw * dtH
  }
  return kwh > 0 ? kwh : null
}

/** Energía acumulada de hoy según el MEDIDOR (contador `eae`), en kWh. */
export function acumuladoMedidor(detail) {
  const m = medidorDelDetalle(detail)
  return m?.energia_kwh > 0 ? m.energia_kwh : null
}

/** Hasta qué hora `HH:MM` cubre el acumulado de inversores. */
export function hastaInversores(detail) {
  return detail?.generation_today_hasta || null
}

/**
 * Hasta qué hora `HH:MM` cubre el acumulado del medidor.
 *
 * El contador reporta en intervalos más largos que la potencia, así que puede
 * ir hasta media hora por detrás -- se dice, en vez de dar a entender que es
 * del último instante.
 */
export function hastaMedidor(detail) {
  return gaiaTime(medidorDelDetalle(detail)?.energia_hasta ?? '') || null
}

// ── Formato ───────────────────────────────────────────────────────────────

/**
 * "hace 20 min" / "hace 4 h" a partir de un `HH:MM`. Cadena vacía si no
 * aplica.
 *
 * Es lo que separa "este proyecto no generó" de "este dato es viejo": sin
 * esto, una tarjeta congelada a las 06:15 se veía igual que una al día.
 */
export function haceCuanto(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '')
  if (!m) return ''
  const ahora = new Date()
  const dato = new Date(ahora)
  dato.setHours(+m[1], +m[2], 0, 0)
  const min = Math.floor((ahora - dato) / 60000)
  if (min < 0) return '' // reloj adelantado: mejor no decir nada
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.floor(min / 60)} h`
}

/** kW → "1.2 MW" / "312.0 kW" / "—". */
export function fmtKw(kw) {
  if (kw == null) return '—'
  if (kw >= 1000) return (kw / 1000).toFixed(1) + ' MW'
  return kw.toFixed(1) + ' kW'
}

/** kWh → "5.995 kWh" / "—", con separador de miles en es-CO. */
export function fmtKwh(kwh) {
  if (kwh == null) return '—'
  return kwh.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kWh'
}
