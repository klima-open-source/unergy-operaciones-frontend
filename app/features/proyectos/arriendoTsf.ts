/**
 * «Sincronizar con TSF», parte del arriendo: qué cambiaría en el contrato de
 * arrendamiento del proyecto y en su lista de arrendadores.
 *
 * - El contrato es el del proyecto que ya apunta al de TSF
 *   (`originabot_arriendo_id`) o, si no, el primero de arriendo sin vínculo (el
 *   que muestra la pestaña Arriendos). Si no hay ninguno, se propone crearlo.
 * - El canon es el anual del terreno entre sus proyectos, en partes iguales.
 * - Cada propietario de TSF es un arrendador con su porcentaje; su valor es
 *   canon × % / 100, y uno al 0 % queda inactivo.
 * - Un arrendador de Operaciones que TSF ya no tiene se propone DESACTIVAR, no
 *   borrar: su historial de pagos sigue siendo suyo.
 *
 * Los clientes de los arrendadores todavía pueden no existir: aquí van como el id
 * del propietario en TSF (`deLandlord`) y la pantalla los resuelve al aplicar,
 * después de confirmar los que hay que crear.
 */
import type { Arrendador, ContratoServicio, PayloadArrendador } from '~/features/contratos/types'
import type { ArrendadorTsf, ArriendoTsf } from '~/features/proyectos/types'
import { formatCOP } from '~/utils/currency'

/** Qué pasaría con el cliente de un propietario (`POST /clientes/originabot-arrendador?simular`). */
export interface ClienteDeArrendador {
  estado: 'existente' | 'vinculado' | 'creado'
  /** null = hay que crearlo. */
  id: number | null
  razon_social_nombre: string
}

export interface CampoArriendo {
  clave: string
  etiqueta: string
  actualTexto: string
  propuestoTexto: string
  valor: unknown
  /** `valor` es el id de un propietario de TSF: se cambia por su cliente al aplicar. */
  deLandlord?: boolean
}

export interface PlanContratoArriendo {
  /** null = crear. */
  id: number | null
  cambios: CampoArriendo[]
  /** Por qué no se puede crear (sin arrendatario, sin quien recibe el pago…). */
  faltan: string[]
}

export interface AccionArrendador {
  tipo: 'crear' | 'actualizar' | 'desactivar'
  /** El arrendador de Operaciones; null al crear. */
  id: number | null
  nombre: string
  landlord: ArrendadorTsf | null
  cambios: CampoArriendo[]
}

export interface PlanArriendo {
  /** null = el contrato ya coincide con TSF. */
  contrato: PlanContratoArriendo | null
  arrendadores: AccionArrendador[]
  /** Lo que TSF no tiene y hay que llenar a mano. */
  nota: string | null
}

/** En TSF ningún propietario tiene porcentaje: no se desactiva a nadie. */
export const NOTA_SIN_PAGO =
  'En TSF ningún propietario tiene porcentaje del canon, así que los arrendadores actuales de Operaciones se dejan activos.'

/** TSF solo tiene el PDF: lo que la persona tiene que leer de él. */
export const NOTA_SOLO_DOCUMENTO =
  'En TSF este contrato solo está como PDF firmado («(S) Contrato de arrendamiento»), sin termsheet: el canon, la fecha de firma y la periodicidad no están como datos. Llénalos a mano leyendo el PDF.'

export interface ContextoArriendo {
  /** Por id de propietario en TSF. */
  clientes: Record<number, ClienteDeArrendador>
  /** El arrendatario: el inversionista principal del proyecto. */
  arrendatario: { id: number; nombre: string } | null
}

