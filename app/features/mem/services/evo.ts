/** Datos de mercado (Evo): precio de bolsa spot y clima/ENSO — `BalanceView.vue`, `PrecioBolsaView.vue`, `ClimaView.vue`. */
import type {
  ClimaForecast,
  DailySpotLatest,
  RegistroClimaHistorico,
  RegistroDailySpot,
  RegistroOni,
  RegistroPrecioMensual,
  RegistroPrecipitacion,
} from '~/features/mem/types'
import { BaseService } from '~/core/service'

const RUTAS = {
  dailySpotHistory: '/evo/dailyspot/history',
  dailySpotLatest: '/evo/dailyspot/latest',
  climaHistory: '/evo/clima/history',
  climaForecast: '/evo/clima/forecast',
  climaPrices: '/evo/clima/prices',
  climaOni: '/evo/clima/oni',
  climaPrecip: '/evo/clima/precip',
} as const

export class EvoService extends BaseService {
  obtenerHistoricoSpot(days: number): Promise<RegistroDailySpot[]> {
    return this.get<RegistroDailySpot[]>(RUTAS.dailySpotHistory, { query: { days } })
  }

  obtenerSpotVigente(): Promise<DailySpotLatest> {
    return this.get<DailySpotLatest>(RUTAS.dailySpotLatest)
  }

  obtenerHistoricoClima(limit: number): Promise<RegistroClimaHistorico[]> {
    return this.get<RegistroClimaHistorico[]>(RUTAS.climaHistory, { query: { limit } })
  }

  obtenerPronosticoClima(): Promise<ClimaForecast> {
    return this.get<ClimaForecast>(RUTAS.climaForecast)
  }

  obtenerPreciosHistoricos(years: number): Promise<RegistroPrecioMensual[]> {
    return this.get<RegistroPrecioMensual[]>(RUTAS.climaPrices, { query: { years } })
  }

  obtenerOni(years: number): Promise<RegistroOni[]> {
    return this.get<RegistroOni[]>(RUTAS.climaOni, { query: { years } })
  }

  obtenerPrecipitacion(region: string, years: number): Promise<RegistroPrecipitacion[]> {
    return this.get<RegistroPrecipitacion[]>(RUTAS.climaPrecip, { query: { region, years } })
  }
}
