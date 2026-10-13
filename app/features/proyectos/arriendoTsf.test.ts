import { describe, expect, it } from 'vitest'
import {
  clientesPorCrear,
  contratoDeArriendo,
  payloadDe,
  planArriendo,
  type ContextoArriendo,
} from './arriendoTsf'
import type { Arrendador, ContratoServicio } from '~/features/contratos/types'
import type { ArriendoTsf } from '~/features/proyectos/types'

// El terreno 369 de dev: 4 proyectos comparten un canon de 64.381.107/año; un
// propietario recibe el 100 % y el otro figura al 0 %.
const TSF: ArriendoTsf = {
  origen: 'contrato',
  contratoId: 179,
  enlace: 'https://tsf.test/minifarms/lands/369?tab=legal',
  firmado: true,
  fechaFirma: '2024-02-15',
  periodicidad: 'mensual',
  canonAnual: 16_095_277,
  proyectosTerreno: 4,
  arrendadores: [
    {
      id: 596,
      nombre: 'Charlene Valentine',
      documento: '19****53',
      tipoPersona: 'natural',
      porcentaje: 100,
      recibePago: true,
    },
    {
      id: 1997,
      nombre: 'Mandy Clayton',
      documento: '36****11',
      tipoPersona: 'natural',
      porcentaje: 0,
      recibePago: false,
    },
  ],
}

const CTX: ContextoArriendo = {
  clientes: {
    596: { estado: 'creado', id: null, razon_social_nombre: 'Charlene Valentine' },
    1997: { estado: 'existente', id: 40, razon_social_nombre: 'MANDY CLAYTON' },
  },
  arrendatario: { id: 7, nombre: 'Solenium' },
}

// El proyecto 14 de la base local: un arriendo con un arrendador genérico.
const CONTRATO_342: ContratoServicio = {
  id: 342,
  servicio_aplica: 'arriendo',
  estado: 'firmado',
  fecha_firma_contrato: '2025-06-17',
  tarifa_base: 15_732_000,
  periodicidad_pago: 'trimestral',
  contratante_id: null,
  prestador_id: null,
}
const ARRENDADOR_28: Arrendador = {
  id: 28,
  nombre: 'Arrendador',
  valor_base: 15_732_000,
  activo: true,
}

describe('contratoDeArriendo', () => {
  it('prefiere el que ya apunta al de TSF; si no, el primero sin vínculo', () => {
    const otro = { ...CONTRATO_342, id: 1, originabot_arriendo_id: 99 }
    const vinculado = { ...CONTRATO_342, id: 2, originabot_arriendo_id: 179 }
    expect(contratoDeArriendo(TSF, [otro, CONTRATO_342, vinculado])?.id).toBe(2)
    expect(contratoDeArriendo(TSF, [otro, CONTRATO_342])?.id).toBe(342)
    expect(contratoDeArriendo(TSF, [otro])).toBeNull()
  })
})

describe('planArriendo sobre un contrato que ya existe', () => {
  const plan = planArriendo(TSF, CONTRATO_342, [ARRENDADOR_28], CTX)

  it('propone solo lo que difiere del contrato, y llena las partes vacías', () => {
    const porClave = Object.fromEntries(plan.contrato!.cambios.map((c) => [c.clave, c]))
    expect(Object.keys(porClave).sort()).toEqual([
      'contratante_id',
      'enlace_drive',
      'fecha_firma_contrato',
      'originabot_arriendo_id',
      'periodicidad_pago',
      'prestador_id',
      'tarifa_base',
    ])
    expect(porClave.periodicidad_pago!.propuestoTexto).toBe('Mensual')
    expect(porClave.prestador_id).toMatchObject({ valor: 596, deLandlord: true })
    expect(porClave.prestador_id!.propuestoTexto).toBe('Charlene Valentine (cliente nuevo)')
    expect(plan.contrato!.id).toBe(342)
  })

  it('crea a los propietarios, el del 0 % inactivo, y desactiva el que TSF no tiene', () => {
    const [charlene, mandy, generico] = plan.arrendadores
    expect(charlene).toMatchObject({ tipo: 'crear', nombre: 'Charlene Valentine' })
    expect(charlene!.cambios.find((c) => c.clave === 'valor_base')!.valor).toBe(16_095_277)
    expect(mandy!.cambios.find((c) => c.clave === 'activo')!.valor).toBe(false)
    expect(mandy!.cambios.find((c) => c.clave === 'valor_base')!.valor).toBe(0)
    expect(generico).toMatchObject({ tipo: 'desactivar', id: 28 })
  })

  it('solo hay que crear el cliente que no existe', () => {
    const todos = [plan.contrato!.cambios, ...plan.arrendadores.map((a) => a.cambios)]
    expect(clientesPorCrear(todos, CTX)).toEqual([596])
  })

  it('el payload cambia cada propietario por su cliente', () => {
    const p = payloadDe(plan.arrendadores[0]!.cambios, (id) => (id === 596 ? 501 : -1))
    expect(p).toMatchObject({ cliente_id: 501, originabot_landlord_id: 596, porcentaje_pago: 100 })
  })
})

