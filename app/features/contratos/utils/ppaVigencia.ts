/**
 * Estado de vigencia de un contrato PPA, derivado de sus fechas.
 *
 * Vive acá y no en cada vista porque lo usan dos pantallas que tienen que decir
 * lo mismo: el listado de /contratos?srv=ppa y el
 * detalle en /contratos/{id}. Si divergen, el usuario ve "Vigente" en la tabla
 * y otra cosa al entrar.
 *
 * OJO con `dias_restantes`: el detalle (`GET /ppa/{id}`) sí lo calcula en el
 * backend, pero el listado (`GET /ppa`) devuelve las filas del ORM tal cual y
 * el campo llega null. Por eso acá se usa si viene y, si no, se deriva de
 * `fecha_fin`; así la misma función sirve en las dos vistas.
 *
 * No hay columna `estado` en ppa_contratos: esto es un derivado de las fechas,
 * no un dato que alguien edite. Distinto de `estado_cumplimiento`, que mide si
 * el contrato está generando la energía comprometida.
 */

export interface PpaContrato {
  fecha_inicio?: string | null
  fecha_fin?: string | null
  dias_restantes?: number | null
}

export interface VigenciaPPA {
  clave: 'sin_fechas' | 'vencido' | 'por_iniciar' | 'por_vencer' | 'vigente'
  label: string
  color: string
  bg: string
  borde: string
  detalle: string
  // Ordena de lo más urgente a lo menos, para que la columna Estado ponga
  // arriba lo que hay que mirar.
  orden: number
}

// Umbral para avisar que un contrato se está acabando. Un trimestre es lo que
// el equipo necesita para alcanzar a renegociar o dar aviso de terminación.
const DIAS_POR_VENCER = 90

const MS_POR_DIA = 86400000

function soloFecha(v: string | null | undefined): string | null {
  if (!v) return null
  return String(v).slice(0, 10)
}

export function estadoVigenciaPPA(contrato: PpaContrato | null | undefined): VigenciaPPA {
  const sinFechas: VigenciaPPA = {
    clave: 'sin_fechas',
    label: 'Sin fechas',
    color: '#6b7280',
    bg: '#f9fafb',
    borde: '#e5e7eb',
    detalle: 'vigencia no registrada',
    orden: 4,
  }
  if (!contrato) return sinFechas

  const hoy = new Date().toISOString().slice(0, 10)
  const ini = soloFecha(contrato.fecha_inicio)
  const fin = soloFecha(contrato.fecha_fin)
  if (!ini && !fin) return sinFechas

  const dias =
    contrato.dias_restantes ??
    (fin
      ? Math.round(
          (new Date(`${fin}T00:00:00`).getTime() - new Date(`${hoy}T00:00:00`).getTime()) /
            MS_POR_DIA,
        )
      : null)

  if (fin && fin < hoy) {
    return {
      clave: 'vencido',
      label: 'Vencido',
      color: '#dc2626',
      bg: '#fef2f2',
      borde: '#fecaca',
      detalle:
        dias != null
          ? `venció hace ${Math.abs(dias).toLocaleString('es-CO')} días`
          : `venció el ${fin}`,
      orden: 0,
    }
  }

  if (ini && ini > hoy) {
    return {
      clave: 'por_iniciar',
      label: 'Por iniciar',
      color: '#4f46e5',
      bg: '#eef2ff',
      borde: '#c7d2fe',
      detalle: `inicia el ${ini}`,
      orden: 3,
    }
  }

  if (dias != null && dias <= DIAS_POR_VENCER) {
    return {
      clave: 'por_vencer',
      label: 'Por vencer',
      color: '#d97706',
      bg: '#fffbeb',
      borde: '#fde68a',
      detalle: `quedan ${dias.toLocaleString('es-CO')} días`,
      orden: 1,
    }
  }

  return {
    clave: 'vigente',
    label: 'Vigente',
    color: '#059669',
    bg: '#ecfdf5',
    borde: '#a7f3d0',
    detalle: dias != null ? `quedan ${dias.toLocaleString('es-CO')} días` : 'sin fecha de fin',
    orden: 2,
  }
}
