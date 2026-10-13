/**
 * Guardar lo que emite `FallaForm`: crear (una falla por proyecto elegido) o
 * editar (una sola), más lo que el formulario junta aparte — nota inicial,
 * archivos adjuntos y la notificación por correo. Lo usan `FallaFormPage.vue`
 * y `FallaDetailView.vue`.
 *
 * **Lo guardado no se repite.** Producción da 503 intermitentes, y antes un
 * fallo a mitad de camino se reportaba como si no se hubiera guardado nada:
 * al reintentar se duplicaban las fallas ya creadas o su seguimiento. Ahora:
 *
 *   · cada proyecto se crea por separado (`allSettled`): con que uno quede,
 *     se da por guardado y se avisa qué proyectos faltaron;
 *   · la nota inicial y los adjuntos van DESPUÉS de crear/editar y su fallo no
 *     tumba lo anterior: se avisa qué parte de qué falla quedó pendiente.
 */
import type { Falla, PayloadFallaForm, ResultadoNotificacionFalla } from '~/features/fallas/types'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { useProyectosCatalogo } from '~/composables/useProyectosCatalogo'
import { FallasService } from '~/features/fallas/services/fallas'

/** Envía la notificación de cada falla y muestra el resultado. Un fallo avisa, pero no bloquea. */
async function notificar(fallasService: FallasService, fallaIds: Falla['id'][]) {
  const resultados: ResultadoNotificacionFalla[] = await Promise.all(
    fallaIds.map((id) =>
      fallasService.notificar(id).catch((err): ResultadoNotificacionFalla => ({
        ok: false,
        enviados: [],
        errores: [normalizeError(err).message],
        sin_correos: false,
      })),
    ),
  )

  const todosOk = resultados.every((r) => r.ok)
  const sinCorreos = resultados.some((r) => r.sin_correos)
  const enviados = [...new Set(resultados.flatMap((r) => r.enviados || []))]
  const errores = resultados.flatMap((r) => r.errores || []).filter(Boolean)

  if (todosOk) {
    toast.success('✉️ Notificación enviada', {
      description: `Correo enviado a: ${enviados.join(', ')}`,
      duration: 5000,
    })
  } else if (sinCorreos) {
    toast.warning('⚠️ Sin correos configurados', {
      description:
        'La falla fue guardada pero el cliente no tiene correos operacionales configurados. Agrégalos en Clientes → Correos Operacionales.',
      duration: 8000,
    })
  } else {
    // El error SMTP más descriptivo, si lo hay
    const errorSmtp = errores.find(
      (e) => e.includes('534') || e.includes('Application-specific') || e.includes('password'),
    )
    toast.error('✉️ Error al enviar notificación', {
      description: errorSmtp
        ? 'Error de autenticación SMTP: Gmail requiere una App Password (contraseña de aplicación). Configúrala en las variables de Railway.'
        : `Error: ${errores[0] || 'Error desconocido'}`,
      duration: 10000,
    })
  }
}

interface ResultadoGuardado {
  ids: Falla['id'][]
  /** Lo que no se pudo guardar aunque la falla sí quedó, en texto para el aviso. */
  pendientes: string[]
}