describe('planArriendo ya sincronizado', () => {
  it('no propone nada si todo coincide', () => {
    const ctx: ContextoArriendo = {
      ...CTX,
      clientes: {
        ...CTX.clientes,
        596: { estado: 'existente', id: 501, razon_social_nombre: 'X' },
      },
    }
    const contrato: ContratoServicio = {
      ...CONTRATO_342,
      originabot_arriendo_id: 179,
      fecha_firma_contrato: '2024-02-15',
      tarifa_base: '16095277.0000' as unknown as number,
      periodicidad_pago: 'mensual',
      contratante_id: 7,
      prestador_id: 501,
    }
    const actuales: Arrendador[] = [
      {
        id: 1,
        nombre: 'Charlene Valentine',
        cliente_id: 501,
        originabot_landlord_id: 596,
        porcentaje_pago: '100.0000',
        valor_base: 16_095_277,
        activo: true,
      },
      {
        id: 2,
        nombre: 'Mandy Clayton',
        cliente_id: 40,
        originabot_landlord_id: 1997,
        porcentaje_pago: '0.0000',
        valor_base: 0,
        activo: false,
      },
    ]
    expect(
      planArriendo(TSF, { ...contrato, enlace_drive: 'https://drive/x' }, actuales, ctx),
    ).toEqual({
      contrato: null,
      arrendadores: [],
      nota: null,
    })
  })
})

describe('planArriendo sin contrato en Operaciones', () => {
  it('propone crearlo, y sin inversionista dice por qué no se puede', () => {
    const plan = planArriendo(TSF, null, [], { ...CTX, arrendatario: null })
    expect(plan.contrato).toMatchObject({ id: null })
    expect(plan.contrato!.faltan).toHaveLength(1)
    expect(plan.arrendadores.map((a) => a.tipo)).toEqual(['crear', 'crear'])
  })

  it('reconoce por nombre a un arrendador sin vínculo', () => {
    const plan = planArriendo(
      TSF,
      CONTRATO_342,
      [{ id: 5, nombre: 'CHARLENE  valentine', activo: true }],
      CTX,
    )
    expect(plan.arrendadores[0]).toMatchObject({ tipo: 'actualizar', id: 5 })
  })
})

describe('planArriendo con solo el PDF en TSF', () => {
  // La Paz Leyenda: sin termsheet, el contrato es el campo «(S) Contrato de arrendamiento».
  const DOC: ArriendoTsf = {
    ...TSF,
    origen: 'documento',
    contratoId: null,
    fechaFirma: null,
    periodicidad: null,
    canonAnual: null,
  }

  it('trae el enlace, la firma y los arrendadores, y avisa que el canon va a mano', () => {
    const plan = planArriendo(DOC, CONTRATO_342, [], CTX)
    const claves = plan.contrato!.cambios.map((c) => c.clave)
    expect(claves).toContain('enlace_drive')
    expect(claves).not.toContain('tarifa_base')
    expect(claves).not.toContain('originabot_arriendo_id')
    expect(plan.nota).toMatch(/a mano/)
    // Sin canon no se inventa el valor de cada arrendador.
    const charlene = plan.arrendadores.find((a) => a.landlord?.id === 596)!
    expect(charlene.cambios.map((c) => c.clave)).not.toContain('valor_base')
  })

  it('el enlace que ya tiene el contrato no se reemplaza', () => {
    const plan = planArriendo(DOC, { ...CONTRATO_342, enlace_drive: 'https://drive/x' }, [], CTX)
    expect(plan.contrato!.cambios.map((c) => c.clave)).not.toContain('enlace_drive')
  })
})

describe('planArriendo cuando en TSF nadie recibe pago', () => {
  it('no desactiva a los arrendadores de Operaciones y lo explica', () => {
    const sinPago: ArriendoTsf = {
      ...TSF,
      arrendadores: TSF.arrendadores.map((a) => ({ ...a, porcentaje: 0, recibePago: false })),
    }
    const plan = planArriendo(sinPago, CONTRATO_342, [ARRENDADOR_28], CTX)
    expect(plan.arrendadores.map((a) => a.tipo)).not.toContain('desactivar')
    expect(plan.nota).toMatch(/activos/)
    // Nadie al 0 % se propone como quien recibe el pago.
    expect(plan.contrato!.cambios.map((c) => c.clave)).not.toContain('prestador_id')
  })
})