const VACIO = '—'
const cop = (v: unknown) => formatCOP(v as number | string | null)
const PERIODICIDADES: Record<string, string> = {
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

const clave = (s: string | null | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** `b` es el valor de TSF; `a`, el de Operaciones (un DecimalField llega como «15732000.0000»). */
function iguales(a: unknown, b: unknown): boolean {
  if (a == null || a === '') return false
  if (typeof b === 'number') return Math.abs(Number(a) - b) < 0.01
  return String(a) === String(b)
}

/** El contrato de arriendo de Operaciones que corresponde al de TSF. */
export function contratoDeArriendo(
  tsf: ArriendoTsf,
  contratos: ContratoServicio[],
): ContratoServicio | null {
  return (
    contratos.find((c) => c.originabot_arriendo_id === tsf.contratoId) ??
    contratos.find((c) => !c.originabot_arriendo_id) ??
    null
  )
}

function nombreCliente(ctx: ContextoArriendo, landlord: ArrendadorTsf): string {
  const c = ctx.clientes[landlord.id]
  if (!c) return landlord.nombre
  return c.id === null ? `${landlord.nombre} (cliente nuevo)` : c.razon_social_nombre
}

function campos(
  candidatos: [string, string, unknown, unknown, ((v: unknown) => string)?, boolean?][],
): CampoArriendo[] {
  const cambios: CampoArriendo[] = []
  for (const [k, etiqueta, actual, valor, fmt = String, deLandlord] of candidatos) {
    if (valor === null || valor === undefined) continue
    if (!deLandlord && iguales(actual, valor)) continue
    cambios.push({
      clave: k,
      etiqueta,
      actualTexto: actual == null || actual === '' ? VACIO : fmt(actual),
      propuestoTexto: fmt(valor),
      valor,
      ...(deLandlord ? { deLandlord } : {}),
    })
  }
  return cambios
}

function planContrato(
  tsf: ArriendoTsf,
  actual: ContratoServicio | null,
  ctx: ContextoArriendo,
): PlanContratoArriendo | null {
  const receptor =
    tsf.arrendadores.find((a) => a.recibePago) ??
    [...tsf.arrendadores]
      .filter((a) => a.porcentaje > 0)
      .sort((a, b) => b.porcentaje - a.porcentaje)[0] ??
    null
  const faltan: string[] = []
  if (!actual && !ctx.arrendatario) {
    faltan.push('El proyecto no tiene inversionista: no hay arrendatario para el contrato.')
  }
  if (!actual && !receptor) {
    faltan.push('En TSF ningún propietario recibe el pago: no hay arrendador para el contrato.')
  }

  // El prestador (quien recibe el pago) y el arrendatario solo se llenan si faltan:
  // uno que una persona ya eligió no se reemplaza.
  const prestador = receptor && !actual?.prestador_id ? receptor.id : null
  const cambios = campos([
    [
      'originabot_arriendo_id',
      'Contrato en TSF',
      actual?.originabot_arriendo_id,
      tsf.contratoId,
      (v) => `#${v}`,
    ],
    ['fecha_firma_contrato', 'Fecha de firma', actual?.fecha_firma_contrato, tsf.fechaFirma],
    // Solo si no tiene enlace: uno que una persona puso (p. ej. el Drive) no se pisa.
    [
      'enlace_drive',
      'Contrato firmado',
      actual?.enlace_drive,
      actual?.enlace_drive ? null : tsf.enlace,
      () => 'PDF en TSF',
    ],
    ['tarifa_base', 'Canon anual', actual?.tarifa_base, tsf.canonAnual, cop],
    [
      'periodicidad_pago',
      'Periodicidad de pago',
      actual?.periodicidad_pago,
      tsf.periodicidad,
      (v) => PERIODICIDADES[String(v)] ?? String(v),
    ],
    [
      'estado',
      'Estado',
      actual?.estado,
      tsf.firmado ? 'firmado' : null,
      (v) => (v === 'firmado' ? 'Firmado' : String(v)),
    ],
    [
      'contratante_id',
      'Arrendatario',
      actual?.contratante_nombre,
      actual?.contratante_id ? null : (ctx.arrendatario?.id ?? null),
      (v) => (typeof v === 'number' ? (ctx.arrendatario?.nombre ?? `#${v}`) : String(v)),
    ],
    [
      'prestador_id',
      'Arrendador que recibe el pago',
      actual?.prestador_nombre,
      prestador,
      (v) => (typeof v === 'number' && receptor ? nombreCliente(ctx, receptor) : String(v)),
      true,
    ],
  ])
  if (actual && !cambios.length) return null
  return { id: actual?.id ?? null, cambios, faltan }
}

function arrendadorDe(
  landlord: ArrendadorTsf,
  actuales: Arrendador[],
  ctx: ContextoArriendo,
  usados: Set<number>,
): Arrendador | null {
  const libres = actuales.filter((a) => !usados.has(a.id))
  const porLlave = libres.find((a) => a.originabot_landlord_id === landlord.id)
  if (porLlave) return porLlave
  const sinLlave = libres.filter((a) => !a.originabot_landlord_id)
  const cliente = ctx.clientes[landlord.id]?.id
  const porCliente = cliente != null ? sinLlave.find((a) => a.cliente_id === cliente) : undefined
  if (porCliente) return porCliente
  const porNombre = sinLlave.filter((a) => clave(a.nombre) === clave(landlord.nombre))
  return porNombre.length === 1 ? porNombre[0]! : null
}

function camposArrendador(
  landlord: ArrendadorTsf,
  actual: Arrendador | null,
  tsf: ArriendoTsf,
  ctx: ContextoArriendo,
): CampoArriendo[] {
  const cliente = ctx.clientes[landlord.id]
  const valor =
    tsf.canonAnual === null ? null : Math.round((tsf.canonAnual * landlord.porcentaje) / 100)
  const si = (v: unknown) => (v ? 'Activo' : 'Inactivo')
  return campos([
    ['nombre', 'Nombre', actual?.nombre, landlord.nombre],
    [
      'cliente_id',
      'Cliente',
      actual?.cliente_id,
      cliente?.id != null && actual?.cliente_id === cliente.id ? null : landlord.id,
      (v) => (v === landlord.id ? nombreCliente(ctx, landlord) : `#${v}`),
      true,
    ],
    [
      'porcentaje_pago',
      'Porcentaje del canon',
      actual?.porcentaje_pago,
      landlord.porcentaje,
      (v) => `${Number(v)} %`,
    ],
    ['valor_base', 'Valor anual', actual?.valor_base, valor, cop],
    ['activo', 'Estado', actual?.activo, landlord.porcentaje > 0, si],
    [
      'originabot_landlord_id',
      'Propietario en TSF',
      actual?.originabot_landlord_id,
      landlord.id,
      (v) => `#${v}`,
    ],
  ])
}

export function planArriendo(
  tsf: ArriendoTsf,
  contrato: ContratoServicio | null,
  actuales: Arrendador[],
  ctx: ContextoArriendo,
): PlanArriendo {
  const usados = new Set<number>()
  const acciones: AccionArrendador[] = []
  for (const landlord of tsf.arrendadores) {
    const actual = arrendadorDe(landlord, actuales, ctx, usados)
    if (actual) usados.add(actual.id)
    const cambios = camposArrendador(landlord, actual, tsf, ctx)
    if (actual && !cambios.length) continue
    acciones.push({
      tipo: actual ? 'actualizar' : 'crear',
      id: actual?.id ?? null,
      nombre: landlord.nombre,
      landlord,
      cambios,
    })
  }
  // Si en TSF nadie recibe pago (todos al 0 %, datos incompletos), desactivar a
  // los de Operaciones dejaría el contrato sin a quién pagarle: no se propone.
  const tsfPaga = tsf.arrendadores.some((l) => l.porcentaje > 0)
  for (const a of actuales) {
    if (!tsfPaga || usados.has(a.id) || a.activo === false) continue
    acciones.push({
      tipo: 'desactivar',
      id: a.id,
      nombre: a.nombre,
      landlord: null,
      cambios: [
        {
          clave: 'activo',
          etiqueta: 'Estado',
          actualTexto: 'Activo',
          propuestoTexto: 'Inactivo',
          valor: false,
        },
      ],
    })
  }
  return {
    contrato: planContrato(tsf, contrato, ctx),
    arrendadores: acciones,
    nota:
      [tsf.origen === 'documento' ? NOTA_SOLO_DOCUMENTO : null, tsfPaga ? null : NOTA_SIN_PAGO]
        .filter(Boolean)
        .join(' ') || null,
  }
}

/** Los propietarios cuyo cliente hay que CREAR para aplicar estos cambios. */
export function clientesPorCrear(cambios: CampoArriendo[][], ctx: ContextoArriendo): number[] {
  const ids = cambios
    .flat()
    .filter((c) => c.deLandlord && typeof c.valor === 'number')
    .map((c) => c.valor as number)
  return [...new Set(ids)].filter((id) => ctx.clientes[id]?.id === null)
}

/** Los cambios como payload, con los propietarios ya traducidos a su cliente. */
export function payloadDe(
  cambios: CampoArriendo[],
  clienteDe: (landlordId: number) => number,
): Record<string, unknown> {
  return Object.fromEntries(
    cambios.map((c) => [c.clave, c.deLandlord ? clienteDe(c.valor as number) : c.valor]),
  )
}

/** Un arrendador nuevo: lo que el backend pide además de los cambios. */
export function payloadArrendadorNuevo(cambios: Record<string, unknown>): PayloadArrendador {
  return {
    nombre: String(cambios.nombre ?? ''),
    valor_base: (cambios.valor_base as number | undefined) ?? null,
    responsable_iva: false,
    activo: cambios.activo !== false,
    anticipo_pagado_desde: null,
    anticipo_pagado_hasta: null,
    observaciones: 'Traído de TSF',
    ...cambios,
  }
}

/** Las acciones marcadas. Sin contrato en Operaciones, dependen de crearlo. */
export function accionesSeleccionadas(
  plan: PlanArriendo,
  conContrato: boolean,
  elegidas: boolean[],
): AccionArrendador[] {
  const contratoNuevo = plan.contrato?.id === null
  return plan.arrendadores.filter((_, i) => elegidas[i] && (!contratoNuevo || conContrato))
}

/** Lo que queda marcado al abrir: todo lo que se puede aplicar. */
export function seleccionInicial(plan: PlanArriendo): {
  conContrato: boolean
  elegidas: boolean[]
} {
  return {
    conContrato: !!plan.contrato && !plan.contrato.faltan.length,
    elegidas: plan.arrendadores.map(() => true),
  }
}

/** ¿Hay algo que proponer? */
export function hayCambiosArriendo(plan: PlanArriendo | null): boolean {
  return !!plan && (!!plan.contrato || plan.arrendadores.length > 0)
}
