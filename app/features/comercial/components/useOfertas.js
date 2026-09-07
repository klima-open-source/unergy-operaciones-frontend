import { ref, reactive, computed } from 'vue'
import { ComercialService } from '~/features/comercial/services/comercial'
import {
  filtrar, ordenar, agruparPorColumna, kpis, TIPOS_ENERGIA,
} from './comercial.js'

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
  const ofertas = ref([])
  const cargando = ref(false)
  const errorCarga = ref('')
  const alertaDias = ref(null)

  const filtros = reactive({
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
  const banda = computed(() => kpis(filtradas.value))

  const clientesDisponibles = computed(() => {
    const vistos = new Map()
    for (const o of ofertas.value) {
      if (o.cliente_id && !vistos.has(o.cliente_id)) {
        vistos.set(o.cliente_id, { id: o.cliente_id, nombre: o.cliente_razon_social })
      }
    }
    return [...vistos.values()].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
  })

  const hayFiltros = computed(() =>
    !!filtros.texto || filtros.tipos.length > 0 || filtros.etapas.length > 0
    || !!filtros.resultado || filtros.clientes.length > 0
    || filtros.soloAlerta || filtros.soloSinRespuesta)

  function limpiarFiltros() {
    filtros.texto = ''
    filtros.tipos = []
    filtros.etapas = []
    filtros.resultado = null
    filtros.clientes = []
    filtros.soloAlerta = false
    filtros.soloSinRespuesta = false
  }

  function mensaje(err, porDefecto) {
    const det = err?.data?.detail
    if (typeof det === 'string') return det
    if (Array.isArray(det)) return det.map((e) => e.msg).filter(Boolean).join('; ') || porDefecto
    if (det && typeof det === 'object') return det.mensaje ?? det.msg ?? porDefecto
    return err?.message || porDefecto
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
      alertaDias.value = cfg.alerta_dias
    } catch (err) {
      errorCarga.value = mensaje(err, 'Error desconocido')
    } finally {
      cargando.value = false
    }
  }

  function indice(ofertaId) {
    return ofertas.value.findIndex((o) => o.id === ofertaId)
  }

  /** Reemplaza la fila con lo que devolvió el backend, conservando los campos
   *  que solo trae la lista (cliente, alerta) y que los endpoints de una sola
   *  oferta no calculan. Sin esto, guardar una nota borraba el nombre del
   *  cliente de la tarjeta. */
  function fusionar(ofertaId, fresca) {
    const i = indice(ofertaId)
    if (i < 0 || !fresca) return null
    ofertas.value[i] = { ...ofertas.value[i], ...fresca }
    return ofertas.value[i]
  }

  async function moverEtapa(oferta, estado) {
    if (!oferta || !estado || oferta.estado === estado) return { ok: true }
    const previo = oferta.estado
    const i = indice(oferta.id)
    if (i >= 0) ofertas.value[i] = { ...ofertas.value[i], estado } // optimista
    try {
      const data = await comercialService.cambiarEstadoOferta(oferta.id, estado)
      fusionar(oferta.id, data)
      return { ok: true }
    } catch (err) {
      if (i >= 0) ofertas.value[i] = { ...ofertas.value[i], estado: previo }
      return { ok: false, error: mensaje(err, 'No se pudo cambiar la etapa') }
    }
  }

  async function guardarOferta(ofertaId, cambios) {
    try {
      const data = await comercialService.actualizarOferta(ofertaId, cambios)
      return { ok: true, oferta: fusionar(ofertaId, data) }
    } catch (err) {
      return { ok: false, error: mensaje(err, 'No se pudo guardar') }
    }
  }

  async function registrarSeguimiento(ofertaId) {
    try {
      const data = await comercialService.registrarSeguimientoOferta(ofertaId)
      return { ok: true, oferta: fusionar(ofertaId, data) }
    } catch (err) {
      return { ok: false, error: mensaje(err, 'No se pudo registrar el seguimiento') }
    }
  }

  /**
   * Una gestión en la bitácora. `ofertaId` la cuelga de esa oferta: es lo que
   * apaga SU alerta sin apagar la de sus hermanas del mismo cliente.
   */
  async function registrarGestion(oportunidadId, { tipo, descripcion, ofertaId = null }) {
    try {
      await comercialService.registrarGestion(oportunidadId, { tipo, descripcion, oferta_id: ofertaId })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: mensaje(err, 'No se pudo registrar la gestión') }
    }
  }

  async function eliminarOferta(ofertaId) {
    try {
      await comercialService.eliminarOferta(ofertaId)
      const i = indice(ofertaId)
      if (i >= 0) ofertas.value.splice(i, 1)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: mensaje(err, 'No se pudo eliminar') }
    }
  }

  async function firmar(ofertaId, payload) {
    try {
      const data = await comercialService.firmarOferta(ofertaId, payload)
      fusionar(ofertaId, data.oferta)
      return { ok: true, ...data }
    } catch (err) {
      return { ok: false, error: mensaje(err, 'No se pudo firmar') }
    }
  }

  /** Registro completo (cliente + oportunidad + ofertas) en una transacción. */
  async function registrar(payload) {
    try {
      const data = await comercialService.registrar(payload)
      return { ok: true, oportunidad: data }
    } catch (err) {
      return {
        ok: false,
        error: mensaje(err, 'No se pudo registrar'),
        // El 409 de cliente duplicado trae el candidato: la UI ofrece usarlo en
        // vez de dejar al comercial trabado con un error rojo.
        duplicado: err?.status === 409 ? err.data?.detail : null,
      }
    }
  }

  const esDeEnergia = (oferta) => TIPOS_ENERGIA.includes(oferta?.tipo)

  return {
    ofertas, cargando, errorCarga, alertaDias,
    filtros, orden, filtradas, porColumna, banda, clientesDisponibles, hayFiltros, limpiarFiltros,
    cargar, moverEtapa, guardarOferta, registrarSeguimiento, registrarGestion,
    eliminarOferta, firmar, registrar, esDeEnergia,
  }
}
