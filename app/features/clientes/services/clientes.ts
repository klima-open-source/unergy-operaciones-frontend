/** El cliente (inversionista o comprador): datos, documentos, tasas y sus registros relacionados. */
import type { Cliente, ClienteEditable } from '~/types/cliente'
import { comoLista, type ListaODirecto, type Paginado } from '~/types/api'
import type {
  ClienteDetalle,
  ClienteVistaComercial,
  ContactoCliente,
  ContratoPpaClienteResumen,
  DocumentoCliente,
  FronteraClienteResumen,
  PanelCliente,
  PayloadContactoCliente,
  PayloadDocumentoCliente,
  PayloadTasaServicioCliente,
  ProyectoClienteResumen,
  ServicioContratosResumen,
  TasaServicioCliente,
} from '~/features/clientes/types'
import { BaseService } from '~/core/service'

const BASE = '/clientes'

const RUTAS = {
  clientes: BASE,
  vistaComercial: `${BASE}/vista-comercial`,
  cliente: (id: number) => `${BASE}/${id}`,
  panel: (id: number) => `${BASE}/${id}/panel`,
  proyectos: (id: number) => `${BASE}/${id}/proyectos`,
  fronteras: (id: number) => `${BASE}/${id}/fronteras`,
  contratosPpa: (id: number) => `${BASE}/${id}/contratos-ppa`,
  serviciosContratos: (id: number) => `${BASE}/${id}/servicios-contratos`,
  tasasServicio: (id: number) => `${BASE}/${id}/tasas-servicio`,
  tasaServicio: (id: number) => `${BASE}/${id}/tasa-servicio`,
  tasaServicioItem: (id: number, tasaId: TasaServicioCliente['id']) =>
    `${BASE}/${id}/tasa-servicio/${tasaId}`,
  documentos: (id: number) => `${BASE}/${id}/documentos`,
  documento: (id: number, docId: DocumentoCliente['id']) => `${BASE}/${id}/documentos/${docId}`,
  archivoDocumento: (id: number, docId: DocumentoCliente['id']) =>
    `${BASE}/${id}/documentos/${docId}/archivo`,
  contactos: (id: number) => `${BASE}/${id}/contactos`,
  contacto: (id: number, contactoId: ContactoCliente['id']) =>
    `${BASE}/${id}/contactos/${contactoId}`,
  testCorreo: (id: number) => `${BASE}/${id}/test-correo`,
} as const

export class ClientesService extends BaseService {
  listarVistaComercial(): Promise<ClienteVistaComercial[]> {
    return this.get<ClienteVistaComercial[]>(RUTAS.vistaComercial)
  }

  /** El listado general (sin el read-model comercial), para selects de "elige un cliente". */
  async listar({ size = 200 }: { size?: number } = {}): Promise<Cliente[]> {
    const data = await this.get<ListaODirecto<Cliente>>(RUTAS.clientes, { query: { size } })
    return comoLista(data)
  }

  /** Igual que `listar`, pero sin desenvolver `Paginado`: para avisar cuando la página no trae todo. */
  listarPaginado({ page = 1, size = 200 }: { page?: number; size?: number } = {}): Promise<
    Paginado<Cliente>
  > {
    return this.get<Paginado<Cliente>>(RUTAS.clientes, { query: { page, size } })
  }

  /**
   * `razon_social_nombre` es el único campo que de verdad exige el backend; el
   * resto de `ClienteEditable` lo completa el formulario largo, pero el alta
   * rápida desde un wizard de contrato solo manda nombre, NIT y tipo.
   */
  crear(
    payload: Partial<ClienteEditable> & Pick<ClienteEditable, 'razon_social_nombre'>,
  ): Promise<ClienteDetalle> {
    return this.post<ClienteDetalle>(RUTAS.clientes, payload)
  }

  obtener(id: number): Promise<ClienteDetalle> {
    return this.get<ClienteDetalle>(RUTAS.cliente(id))
  }

