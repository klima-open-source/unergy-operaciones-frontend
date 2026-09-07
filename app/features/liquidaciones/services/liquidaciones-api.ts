/**
 * La API de Liquidaciones de Unergy, a través del proxy del backend.
 *
 * El navegador nunca habla con api.unergy.io: las credenciales de la cuenta de
 * servicio viven solo en el backend, que expone estas rutas bajo
 * `/liquidaciones-api`.
 */
import type {
  AccionCiclo,
  Catalogos,
  ConfigLiquidacionProyecto,
  DiagnosticoProyecto,
  FiltrosConsumo,
  FiltrosDespachos,
  OpcionesEsperaTarea,
  PayloadConfigLiquidacionProyecto,
  PayloadSubproyectoQuoia,
  PeriodoCiclo,
  ProyectoLiquidacionApi,
  RespuestaConsumo,
  RespuestaCostos,
  RespuestaDespachos,
  RespuestaFacturasXm,
  RespuestaSubidaFacturas,
  ResultadoTarea,
  SubproyectoQuoia,
  TareaEstado,
  TotalesAcPower,
  VersionCiclo,
} from '~/features/liquidaciones/types'
import type { QueryValue } from '@korastd/air'
import { BaseService } from '~/core/service'
import {
  EstadoTarea,
  TareaFallida,
  TareaSinRespuesta,
  VERSION_INICIAL,
} from '~/features/liquidaciones/types'

const BASE = '/liquidaciones-api'

const RUTAS = {
  tarea: (taskId: string) => `${BASE}/tareas/${taskId}`,
  facturasXm: `${BASE}/facturas-xm`,
  catalogos: `${BASE}/catalogos`,
  despachos: `${BASE}/despachos`,
  consumo: `${BASE}/consumo`,
  costos: `${BASE}/costos`,
  costosExcel: `${BASE}/costos/excel`,
  contratosEnergia: `${BASE}/contratos-energia`,
  ciclo: (accion: AccionCiclo | string) => `${BASE}/ciclo/${accion}`,
  cicloIpp: `${BASE}/ciclo/ipp`,
  ipp: `${BASE}/ipp`,
  cicloDiagnostico: `${BASE}/ciclo/diagnostico`,
  proyectos: `${BASE}/proyectos`,
  proyecto: (id: number) => `${BASE}/proyectos/${id}`,
  subproyecto: (topic: string) => `${BASE}/subproyectos/${encodeURIComponent(topic)}`,
  acPower: `${BASE}/ac-power`,
} as const

const ESPERA_POR_DEFECTO = {
  timeoutMs: 30 * 60 * 1000,
  intervaloMs: 5000,
} as const

const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

export class LiquidacionesApiService extends BaseService {
  // ── Proyectos ────────────────────────────────────────────────────────────────

  /** El listado plano de proyectos de esta API, identificados por `nombre_topico`. */
  listarProyectos(): Promise<ProyectoLiquidacionApi[]> {
    return this.get<ProyectoLiquidacionApi[]>(RUTAS.proyectos)
  }

  /** Totales de potencia AC y tópicos que no cruzaron con un proyecto propio. */
  obtenerAcPower(): Promise<TotalesAcPower> {
    return this.get<TotalesAcPower>(RUTAS.acPower)
  }

  /**
   * Los códigos SIC de un proyecto se guardan acá, no en la base propia — es la
   * única config del proyecto que vive en esta API.
   */
  obtenerConfigProyecto(id: number): Promise<ConfigLiquidacionProyecto> {
    return this.get<ConfigLiquidacionProyecto>(RUTAS.proyecto(id))
  }

  actualizarConfigProyecto(
    id: number,
    payload: PayloadConfigLiquidacionProyecto,
  ): Promise<unknown> {
    return this.patch<unknown>(RUTAS.proyecto(id), payload)
  }

  /**
   * Escribe los ids de Quoia de un subproyecto. Es un PATCH parcial de
   * verdad: lo que no se envía no se toca, y enviar `null` **borra** el id
   * (ver PayloadSubproyectoQuoia) — nunca mandes un campo "por si acaso".
   */
  actualizarSubproyecto(
    topic: string,
    payload: PayloadSubproyectoQuoia,
  ): Promise<SubproyectoQuoia> {
    return this.patch<SubproyectoQuoia>(RUTAS.subproyecto(topic), payload)
  }

  // ── Tareas asíncronas ──────────────────────────────────────────────────────

  /**
   * Sondea una tarea del ciclo hasta que termina.
   *
   * Hay dos trampas de la API que este método absorbe para que ninguna vista las
   * repita:
   *
   *  - `status: SUCCESS` no significa que salió bien; varias tareas devuelven
   *    `result.success = false`. El backend ya colapsa eso en `estado: 'fallo'`.
   *  - un `task_id` que no existe responde «en curso» para siempre, así que el
   *    límite de tiempo lo tiene que poner quien sondea. De ahí `timeoutMs`.
   *
   * @throws {TareaFallida} si la tarea terminó mal.
   * @throws {TareaSinRespuesta} si no hubo `task_id` o se agotó la espera.
   */
  async esperarTarea(
    taskId: string | undefined,
    opciones: OpcionesEsperaTarea = {},
  ): Promise<ResultadoTarea> {
    if (!taskId) throw new TareaSinRespuesta('La API no devolvió un identificador de tarea.')

    const {
      timeoutMs = ESPERA_POR_DEFECTO.timeoutMs,
      intervaloMs = ESPERA_POR_DEFECTO.intervaloMs,
      onEstado,
    } = opciones

    const limite = Date.now() + timeoutMs
    while (Date.now() < limite) {
      const estado = await this.get<TareaEstado>(RUTAS.tarea(taskId))
      onEstado?.(estado)
      if (estado.estado === EstadoTarea.EXITO) return estado.resultado || {}
      if (estado.estado === EstadoTarea.FALLO) throw new TareaFallida(estado.mensaje)
      await dormir(intervaloMs)
    }

    throw new TareaSinRespuesta(
      'La tarea no respondió a tiempo. Puede seguir corriendo: vuelve a consultar en unos minutos.',
    )
  }

