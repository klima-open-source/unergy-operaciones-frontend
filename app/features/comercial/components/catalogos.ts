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
 *
 * Y ese paginado también recortaba: el backend corta cada página en 100 filas
 * (`TOPE_FILAS`), pero las páginas se contaban de a 500, así que 188 plantas
 * eran "una página" y llegaban 100. Ahora los dos salen de los listados
 * livianos (`/proyectos/lista`, `/clientes/lista`), que traen todo en una
 * petición sin paginar.
 */
import type { ClienteLiviano } from '~/types/cliente'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { clientes } from '~/features/clientes/services/catalogoClientes'

/** Las plantas del catálogo, con lo justo para reconocerlas en un selector. */
export interface ProyectoCatalogo {
  id: number
  nombre_comercial?: string
  municipio: string | null
  departamento: string | null
  estado: string | null
  potencia_ac_kw: number | null
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
export async function cargarProyectos(): Promise<ProyectoCatalogo[]> {
  const proyectosService = new ProyectosService()
  const filas = await proyectosService.listarLiviano()
  return filas
    .map((p) => ({
      id: p.id,
      nombre_comercial: p.nombre_comercial,
      municipio: p.municipio ?? null,
      departamento: p.departamento ?? null,
      estado: p.estado ?? null,
      // Un DecimalField: puede llegar como texto.
      potencia_ac_kw: p.potencia_ac_kw == null ? null : Number(p.potencia_ac_kw),
    }))
    .sort((a, b) => (a.nombre_comercial || '').localeCompare(b.nombre_comercial || '', 'es'))
}

/** Los clientes, para el paso 1 del registro. */
export function cargarClientes(): Promise<ClienteLiviano[]> {
  return clientes()
}