  actualizar(id: number, payload: Partial<ClienteEditable>): Promise<unknown> {
    return this.patch<unknown>(RUTAS.cliente(id), payload)
  }

  eliminar(id: number): Promise<unknown> {
    return this.delete<unknown>(RUTAS.cliente(id))
  }

  obtenerPanel(id: number): Promise<PanelCliente> {
    return this.get<PanelCliente>(RUTAS.panel(id))
  }

  // ── Pestañas de registros relacionados ────────────────────────────────────────

  async listarProyectos(id: number): Promise<ProyectoClienteResumen[]> {
    const data = await this.get<ListaODirecto<ProyectoClienteResumen>>(RUTAS.proyectos(id))
    return comoLista(data)
  }

  async listarFronteras(id: number): Promise<FronteraClienteResumen[]> {
    const data = await this.get<ListaODirecto<FronteraClienteResumen>>(RUTAS.fronteras(id))
    return comoLista(data)
  }

  async listarContratosPpa(id: number): Promise<ContratoPpaClienteResumen[]> {
    const data = await this.get<ListaODirecto<ContratoPpaClienteResumen>>(RUTAS.contratosPpa(id))
    return comoLista(data)
  }

  listarServiciosContratos(id: number): Promise<ServicioContratosResumen[]> {
    return this.get<ServicioContratosResumen[]>(RUTAS.serviciosContratos(id))
  }

  // ── Tasas de servicio (excepciones tributarias) ───────────────────────────────

  listarTasasServicio(id: number): Promise<TasaServicioCliente[]> {
    return this.get<TasaServicioCliente[]>(RUTAS.tasasServicio(id))
  }

  guardarTasaServicio(id: number, payload: PayloadTasaServicioCliente): Promise<unknown> {
    return this.put<unknown>(RUTAS.tasaServicio(id), payload)
  }

  eliminarTasaServicio(id: number, tasaId: TasaServicioCliente['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.tasaServicioItem(id, tasaId))
  }

  // ── Documentos comerciales ───────────────────────────────────────────────────

  crearDocumento(id: number, payload: PayloadDocumentoCliente): Promise<DocumentoCliente> {
    return this.post<DocumentoCliente>(RUTAS.documentos(id), payload)
  }

  actualizarDocumento(
    id: number,
    docId: DocumentoCliente['id'],
    payload: PayloadDocumentoCliente,
  ): Promise<unknown> {
    return this.patch<unknown>(RUTAS.documento(id, docId), payload)
  }

  eliminarDocumento(id: number, docId: DocumentoCliente['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.documento(id, docId))
  }

  subirArchivoDocumento(
    id: number,
    docId: DocumentoCliente['id'],
    archivo: File,
  ): Promise<unknown> {
    const form = new FormData()
    form.append('archivo', archivo)
    return this.postFormData<unknown>(RUTAS.archivoDocumento(id, docId), form)
  }

  // ── Contactos (`ContactosPanel.vue`) ──────────────────────────────────────────

  listarContactos(id: number): Promise<ContactoCliente[]> {
    return this.get<ContactoCliente[]>(RUTAS.contactos(id))
  }

  crearContacto(id: number, payload: PayloadContactoCliente): Promise<ContactoCliente> {
    return this.post<ContactoCliente>(RUTAS.contactos(id), payload)
  }

  actualizarContacto(
    id: number,
    contactoId: ContactoCliente['id'],
    payload: PayloadContactoCliente,
  ): Promise<unknown> {
    return this.patch<unknown>(RUTAS.contacto(id, contactoId), payload)
  }

  eliminarContacto(id: number, contactoId: ContactoCliente['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.contacto(id, contactoId))
  }

  enviarCorreoPrueba(id: number, email: string): Promise<unknown> {
    return this.post<unknown>(RUTAS.testCorreo(id), { email })
  }
}
