/**
 * Lo que un proyecto de TSF prellena en `ProyectoForm`, y qué queda bloqueado.
 *
 * La regla: **un campo se bloquea solo si el dato vino de TSF y encajó** en lo que
 * Operaciones acepta. El operador de red se cruza por llave (`codigo_originabot`,
 * que `ImportarDesdeTsf` vincula antes de abrir el formulario); el nombre solo se
 * usa si TSF no trajo el code. Departamento, municipio y operador de red son catálogos
 * (DIVIPOLA, operadores de red): si TSF trae un nombre que no está, el campo
 * queda vacío y editable, y se avisa — bloquear un campo vacío dejaría el
 * proyecto sin ese dato para siempre.
 *
 * Lo derivado (el nombre comercial, sacado del código como hace `tsf_sync`) se
 * prellena pero no se bloquea: no es un dato de TSF.
 */
import type { ProyectoTsf } from '~/features/proyectos/types'
import { slugify } from '~/utils/string'

/** Los campos de `ProyectoForm` que TSF puede fijar. */
export type CampoTsf =
  'codigo_tsf' | 'tipo_proyecto' | 'departamento' | 'municipio' | 'coordenadas' | 'operador_red_id'

export interface OperadorRedCatalogo {
  id: number
  nombre_comercial?: string | null
  nombre_legal?: string | null
  codigo_originabot?: string | null
}

export interface PrellenadoTsf {
  valores: {
    nombre_comercial: string
    codigo_tsf: string | null
    origina_code: string
    origen: 'originabot'
    tipo_proyecto: string | null
    departamento: string | null
    municipio: string | null
    latitud: number | null
    longitud: number | null
    operador_red_id: number | null
  }
  bloqueados: CampoTsf[]
  /** Lo que TSF trae pero no encajó: «Departamento: "Cundinamarca D.C."». */
  sinCoincidencia: string[]
}

function buscar<T>(
  opciones: T[],
  nombre: string | null,
  nombreDe: (o: T) => (string | null | undefined)[],
): T | null {
  if (!nombre) return null
  const clave = slugify(nombre)
  return opciones.find((o) => nombreDe(o).some((n) => !!n && slugify(n) === clave)) ?? null
}

export function prellenadoDesdeTsf(
  tsf: ProyectoTsf,
  divipola: Record<string, string[]>,
  operadores: OperadorRedCatalogo[],
): PrellenadoTsf {
  const bloqueados: CampoTsf[] = []
  const sinCoincidencia: string[] = []

  const departamento = buscar(Object.keys(divipola), tsf.departamento, (d) => [d])
  if (departamento) bloqueados.push('departamento')
  else if (tsf.departamento) sinCoincidencia.push(`Departamento: «${tsf.departamento}»`)

  const municipio = departamento
    ? buscar(divipola[departamento] ?? [], tsf.municipio, (m) => [m])
    : null
  if (municipio) bloqueados.push('municipio')
  else if (tsf.municipio) sinCoincidencia.push(`Municipio: «${tsf.municipio}»`)

  const operador =
    (tsf.operadorRedCodigo
      ? operadores.find((o) => o.codigo_originabot === tsf.operadorRedCodigo)
      : null) ?? buscar(operadores, tsf.operadorRed, (o) => [o.nombre_comercial, o.nombre_legal])
  if (operador) bloqueados.push('operador_red_id')
  else if (tsf.operadorRed) sinCoincidencia.push(`Operador de red: «${tsf.operadorRed}»`)

  if (tsf.codigoTsf) bloqueados.push('codigo_tsf')
  if (tsf.tipoProyecto) bloqueados.push('tipo_proyecto')
  const conCoordenadas = tsf.latitud !== null && tsf.longitud !== null
  if (conCoordenadas) bloqueados.push('coordenadas')

  return {
    valores: {
      nombre_comercial: tsf.nombreSugerido,
      codigo_tsf: tsf.codigoTsf,
      origina_code: tsf.codigoOrigina,
      origen: 'originabot',
      tipo_proyecto: tsf.tipoProyecto,
      departamento,
      municipio,
      latitud: conCoordenadas ? tsf.latitud : null,
      longitud: conCoordenadas ? tsf.longitud : null,
      operador_red_id: operador?.id ?? null,
    },
    bloqueados,
    sinCoincidencia,
  }
}

/**
 * El proyecto de Operaciones que ya corresponde a este de TSF, si lo hay. Cruza
 * por los mismos dos códigos que `tsf_sync` (y `codigo_tsf` es único en la base):
 * importarlo otra vez sería el duplicado que esa sincronización evita.
 */
export function proyectoExistente<
  T extends { codigo_tsf?: string | null; origina_code?: string | null },
>(tsf: Pick<ProyectoTsf, 'codigoTsf' | 'codigoOrigina'>, proyectos: T[]): T | null {
  return (
    proyectos.find(
      (p) =>
        (!!tsf.codigoTsf && p.codigo_tsf === tsf.codigoTsf) ||
        (!!p.origina_code && p.origina_code === tsf.codigoOrigina),
    ) ?? null
  )
}
