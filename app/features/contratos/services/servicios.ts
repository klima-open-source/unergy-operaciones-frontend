/**
 * Catálogo de grupos de servicio, servido por el backend.
 *
 * Existe para que la vista NO mantenga su propia lista de qué subservicios
 * cubre cada pestaña: esa definición vive una sola vez, en
 * `apps/contratos/services/grupos.py`. Ver `docs/SERVICIOS_AGRUPACION.md` en el
 * repo del backend.
 *
 * Importa sobre todo en Representación y CGM: un solo contrato cubre los dos
 * subservicios (91 de 94 al 2026-09-17) y `servicio_aplica` solo puede nombrar
 * uno, así que la lista de subservicios no se puede deducir de los datos de la
 * fila.
 */
import { BaseService } from '~/core/service'

/** Las claves de grupo del backend. Ojo: NO son las de las pestañas — ver
 * `GRUPO_POR_PESTANA` en `ServiciosUnificadoView.vue`. */
export type GrupoServicio = 'ppa' | 'representacion_cgm' | 'operacion'

export interface GrupoDelCatalogo {
  grupo: GrupoServicio
  subservicios: string[]
}

export class ServiciosService extends BaseService {
  /** Casi nunca cambia: se pide una vez al abrir la vista. */
  catalogo(): Promise<GrupoDelCatalogo[]> {
    return this.get<GrupoDelCatalogo[]>('/servicios/catalogo')
  }
}
