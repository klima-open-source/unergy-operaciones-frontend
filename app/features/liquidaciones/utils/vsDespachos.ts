/**
 * Las columnas del Excel «Ingresos vs. despachos»: lo que DEBE entrar por
 * proyecto contra lo que ya se liquidó en despachos.
 *
 * Viven acá y no dentro del `.vue` para poder fijarlas con una prueba: es un
 * archivo que se cruza con contabilidad, y una columna que cambia de sentido en
 * silencio —o que pierde su signo— no se nota hasta que alguien concilia.
 *
 * Las dos cifras las calcula el backend (`GET /facturacion/vs-despachos`); acá
 * solo se ordenan y se nombran. Lo liquidado suma `dispatch` (contrato) y
 * `dispatch_fazni` (la venta en bolsa) de TODOS los contratos del proyecto, y
 * **no resta las compras en bolsa**: esas van en su propia columna, informativa.
 */
import type { ColumnaExportable } from '~/utils/exportarExcel'

export interface FilaVsDespachos {
  proyecto_id: number | null
  proyecto: string | null
  topico: string | null
  contratos_sic: string[]
  kwh_facturacion: number
  debe_ingresar_ppa: number
  ingreso_bolsa: number
  debe_ingresar: number
  kwh_sin_valorizar: number
  lineas_sin_valorizar: number
  kwh_despachos: number
  liquidado_despachos: number
  compras_bolsa: number
  diferencia: number
}

export interface RespuestaVsDespachos {
  periodo: string
  bolsa_precio: number | null
  resumen: Record<string, number>
  results: FilaVsDespachos[]
}

export const columnasVsDespachos: ColumnaExportable<FilaVsDespachos>[] = [
  { header: 'Proyecto', value: f => f.proyecto || '' },
  { header: 'Tópico (API)', value: f => f.topico || '' },
  { header: 'Contratos SIC', value: f => (f.contratos_sic || []).join(', ') },
  { header: 'kWh facturados', value: f => f.kwh_facturacion },
  { header: 'Debe ingresar - PPA (COP)', value: f => f.debe_ingresar_ppa },
  { header: 'Debe ingresar - bolsa (COP)', value: f => f.ingreso_bolsa },
  { header: 'Debe ingresar (COP)', value: f => f.debe_ingresar },
  { header: 'kWh liquidados', value: f => f.kwh_despachos },
  { header: 'Liquidado despachos + bolsa (COP)', value: f => f.liquidado_despachos },
  { header: 'Compras en bolsa (no restadas)', value: f => f.compras_bolsa },
  { header: 'Diferencia (COP)', value: f => f.diferencia },
  // Un proyecto con energía que no se pudo valorizar tiene el «debe ingresar»
  // incompleto. Sin esta columna ese hueco se lee como un faltante de plata.
  { header: 'kWh sin valorizar', value: f => f.kwh_sin_valorizar },
]

/** Nombre del archivo, con el mes adentro para que no se pisen entre sí. */
export function nombreArchivoVsDespachos(periodo: string): string {
  return `Ingresos_vs_despachos_${(periodo || '').slice(0, 7)}.xlsx`
}