export function useGuardarFalla() {
  const fallasService = new FallasService()
  const catalogoProyectos = useProyectosCatalogo()
  const guardando = ref(false)

  /**
   * Nota inicial y adjuntos de una falla YA guardada. Lo que falle se devuelve
   * como pendiente; no se reintenta (reintentar es lo que duplicaba).
   */
  async function complementar(
    falla: Pick<Falla, 'id' | 'codigo_interno'>,
    nota: string | undefined,
    archivos: File[] | undefined,
  ): Promise<string[]> {
    const nombre = falla.codigo_interno || `falla ${falla.id}`
    const pendientes: string[] = []
    if (nota) {
      try {
        await fallasService.crearSeguimiento(falla.id, { nota })
      } catch {
        pendientes.push(`${nombre}: la nota inicial`)
      }
    }
    if (archivos?.length) {
      const subidas = await Promise.allSettled(
        archivos.map((file) => fallasService.subirArchivo(falla.id, file)),
      )
      const fallidos = archivos.filter((_, i) => subidas[i]?.status === 'rejected')
      if (fallidos.length) {
        pendientes.push(
          `${nombre}: ${fallidos.length === 1 ? 'el adjunto' : 'los adjuntos'} ${fallidos.map((f) => f.name).join(', ')}`,
        )
      }
    }
    return pendientes
  }

  async function nombresProyectos(ids: number[]): Promise<string[]> {
    const lista = await catalogoProyectos.cargarOperativos()
    return ids.map((id) => lista.find((p) => p.id === id)?.nombre_comercial ?? `proyecto ${id}`)
  }

  async function editar(falla: Falla, payload: PayloadFallaForm): Promise<ResultadoGuardado> {
    const { nota_inicial: notaInicial, _archivos: archivos, ...patch } = payload
    // Si el PATCH falla no se guardó nada y se puede reintentar. Si pasa, lo
    // que sigue ya no lo deshace ni se vuelve a publicar.
    await fallasService.actualizar(falla.id, patch)
    const pendientes = await complementar(falla, notaInicial, archivos)
    toast.success('Falla actualizada', { duration: 2500 })
    return { ids: [falla.id], pendientes }
  }

  async function crear(payload: PayloadFallaForm): Promise<ResultadoGuardado> {
    const { proyecto_ids, nota_inicial: notaInicial, _archivos: archivos, ...base } = payload
    const proyectoIds = proyecto_ids ?? []
    // Una falla por proyecto, cada una por su cuenta.
    const resultados = await Promise.allSettled(
      proyectoIds.map((pid) => fallasService.crear({ ...base, proyecto_id: pid })),
    )
    const nuevas: Falla[] = []
    const fallidos: number[] = []
    let primerError: unknown = null
    resultados.forEach((r, i) => {
      if (r.status === 'fulfilled') nuevas.push(r.value)
      else {
        fallidos.push(proyectoIds[i]!)
        primerError ??= r.reason
      }
    })
    if (!nuevas.length) throw primerError ?? new Error('Selecciona al menos un proyecto')

    const pendientes: string[] = []
    if (fallidos.length) {
      const nombres = await nombresProyectos(fallidos)
      pendientes.push(
        `no se creó la falla de ${nombres.join(', ')} (regístrala aparte solo para ${fallidos.length === 1 ? 'ese proyecto' : 'esos proyectos'})`,
      )
    }
    const complementos = await Promise.all(
      nuevas.map((f) => complementar(f, notaInicial, archivos)),
    )
    pendientes.push(...complementos.flat())

    const n = nuevas.length
    toast.success(
      fallidos.length
        ? `Se registraron ${n} de ${proyectoIds.length} fallas`
        : n === 1
          ? 'Falla registrada'
          : `${n} fallas registradas`,
      {
        description:
          n > 1 ? 'Se creó una falla independiente por cada proyecto seleccionado' : undefined,
        duration: 3000,
      },
    )
    return { ids: nuevas.map((f) => f.id), pendientes }
  }

  /**
   * Crea o edita según haya `falla`. Devuelve los ids guardados —aunque haya
   * quedado algo pendiente, que se avisa aparte— o `null` si no se guardó nada
   * (el error ya se mostró).
   */
  async function guardar(
    payload: PayloadFallaForm,
    falla: Falla | null,
  ): Promise<Falla['id'][] | null> {
    guardando.value = true
    try {
      const { ids, pendientes } = falla ? await editar(falla, payload) : await crear(payload)
      if (pendientes.length) {
        toast.warning('Guardado, pero quedó algo pendiente', {
          description: `Falta: ${pendientes.join('; ')}. Lo demás ya quedó guardado: complétalo desde el detalle de la falla, sin volver a enviar el formulario.`,
          duration: 12000,
        })
      }
      if (payload.notificacion) await notificar(fallasService, ids)
      return ids
    } catch (err) {
      toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
      return null
    } finally {
      guardando.value = false
    }
  }

  return { guardando, guardar }
}
