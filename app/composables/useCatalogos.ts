/**
 * Los catálogos chicos que llenan desplegables en varias vistas, compartidos con
 * `useCatalogoCompartido`: una petición por catálogo cada 5 minutos en vez de una
 * por vista que se monta.
 *
 * Las pantallas que los administran (Operadores de red, Portafolios, los
 * patrimonios de un cliente) siguen pidiendo su lista directo —ahí se quiere lo
 * último— y llaman a `invalidar()` después de cada cambio.
 */
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import { PortafoliosService } from '~/features/operaciones/services/portafolios'
import { PatrimoniosService } from '~/features/clientes/services/patrimonios'

export function useCatalogoOperadoresRed() {
  const servicio = new OperadoresRedService()
  return useCatalogoCompartido('operadores-red', () => servicio.listar())
}

export function useCatalogoPortafolios() {
  const servicio = new PortafoliosService()
  return useCatalogoCompartido('portafolios', () => servicio.listar())
}

export function useCatalogoPatrimonios() {
  const servicio = new PatrimoniosService()
  return useCatalogoCompartido('patrimonios', () => servicio.listar())
}
