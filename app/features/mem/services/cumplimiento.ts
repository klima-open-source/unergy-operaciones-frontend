/**
 * Cumplimiento de contratos PPA: datos anuales por contrato, simulador,
 * plantas/contratos, balance de energía, energía transada, matriz anual y
 * descubrimientos. Consumido por `CumplimientoV2View.vue` y
 * `DescubrimientosView.vue` — cada uno cachea la respuesta en `localStorage`
 * por su cuenta, así que esta clase solo hace la llamada.
 */
import type {
  AnualCumplimientoPpa,
  BalanceEnergiaCumplimiento,
  ContratoCumplimientoPpa,
  DescubrimientosCumplimiento,
  DetalleAnualMatrizContrato,
  EnergiaTransadaCumplimiento,
  PlantasContratosCumplimiento,
  ResumenAnualPpa,
  RespuestaAnualMatrizContratos,
  SimuladorCumplimiento,
} from '~/features/mem/types'
import { BaseService } from '~/core/service'

const BASE = '/cumplimiento'

const RUTAS = {
  ppa: `${BASE}/ppa`,
  anualPorContrato: (id: ContratoCumplimientoPpa['id']) => `${BASE}/ppa/${id}/anual`,
  resumenAnual: `${BASE}/ppa/resumen-anual`,
  simulador: `${BASE}/simulador`,
  plantasContratos: `${BASE}/plantas-contratos`,
  balanceEnergia: `${BASE}/balance-energia`,
  energiaTransada: `${BASE}/energia-transada`,
  anualMatrizContratos: `${BASE}/anual-matriz/contratos`,
  anualMatrizContrato: (id: ContratoCumplimientoPpa['id']) => `${BASE}/anual-matriz/contrato/${id}`,
  descubrimientos: `${BASE}/descubrimientos`,
} as const

export class CumplimientoService extends BaseService {
  listarPpa(filtros: { incluir_todos: boolean }): Promise<ContratoCumplimientoPpa[]> {
    return this.get<ContratoCumplimientoPpa[]>(RUTAS.ppa, { query: { ...filtros } })
  }

  obtenerAnualPorContrato(
    id: ContratoCumplimientoPpa['id'],
    filtros: { year: number },
  ): Promise<AnualCumplimientoPpa> {
    return this.get<AnualCumplimientoPpa>(RUTAS.anualPorContrato(id), { query: { ...filtros } })
  }

  obtenerResumenAnual(filtros: { year: number; incluir_todos: boolean }): Promise<ResumenAnualPpa> {
    return this.get<ResumenAnualPpa>(RUTAS.resumenAnual, { query: { ...filtros } })
  }

  obtenerSimulador(filtros: {
    year: number
    month: number
    incluir_todos: boolean
  }): Promise<SimuladorCumplimiento> {
    return this.get<SimuladorCumplimiento>(RUTAS.simulador, { query: { ...filtros } })
  }

  obtenerPlantasContratos(filtros: {
    year: number
    month: number
    incluir_todos: boolean
  }): Promise<PlantasContratosCumplimiento> {
    return this.get<PlantasContratosCumplimiento>(RUTAS.plantasContratos, { query: { ...filtros } })
  }

  /** El mes en curso se consulta sin caché y con más margen — el backend agrega en vivo. */
  obtenerBalanceEnergia(
    filtros: {
      year: number
      month: number
      excluir_compra_externa: boolean
      incluir_todos: boolean
    },
    timeoutMs = 60_000,
  ): Promise<BalanceEnergiaCumplimiento> {
    return this.get<BalanceEnergiaCumplimiento>(RUTAS.balanceEnergia, {
      query: { ...filtros },
      signal: () => AbortSignal.timeout(timeoutMs),
    })
  }

  obtenerEnergiaTransada(filtros: {
    year: number
    month: number
    incluir_todos: boolean
  }): Promise<EnergiaTransadaCumplimiento> {
    return this.get<EnergiaTransadaCumplimiento>(RUTAS.energiaTransada, {
      query: { ...filtros },
      signal: () => AbortSignal.timeout(180_000),
    })
  }

  obtenerAnualMatrizContratos(filtros: {
    year: number
    incluir_todos: boolean
  }): Promise<RespuestaAnualMatrizContratos> {
    return this.get<RespuestaAnualMatrizContratos>(RUTAS.anualMatrizContratos, {
      query: { ...filtros },
    })
  }

  obtenerAnualMatrizContrato(
    id: ContratoCumplimientoPpa['id'],
    filtros: { year: number },
  ): Promise<DetalleAnualMatrizContrato> {
    return this.get<DetalleAnualMatrizContrato>(RUTAS.anualMatrizContrato(id), {
      query: { ...filtros },
      signal: () => AbortSignal.timeout(90_000),
    })
  }

  obtenerDescubrimientos(filtros: {
    year: number
    month_from: number
    month_to: number
  }): Promise<DescubrimientosCumplimiento> {
    return this.get<DescubrimientosCumplimiento>(RUTAS.descubrimientos, { query: { ...filtros } })
  }
}
