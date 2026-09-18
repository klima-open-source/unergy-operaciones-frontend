/**
 * Proyección de garantías: cuánto habrá que constituir en los próximos meses y
 * cuánto se lleva pagado.
 *
 * Los dos parámetros simulables (`plantasNuevas`, `kwhPlantaNueva`) viajan como
 * query, no como cuerpo — de ahí los `null` en el `post` y el `put`.
 */
import type {
  AtribucionGarantia,
  HistorialGarantias,
  PagoGarantia,
  ParametrosProyeccion,
  Proyecciones,
} from '~/features/garantias/types'
import { BaseService } from '~/core/service'

const BASE = '/garantias/proyecciones'

const RUTAS = {
  proyecciones: BASE,
  snapshot: `${BASE}/snapshot`,
  historial: `${BASE}/historial`,
  pagado: `${BASE}/pagado`,
  atribucion: `${BASE}/atribucion`,
} as const

/** Valores por defecto de la simulación, los mismos que traía el legacy. */
const PLANTAS_NUEVAS_POR_DEFECTO = 0
const KWH_PLANTA_NUEVA_POR_DEFECTO = 180

function aQuery({
  plantasNuevas = PLANTAS_NUEVAS_POR_DEFECTO,
  kwhPlantaNueva = KWH_PLANTA_NUEVA_POR_DEFECTO,
  corte,
}: ParametrosProyeccion = {}) {
  // `corte` solo viaja si está: sin él, el backend usa el corte de hoy.
  return {
    plantas_nuevas: plantasNuevas,
    kwh_planta_nueva: kwhPlantaNueva,
    ...(corte ? { corte } : {}),
  }
}

export class ProyeccionesGarantiasService extends BaseService {
  obtener(parametros: ParametrosProyeccion = {}): Promise<Proyecciones> {
    return this.get<Proyecciones>(RUTAS.proyecciones, { query: aQuery(parametros) })
  }

  /** Congela la proyección actual para poder compararla después. */
  guardarSnapshot(parametros: ParametrosProyeccion = {}): Promise<unknown> {
    return this.post<unknown>(RUTAS.snapshot, null, { query: aQuery(parametros) })
  }

  obtenerHistorial(): Promise<HistorialGarantias> {
    return this.get<HistorialGarantias>(RUTAS.historial)
  }

  registrarPago({ anio, mes, valor }: PagoGarantia): Promise<unknown> {
    return this.put<unknown>(RUTAS.pagado, null, { query: { anio, mes, valor } })
  }

  /**
   * Reparte la garantía del mes siguiente entre los contratos que la generan
   * (PLC + duplicados) y la guarda. `corte` replica un corte pasado.
   */
  calcularAtribucion(corte?: string): Promise<AtribucionGarantia> {
    return this.post<AtribucionGarantia>(
      RUTAS.atribucion, null, { query: corte ? { corte } : {} },
    )
  }
}
