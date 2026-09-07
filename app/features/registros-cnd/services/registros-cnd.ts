/** El proceso CND/ASIC de un proyecto: etapas, hitos, parámetros CREG 93, equipos y documentos. */
import type {
  CatalogosRegistroCnd,
  CorreoGenerado,
  DocumentoRegistroCnd,
  EquipoRegistroCnd,
  ParametrosCreg93,
  RegistroCnd,
  RespuestaRecomputarAlertas,
  ResumenRegistroCnd,
  ValidacionCreg93,
} from '~/features/registros-cnd/types'
import { BaseService } from '~/core/service'

const BASE = '/registros-cnd'

const RUTAS = {
  registros: BASE,
  porProyecto: (proyectoId: number | string) => `${BASE}/por-proyecto/${proyectoId}`,
  registro: (id: RegistroCnd['id']) => `${BASE}/${id}`,
  catalogos: `${BASE}/catalogos`,
  parametros93: (id: RegistroCnd['id']) => `${BASE}/${id}/parametros-93`,
  validacion93: (id: RegistroCnd['id']) => `${BASE}/${id}/validacion-93`,
  equipos: (id: RegistroCnd['id']) => `${BASE}/${id}/equipos`,
  equipo: (id: RegistroCnd['id'], equipoId: EquipoRegistroCnd['id']) =>
    `${BASE}/${id}/equipos/${equipoId}`,
  documentos: (id: RegistroCnd['id']) => `${BASE}/${id}/documentos`,
  documento: (id: RegistroCnd['id'], docId: DocumentoRegistroCnd['id']) =>
    `${BASE}/${id}/documentos/${docId}`,
  transicion: (id: RegistroCnd['id']) => `${BASE}/${id}/transicion`,
  recomputarAlertas: (id: RegistroCnd['id']) => `${BASE}/${id}/alertas/recomputar`,
  correo: (id: RegistroCnd['id'], tipo: string) => `${BASE}/${id}/correos/${tipo}`,
} as const

export class RegistrosCndService extends BaseService {
  listar(): Promise<ResumenRegistroCnd[]> {
    return this.get<ResumenRegistroCnd[]>(RUTAS.registros)
  }

  /** Crea el registro si el proyecto no tiene uno todavía; si ya existe, lo devuelve. */
  materializarPorProyecto(proyectoId: number | string): Promise<RegistroCnd> {
    return this.post<RegistroCnd>(RUTAS.porProyecto(proyectoId))
  }

  obtener(id: RegistroCnd['id']): Promise<RegistroCnd> {
    return this.get<RegistroCnd>(RUTAS.registro(id))
  }

  actualizar(id: RegistroCnd['id'], payload: Record<string, unknown>): Promise<unknown> {
    return this.patch<unknown>(RUTAS.registro(id), payload)
  }

  obtenerCatalogos(): Promise<CatalogosRegistroCnd> {
    return this.get<CatalogosRegistroCnd>(RUTAS.catalogos)
  }

  transicionar(id: RegistroCnd['id'], etapa: string, aEstado: string): Promise<RegistroCnd> {
    return this.post<RegistroCnd>(RUTAS.transicion(id), { etapa, a_estado: aEstado })
  }

  // ── Parámetros CREG 93 ───────────────────────────────────────────────────────

  obtenerParametros93(id: RegistroCnd['id']): Promise<ParametrosCreg93> {
    return this.get<ParametrosCreg93>(RUTAS.parametros93(id))
  }

  guardarParametros93(id: RegistroCnd['id'], payload: ParametrosCreg93): Promise<unknown> {
    return this.put<unknown>(RUTAS.parametros93(id), payload)
  }

  obtenerValidacion93(id: RegistroCnd['id']): Promise<ValidacionCreg93> {
    return this.get<ValidacionCreg93>(RUTAS.validacion93(id))
  }

  // ── Alertas ───────────────────────────────────────────────────────────────────

  recomputarAlertas(id: RegistroCnd['id']): Promise<RespuestaRecomputarAlertas> {
    return this.post<RespuestaRecomputarAlertas>(RUTAS.recomputarAlertas(id))
  }

  // ── Equipos de frontera ──────────────────────────────────────────────────────

  listarEquipos(id: RegistroCnd['id']): Promise<EquipoRegistroCnd[]> {
    return this.get<EquipoRegistroCnd[]>(RUTAS.equipos(id))
  }

  crearEquipo(id: RegistroCnd['id'], payload: Record<string, unknown>): Promise<EquipoRegistroCnd> {
    return this.post<EquipoRegistroCnd>(RUTAS.equipos(id), payload)
  }

  eliminarEquipo(id: RegistroCnd['id'], equipoId: EquipoRegistroCnd['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.equipo(id, equipoId))
  }

  // ── Documentos ───────────────────────────────────────────────────────────────

  listarDocumentos(id: RegistroCnd['id']): Promise<DocumentoRegistroCnd[]> {
    return this.get<DocumentoRegistroCnd[]>(RUTAS.documentos(id))
  }

  crearDocumento(
    id: RegistroCnd['id'],
    payload: Record<string, unknown>,
  ): Promise<DocumentoRegistroCnd> {
    return this.post<DocumentoRegistroCnd>(RUTAS.documentos(id), payload)
  }

  eliminarDocumento(id: RegistroCnd['id'], docId: DocumentoRegistroCnd['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.documento(id, docId))
  }

  // ── Correos ──────────────────────────────────────────────────────────────────

  generarCorreo(id: RegistroCnd['id'], tipo: string): Promise<CorreoGenerado> {
    return this.post<CorreoGenerado>(RUTAS.correo(id, tipo))
  }
}
