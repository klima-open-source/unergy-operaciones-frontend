import type {
  Oferta,
  Oportunidad,
  PayloadEditarOferta,
  PayloadFirmarOferta,
  PayloadRegistrarOportunidad,
} from '~/features/comercial/types'
import { ComercialService } from '~/features/comercial/services/comercial'
import { readDetail } from '~/core/errors'
import {
  agruparPorColumna,
  filtrar,
  kpis,
  ordenar,
  TIPOS_ENERGIA,
  type Banda,
  type FiltrosOfertas,
} from './comercial'

export interface ResultadoAccion {
  ok: boolean
  error?: string
}

interface DuplicadoCliente {
  candidato_id?: number
  candidato_nombre?: string
  mensaje?: string
  [clave: string]: unknown
}

/**
 * Estado compartido del módulo comercial: una sola carga de `/comercial/ofertas`
 * que alimentan el tablero, la tabla, la banda de indicadores y el drawer.
 *
 * Antes cada vista tenía su propia copia y sus propias constantes, así que
 * mover una tarjeta en el tablero no se reflejaba en la tabla hasta recargar.
 * Acá las mutaciones actualizan la fila EN LA LISTA con lo que devuelve el
 * backend, y ese objeto es el mismo que ve el drawer.
 */
export function useOfertas() {
  const comercialService = new ComercialService()
  const ofertas = ref<Oferta[]>([])
  const cargando = ref(false)
  const errorCarga = ref('')
  const alertaDias = ref<number | null>(null)

  const filtros = reactive<Required<FiltrosOfertas>>({
    texto: '',
    tipos: [],
    etapas: [],
    resultado: null,
    clientes: [],
    soloAlerta: false,
    soloSinRespuesta: false,
  })
  const orden = ref('reciente')

  const filtradas = computed(() => ordenar(filtrar(ofertas.value, filtros), orden.value))
  const porColumna = computed(() => agruparPorColumna(filtradas.value))
  // Los indicadores respetan los filtros: si filtrás por un offtaker, la banda
  // habla de ese offtaker. Un total que ignora el filtro se lee como el total
  // del negocio y hace tomar decisiones sobre el número equivocado.
  const banda = computed<Banda>(() => kpis(filtradas.value))

  const clientesDisponibles = computed(() => {
    const vistos = new Map<number, { id: number; nombre?: string }>()
    for (const o of ofertas.value) {
      if (o.cliente_id && !vistos.has(o.cliente_id)) {
        vistos.set(o.cliente_id, { id: o.cliente_id, nombre: o.cliente_razon_social })
      }
    }
    return [...vistos.values()].sort((a, b) =>
      (a.nombre || '').localeCompare(b.nombre || '', 'es'),
    )
  })

  const hayFiltros = computed(
    () =>
      !!filtros.texto ||
      filtros.tipos.length > 0 ||
      filtros.etapas.length > 0 ||
      !!filtros.resultado ||
      filtros.clientes.length > 0 ||
      filtros.soloAlerta ||
      filtros.soloSinRespuesta,
  )

  function limpiarFiltros() {
    filtros.texto = ''
    filtros.tipos = []
    filtros.etapas = []
    filtros.resultado = null
    filtros.clientes = []
    filtros.soloAlerta = false
    filtros.soloSinRespuesta = false
  }

  function mensaje(err: unknown, porDefecto: string): string {
    const e = err as { data?: unknown; message?: string } | undefined
    return readDetail(e?.data) ?? e?.message ?? porDefecto
  }

  async function cargar() {
    // Sin este try/catch la vista mentía: si /comercial/ofertas fallaba, la lista
    // quedaba vacía y la tabla decía "no hay ofertas con esos filtros", que se lee
    // como "no hay datos" y no como "el servidor se cayó".
    cargando.value = true
    errorCarga.value = ''
    try {
      const [ofs, cfg] = await Promise.all([
        comercialService.listarOfertas(),
        comercialService.obtenerConfig(),
      ])
      ofertas.value = ofs
      alertaDias.value = cfg.alerta_dias ?? null
    } catch (err) {
      errorCarga.value = mensaje(err, 'Error desconocido')
    } finally {
      cargando.value = false
    }
  }

  function indice(ofertaId: Oferta['id']): number {
    return ofertas.value.findIndex((o) => o.id === ofertaId)
  }

  /** Reemplaza la fila con lo que devolvió el backend, conservando los campos
   *  que solo trae la lista (cliente, alerta) y que los endpoints de una sola
   *  oferta no calculan. Sin esto, guardar una nota borraba el nombre del
   *  cliente de la tarjeta. */
  function fusionar(ofertaId: Oferta['id'], fresca: Oferta | null | undefined): Oferta | null {
    const i = indice(ofertaId)
    if (i < 0 || !fresca) return null
    ofertas.value[i] = { ...ofertas.value[i]!, ...fresca }
    return ofertas.value[i]!
  }

  async function moverEtapa(oferta: Oferta, estado: string): Promise<ResultadoAccion> {
    if (!oferta || !estado || oferta.estado === estado) return { ok: true }
    const previo = oferta.estado
    const i = indice(oferta.id)
    if (i >= 0) ofertas.value[i] = { ...ofertas.value[i]!, estado } // optimista
    try {
      const data = await comercialService.cambiarEstadoOferta(oferta.id, estado)
      fusionar(oferta.id, data)
      return { ok: true }
    } catch (err) {
      if (i >= 0) ofertas.value[i] = { ...ofertas.value[i]!, estado: previo }
      return { ok: false, error: mensaje(err, 'No se pudo cambiar la etapa') }
    }
  }

  async function guardarOferta(
    ofertaId: Oferta['id'],
    cambios: PayloadEditarOferta,
  ): Promise<ResultadoAccion & { oferta?: Oferta | null }> {
    try {
      const data = await comercialService.actualizarOferta(ofertaId, cambios)
      return { ok: true, oferta: fusionar(ofertaId, data) }
    } catch (err) {
      return { ok: false, error: mensaje(err, 'No se pudo guardar') }
    }
  }

  async function registrarSeguimiento(
    ofertaId: Oferta['id'],
  ): Promise<ResultadoAccion & { oferta?: Oferta | null }> {
    try {
      const data = await comercialService.registrarSeguimientoOferta(ofertaId)
      return { ok: true, oferta: fusionar(ofertaId, data) }
    } catch (err) {
      return { ok: false, error: mensaje(err, 'No se pudo registrar el seguimiento') }
    }
  }

  interface ArgsGestion {
    tipo: string | null
    descripcion: string
    ofertaId?: number | null
    /** Quién habló. Antes se perdía en este composable: se destructuraba sin
     *  reenviarlo, así que toda gestión registrada desde el tablero o el drawer
     *  quedaba sin dirección aunque el formulario la pidiera. */
    direccion?: string
  }

  /**
   * Una gestión en la bitácora. `ofertaId` la cuelga de esa oferta: es lo que
   * apaga SU alerta sin apagar la de sus hermanas del mismo cliente.
   */
  async function registrarGestion(
    oportunidadId: Oportunidad['id'],
    { tipo, descripcion, ofertaId = null, direccion }: ArgsGestion,
  ): Promise<ResultadoAccion> {
    try {
      await comercialService.registrarGestion(oportunidadId, {
        tipo,
        descripcion,
        oferta_id: ofertaId,
        ...(direccion ? { direccion } : {}),
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: mensaje(err, 'No se pudo registrar la gestión') }
    }
  }

  async function eliminarOferta(ofertaId: Oferta['id']): Promise<ResultadoAccion> {
    try {
      await comercialService.eliminarOferta(ofertaId)
      const i = indice(ofertaId)
      if (i >= 0) ofertas.value.splice(i, 1)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: mensaje(err, 'No se pudo eliminar') }
    }
  }

  async function firmar(ofertaId: Oferta['id'], payload: PayloadFirmarOferta) {
    try {
      const data = await comercialService.firmarOferta(ofertaId, payload)
      fusionar(ofertaId, data.oferta)
      return { ok: true as const, ...data }
    } catch (err) {
      return { ok: false as const, error: mensaje(err, 'No se pudo firmar') }
    }
  }

  /** Registro completo (cliente + oportunidad + ofertas) en una transacción. */
  async function registrar(payload: PayloadRegistrarOportunidad) {
    try {
      const data = await comercialService.registrar(payload)
      return { ok: true as const, oportunidad: data }
    } catch (err) {
      const e = err as { status?: number; data?: { detail?: DuplicadoCliente } } | undefined
      return {
        ok: false as const,
        error: mensaje(err, 'No se pudo registrar'),
        // El 409 de cliente duplicado trae el candidato: la UI ofrece usarlo en
        // vez de dejar al comercial trabado con un error rojo.
        duplicado: e?.status === 409 ? (e.data?.detail ?? null) : null,
      }
    }
  }

  const esDeEnergia = (oferta: Oferta | null | undefined) => TIPOS_ENERGIA.includes(oferta?.tipo ?? '')

  return {
    ofertas,
    cargando,
    errorCarga,
    alertaDias,
    filtros,
    orden,
    filtradas,
    porColumna,
    banda,
    clientesDisponibles,
    hayFiltros,
    limpiarFiltros,
    cargar,
    moverEtapa,
    guardarOferta,
    registrarSeguimiento,
    registrarGestion,
    eliminarOferta,
    firmar,
    registrar,
    esDeEnergia,
  }
}

export type UseOfertas = ReturnType<typeof useOfertas>