  // ── Facturas de XM ─────────────────────────────────────────────────────────

  /** Facturas de XM del período, con su bloque de alistamiento. */
  listarFacturasXm(filtros: Record<string, QueryValue> = {}): Promise<RespuestaFacturasXm> {
    return this.get<RespuestaFacturasXm>(RUTAS.facturasXm, { query: filtros })
  }

  /** Sube un lote de facturas en PDF. El mes y el año los extrae la IA del PDF. */
  subirFacturasXm(
    archivos: File[],
    version: VersionCiclo = VERSION_INICIAL,
    { onProgreso }: { onProgreso?: (porcentaje: number) => void } = {},
  ): Promise<RespuestaSubidaFacturas> {
    const form = new FormData()
    for (const archivo of archivos) form.append('files', archivo)
    form.append('version', version)

    return this.postFormData<RespuestaSubidaFacturas>(RUTAS.facturasXm, form, onProgreso)
  }

  // ── Catálogos ──────────────────────────────────────────────────────────────

  /** Empresas, precios de energía y tipos de costo. Son datos fijos: se consultan. */
  listarCatalogos(): Promise<Catalogos> {
    return this.get<Catalogos>(RUTAS.catalogos)
  }

  // ── Despachos liquidados ───────────────────────────────────────────────────

  listarDespachos({
    month,
    year,
    version = VERSION_INICIAL,
  }: FiltrosDespachos): Promise<RespuestaDespachos> {
    return this.get<RespuestaDespachos>(RUTAS.despachos, { query: { month, year, version } })
  }

  // ── Consumo ─────────────────────────────────────────────────────────────────

  listarConsumo({
    month,
    year,
    version = VERSION_INICIAL,
    project,
    fecha,
  }: FiltrosConsumo): Promise<RespuestaConsumo> {
    return this.get<RespuestaConsumo>(RUTAS.consumo, {
      query: { month, year, version, project, fecha },
    })
  }

  // ── Costos e ingresos fijos ────────────────────────────────────────────────

  listarCostos(filtros: Record<string, QueryValue> = {}): Promise<RespuestaCostos> {
    return this.get<RespuestaCostos>(RUTAS.costos, { query: filtros })
  }

  /** Carga masiva de costos e ingresos fijos desde un Excel. Un archivo por llamada. */
  subirExcelCostos(
    archivo: File,
    { onProgreso }: { onProgreso?: (porcentaje: number) => void } = {},
  ): Promise<ResultadoTarea> {
    const form = new FormData()
    form.append('file', archivo)
    return this.postFormData<ResultadoTarea>(RUTAS.costosExcel, form, onProgreso)
  }

  // ── Contratos de energía ───────────────────────────────────────────────────

  listarContratosEnergia(): Promise<unknown[]> {
    return this.get<unknown[]>(RUTAS.contratosEnergia)
  }

  crearContratoEnergia(payload: Record<string, unknown>): Promise<unknown> {
    return this.post<unknown>(RUTAS.contratosEnergia, payload)
  }

  // ── Acciones del ciclo ─────────────────────────────────────────────────────

  /** IPP del DANE. Síncrono: devuelve el valor, no una tarea. */
  async consultarIpp({ month, year }: { month: number; year: number }): Promise<number> {
    const { ipp } = await this.post<{ ipp: number }>(RUTAS.cicloIpp, { month, year })
    return ipp
  }

  /**
   * Los IPP ya consultados. Hay una fila por consulta, no una por mes: la
   * marcada con `vigente` es la que manda.
   */
  listarIpp({ year, month }: { year?: number; month?: number } = {}): Promise<unknown[]> {
    return this.get<unknown[]>(RUTAS.ipp, { query: { year, month } })
  }

  /** Lanza una acción asíncrona del ciclo y espera a que termine. */
  async ejecutarAccionCiclo(
    accion: AccionCiclo,
    periodo: PeriodoCiclo,
    opciones?: OpcionesEsperaTarea,
  ): Promise<ResultadoTarea> {
    const { task_id } = await this.post<{ task_id: string }>(RUTAS.ciclo(accion), periodo)
    return this.esperarTarea(task_id, opciones)
  }

  /** Por qué un proyecto no sale en el estado de resultados. Síncrono. */
  diagnosticarProyecto({
    project,
    month,
    year,
    version = VERSION_INICIAL,
  }: DiagnosticoProyecto): Promise<unknown> {
    return this.post<unknown>(RUTAS.cicloDiagnostico, { project, month, year, version })
  }
}
