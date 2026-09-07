/**
 * Los catálogos que el CRM lee de la plataforma: clientes y proyectos.
 *
 * Existe por un bug que dejaba los tres selectores del módulo comercial VACÍOS
 * y sin decir por qué. Las cuatro llamadas del módulo pedían `size: 1000`:
 *
 *   RegistrarOfertaWizard  /clientes?size=1000    → no salía la lista de clientes
 *   RegistrarOfertaWizard  /proyectos?size=1000   → no salía la lista de plantas
 *   OfertaDrawer           /proyectos?size=1000   → no se podía vincular un proyecto
 *   OfertasPanel           /proyectos?size=1000   → idem
 *
 * `size` está validado en el backend con `le=500` (app/api/v1/clientes.py y
 * proyectos.py), así que las cuatro respondían **422** y la lista quedaba en
 * cero. Era exclusivo de Comercial: las otras ~30 vistas de la plataforma piden
 * `size: 500` y funcionan.
 *
 * La consecuencia no era cosmética. Sin poder vincular la planta, toda oferta
 * nacía con `proyecto_id = NULL`, y `GET /comercial/proyectos-operando` —que
 * resuelve las plantas de cada contrato por la oferta— devolvía nodos con
 * `"proyectos": []`. La planta podía existir con todos sus datos cargados (La
 * Catedral, de la oferta OP.COM No.0021-1-2026) y la integración no la veía.
 *
 * Se pagina en vez de subir el número: hay más plantas que el tope de una
 * página, y un catálogo recortado en silencio es el mismo bug con otra cara —
 * la planta que buscás simplemente no está y no hay nada que lo indique.
 */
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ClientesService } from '~/features/clientes/services/clientes'

// El tope que acepta el backend. No subirlo: por encima responde 422.
const SIZE_MAX = 500
// Cortafuegos por si el total viniera absurdo: 20 páginas = 10.000 filas, muy
// por encima de cualquier catálogo real de la plataforma.
const MAX_PAGINAS = 20

/**
 * Todas las filas de un endpoint paginado, en orden. Trae la primera página y,
 * si hay más, el resto en paralelo.
 */
async function todasLasPaginas(listarPaginado) {
  const primera = await listarPaginado({ page: 1, size: SIZE_MAX })
  const items = [...(primera.items ?? [])]
  const total = primera.total ?? 0
  if (total <= items.length) return items

  const totalPaginas = Math.min(Math.ceil(total / SIZE_MAX), MAX_PAGINAS)
  if (totalPaginas <= 1) return items

  const resto = await Promise.all(
    Array.from({ length: totalPaginas - 1 }, (_, i) => listarPaginado({ page: i + 2, size: SIZE_MAX })),
  )
  return items.concat(...resto.map((r) => r.items ?? []))
}

/**
 * Las plantas de la tabla `proyectos`, con lo justo para reconocerlas en un
 * selector. El CRM no guarda datos de proyecto propios: lee de esta tabla o
 * crea filas en ella.
 *
 * Viajan municipio, departamento y potencia además del nombre porque los
 * selectores los usan para dos cosas: mostrarlos bajo cada opción y BUSCAR por
 * ellos (`filterFields`). Hay plantas homónimas en departamentos distintos, y
 * elegir a ciegas entre dos "San José" es cómo se termina vinculando la oferta
 * a la planta equivocada.
 */
export async function cargarProyectos() {
  const proyectosService = new ProyectosService()
  const filas = await todasLasPaginas((opts) => proyectosService.listarPaginado(opts))
  return filas
    .map((p) => ({
      id: p.id,
      nombre_comercial: p.nombre_comercial,
      municipio: p.municipio ?? null,
      departamento: p.departamento ?? null,
      estado: p.estado ?? null,
      potencia_instalada_kwp: p.potencia_instalada_kwp ?? null,
    }))
    .sort((a, b) => (a.nombre_comercial || '').localeCompare(b.nombre_comercial || '', 'es'))
}

/** Los clientes, para el paso 1 del registro. */
export async function cargarClientes() {
  const clientesService = new ClientesService()
  return todasLasPaginas((opts) => clientesService.listarPaginado(opts))
}
