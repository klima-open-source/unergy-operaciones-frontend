/**
 * «Sincronizar con TSF», parte del arriendo: leer lo que hay en Operaciones,
 * armar el plan (`./arriendoTsf`) y aplicarlo.
 *
 * Al aplicar, primero los clientes de los propietarios —con confirmación si hay
 * que CREAR alguno—, después el contrato (que puede necesitar al que recibe el
 * pago como prestador) y por último los arrendadores: los nuevos antes de
 * desactivar los viejos, porque el backend no deja un contrato sin ninguno.
 */
import { ClientesService, type ArrendadorOriginabot } from '~/features/clientes/services/clientes'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import {
  clientesPorCrear,
  contratoDeArriendo,
  payloadArrendadorNuevo,
  payloadDe,
  planArriendo,
  type AccionArrendador,
  type ClienteDeArrendador,
  type ContextoArriendo,
  type PlanArriendo,
} from '~/features/proyectos/arriendoTsf'
import type { ArrendadorTsf, ArriendoTsf, InversionistaProyecto } from '~/features/proyectos/types'
import { useVinculoOperadorTsf } from '~/features/proyectos/vinculoOperadorTsf'

export interface ArriendoPreparado {
  tsf: ArriendoTsf
  plan: PlanArriendo
  ctx: ContextoArriendo
  /** El contrato de Operaciones que se actualiza; null si se crea. */
  contratoId: number | null
}

const ORDEN: Record<AccionArrendador['tipo'], number> = { crear: 0, actualizar: 1, desactivar: 2 }

function datos(a: ArrendadorTsf): ArrendadorOriginabot {
  return {
    landlord_id: a.id,
    nombre: a.nombre,
    documento: a.documento,
    tipo_persona: a.tipoPersona,
  }
}

/** El arrendatario: el inversionista con más participación. */
function arrendatarioDe(inversionistas: InversionistaProyecto[]): ContextoArriendo['arrendatario'] {
  const principal = [...inversionistas].sort(
    (a, b) => (b.porcentaje_participacion ?? 0) - (a.porcentaje_participacion ?? 0),
  )[0]
  return principal
    ? { id: principal.cliente_id, nombre: principal.cliente_nombre ?? `#${principal.cliente_id}` }
    : null
}

export function useSincronizacionArriendo() {
  const contratos = new ContratosServicioService()
  const clientes = new ClientesService()
  const { confirmar } = useVinculoOperadorTsf()

  async function preparar(
    proyectoId: number,
    inversionistas: InversionistaProyecto[],
    tsf: ArriendoTsf,
  ): Promise<ArriendoPreparado> {
    const contrato = contratoDeArriendo(
      tsf,
      await contratos.listar({ tipo: 'arriendo', proyecto_id: proyectoId }),
    )
    const [actuales, simulados] = await Promise.all([
      contrato ? contratos.listarArrendadores(contrato.id) : Promise.resolve([]),
      Promise.all(
        tsf.arrendadores.map(
          async (a) =>
            [a.id, await clientes.simularArrendadorOriginabot(datos(a))] as [
              number,
              ClienteDeArrendador,
            ],
        ),
      ),
    ])
    const ctx: ContextoArriendo = {
      clientes: Object.fromEntries(simulados),
      arrendatario: arrendatarioDe(inversionistas),
    }
    return {
      tsf,
      ctx,
      plan: planArriendo(tsf, contrato, actuales, ctx),
      contratoId: contrato?.id ?? null,
    }
  }

  /**
   * Aplica el contrato (si `conContrato`) y las acciones elegidas. Devuelve
   * false si la persona no confirmó la creación de clientes: no se escribió nada.
   */
  async function aplicar(
    proyectoId: number,
    p: ArriendoPreparado,
    conContrato: boolean,
    acciones: AccionArrendador[],
  ): Promise<boolean> {
    const cambiosContrato = conContrato && p.plan.contrato ? p.plan.contrato.cambios : []
    const todos = [cambiosContrato, ...acciones.map((a) => a.cambios)]

    const nuevos = clientesPorCrear(todos, p.ctx)
    if (nuevos.length) {
      const nombres = nuevos.map((id) => p.tsf.arrendadores.find((a) => a.id === id)?.nombre)
      const si = await confirmar({
        title:
          nuevos.length === 1
            ? 'Esta acción creará 1 cliente en Operaciones. ¿Desea continuar?'
            : `Esta acción creará ${nuevos.length} clientes en Operaciones. ¿Desea continuar?`,
        description: `Propietarios de TSF que aún no son clientes: ${nombres.join(', ')}. Se crean con su nombre, documento y tipo de persona.`,
        confirmLabel: 'Sí, crear',
      })
      if (!si) return false
    }

    // Todos los propietarios que se nombran quedan vinculados con su cliente.
    const porVincular = new Set(
      todos
        .flat()
        .filter((c) => c.deLandlord)
        .map((c) => c.valor as number),
    )
    const clienteDe: Record<number, number> = {}
    for (const id of porVincular) {
      const landlord = p.tsf.arrendadores.find((a) => a.id === id)!
      const r = await clientes.vincularArrendadorOriginabot(datos(landlord))
      clienteDe[id] = r.id!
    }
    const traducir = (id: number) => clienteDe[id]!

    let contratoId = p.contratoId
    if (cambiosContrato.length) {
      const payload = payloadDe(cambiosContrato, traducir)
      if (contratoId === null) {
        const nuevo = await contratos.crear({
          servicio_aplica: 'arriendo',
          proyecto_id: proyectoId,
          ...payload,
        })
        contratoId = nuevo.id
      } else {
        await contratos.actualizar(contratoId, payload)
      }
    }
    if (contratoId === null) return true

    for (const a of [...acciones].sort((x, y) => ORDEN[x.tipo] - ORDEN[y.tipo])) {
      const payload = payloadDe(a.cambios, traducir)
      if (a.tipo === 'crear') {
        await contratos.crearArrendador(contratoId, payloadArrendadorNuevo(payload))
      } else {
        // Solo lo que cambia (y el nombre, que el backend exige): el IVA, los
        // anticipos y las observaciones de una persona no se pisan.
        await contratos.actualizarArrendador(a.id!, { nombre: a.nombre, ...payload })
      }
    }
    return true
  }

  return { preparar, aplicar }
}
