/**
 * Histórico de ajustes semanales/TXR/mensuales de garantías — estado compartido
 * entre las tabs de `AjustesXM` (un guardado en Semanales se refleja en el
 * Histórico) más las dos preferencias locales (PB anterior, menciones) que
 * alimentan el mensaje generado.
 */
import type { Id } from '~/types/api'
import type {
  AjusteGarantia,
  PayloadAjusteGarantia,
  TipoAjusteGarantia,
} from '~/features/garantias/types'
import { logger } from '~/core/logger'
import { normalizeError } from '~/core/errors'
import { AjustesGarantiaService } from '~/features/garantias/services/ajustes'
import type { HojaMadre } from './useGarantiasParser'

/** Forma que usan las vistas: camelCase, igual que el resto del slice. El backend habla en `snake_case` (ver `AjusteGarantia`). */
export interface AjusteGarantiaFE {
  id: Id
  tipo: TipoAjusteGarantia
  fecha: string
  pb: number | null
  restricciones: number | null
  stn: number | null
  trm: number | null
  ptb: number | null
  totalUNGC: number | null
  totalUNGG: number | null
  totalConsignar: number | null
  disponibleCustodia: number | null
  congelado: number | null
  saldo: number | null
  totalAjusteTXR: number | null
  snapshot: HojaMadre | null
  createdAt?: string
  updatedAt?: string
}

export type NuevoAjusteGarantiaFE = Omit<AjusteGarantiaFE, 'id' | 'createdAt' | 'updatedAt'>
export type CamposAjusteGarantiaFE = Partial<NuevoAjusteGarantiaFE>

function toFrontend(r: AjusteGarantia): AjusteGarantiaFE {
  return {
    id: r.id,
    tipo: r.tipo,
    fecha: r.fecha,
    pb: r.pb ?? null,
    restricciones: r.restricciones ?? null,
    stn: r.stn ?? null,
    trm: r.trm ?? null,
    ptb: r.ptb ?? null,
    totalUNGC: r.total_ungc ?? null,
    totalUNGG: r.total_ungg ?? null,
    totalConsignar: r.total_consignar ?? null,
    disponibleCustodia: r.disponible_custodia ?? null,
    congelado: r.congelado ?? null,
    saldo: r.saldo ?? null,
    totalAjusteTXR: r.total_ajuste_txr ?? null,
    snapshot: (r.snapshot as HojaMadre | null | undefined) ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// El backend guarda los montos y precios como decimales de 2 cifras y rechaza
// (400) cualquier valor con más; el snapshot conserva la precisión completa.
function aDecimal2(v: number | null | undefined): number | null | undefined {
  return v == null ? v : Math.round(v * 100) / 100
}

// Solo se incluyen los campos presentes en `r` (permite updates parciales):
// campo a campo y no en bucle, para no perder el tipo de cada valor.
function toBackend(r: CamposAjusteGarantiaFE): PayloadAjusteGarantia {
  const out: PayloadAjusteGarantia = {}
  if ('tipo' in r) out.tipo = r.tipo
  if ('fecha' in r) out.fecha = r.fecha
  if ('pb' in r) out.pb = aDecimal2(r.pb)
  if ('restricciones' in r) out.restricciones = aDecimal2(r.restricciones)
  if ('stn' in r) out.stn = aDecimal2(r.stn)
  if ('trm' in r) out.trm = aDecimal2(r.trm)
  if ('ptb' in r) out.ptb = aDecimal2(r.ptb)
  if ('totalUNGC' in r) out.total_ungc = aDecimal2(r.totalUNGC)
  if ('totalUNGG' in r) out.total_ungg = aDecimal2(r.totalUNGG)
  if ('totalConsignar' in r) out.total_consignar = aDecimal2(r.totalConsignar)
  if ('disponibleCustodia' in r) out.disponible_custodia = aDecimal2(r.disponibleCustodia)
  if ('congelado' in r) out.congelado = aDecimal2(r.congelado)
  if ('saldo' in r) out.saldo = aDecimal2(r.saldo)
  if ('totalAjusteTXR' in r) out.total_ajuste_txr = aDecimal2(r.totalAjusteTXR)
  if ('snapshot' in r) out.snapshot = r.snapshot
  return out
}

const PB_KEY = 'garantias_pb_anterior'
const MENCIONES_KEY = 'garantias_menciones'

export function useGarantiasHistorial() {
  const ajustesService = new AjustesGarantiaService()

  // Estado compartido: así un guardado en Semanales se refleja en el
  // Histórico sin que cada instancia del composable tenga su propia caché.
  const historial = useState<AjusteGarantiaFE[]>('garantias-historial', () => [])
  const loading = useState('garantias-historial-loading', () => false)
  const errorMsg = useState('garantias-historial-error', () => '')

  async function cargar() {
    loading.value = true
    errorMsg.value = ''
    try {
      const data = await ajustesService.listar()
      historial.value = Array.isArray(data) ? data.map(toFrontend) : []
    } catch (e) {
      logger.error('garantias', e)
      errorMsg.value = normalizeError(e).message
      historial.value = []
    } finally {
      loading.value = false
    }
  }

  async function guardar(registro: NuevoAjusteGarantiaFE) {
    const data = await ajustesService.crear(toBackend(registro))
    historial.value.unshift(toFrontend(data))
  }

  async function actualizar(id: Id, campos: CamposAjusteGarantiaFE) {
    const data = await ajustesService.actualizar(id, toBackend(campos))
    const idx = historial.value.findIndex((r) => r.id === id)
    if (idx !== -1) historial.value[idx] = toFrontend(data)
  }

  async function eliminar(id: Id) {
    await ajustesService.eliminar(id)
    historial.value = historial.value.filter((r) => r.id !== id)
  }

  function getPbAnterior(): number | null {
    const v = localStorage.getItem(PB_KEY)
    return v !== null ? parseFloat(v) : null
  }

  function setPbAnterior(v: number | null) {
    localStorage.setItem(PB_KEY, String(v))
  }

  function getMenciones(): string {
    return localStorage.getItem(MENCIONES_KEY) || ''
  }

  function setMenciones(v: string) {
    localStorage.setItem(MENCIONES_KEY, v)
  }

  return {
    historial,
    loading,
    errorMsg,
    cargar,
    guardar,
    actualizar,
    eliminar,
    getPbAnterior,
    setPbAnterior,
    getMenciones,
    setMenciones,
  }
}
