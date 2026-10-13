/**
 * Guardar lo que emite `FallaForm`: crear (una falla por proyecto elegido) o
 * editar (una sola), más lo que el formulario junta aparte — nota inicial,
 * archivos adjuntos y la notificación por correo.
 *
 * Vivía dentro de `MonitoreoView.vue`, atado al diálogo de crear/editar. Desde
 * que el formulario tiene página propia (`/fallas/nueva`, `/fallas/:id/editar`)
 * lo usa `FallaFormPage.vue`.
 */
import type { Falla, PayloadFallaForm, ResultadoNotificacionFalla } from '~/features/fallas/types'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { FallasService } from '~/features/fallas/services/fallas'

const fallasService = new FallasService()

/** Envía la notificación de cada falla y muestra el resultado. Un fallo avisa, pero no bloquea. */
async function notificar(fallaIds: Falla['id'][]) {
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

export function useGuardarFalla() {
  const guardando = ref(false)

  async function editar(falla: Falla, payload: PayloadFallaForm): Promise<Falla['id']> {
    const { nota_inicial: notaInicial, _archivos: archivos, ...patch } = payload
    await fallasService.actualizar(falla.id, patch)
    if (notaInicial) await fallasService.crearSeguimiento(falla.id, { nota: notaInicial })
    if (archivos?.length) {
      await Promise.all(archivos.map((file) => fallasService.subirArchivo(falla.id, file)))
    }
    toast.success('Falla actualizada', { duration: 2500 })
    return falla.id
  }

  async function crear(payload: PayloadFallaForm): Promise<Falla['id'][]> {
    const { proyecto_ids, nota_inicial: notaInicial, _archivos: archivos, ...base } = payload
    // Una falla por proyecto, en paralelo
    const nuevas = await Promise.all(
      (proyecto_ids ?? []).map((pid) => fallasService.crear({ ...base, proyecto_id: pid })),
    )
    if (notaInicial) {
      await Promise.all(
        nuevas.map((f) => fallasService.crearSeguimiento(f.id, { nota: notaInicial })),
      )
    }
    if (archivos?.length) {
      await Promise.all(
        nuevas.flatMap((f) => archivos.map((file) => fallasService.subirArchivo(f.id, file))),
      )
    }
    const n = nuevas.length
    toast.success(n === 1 ? 'Falla registrada' : `${n} fallas registradas`, {
      description:
        n > 1 ? 'Se creó una falla independiente por cada proyecto seleccionado' : undefined,
      duration: 3000,
    })
    return nuevas.map((f) => f.id)
  }

  /**
   * Crea o edita según haya `falla`. Devuelve los ids guardados, o `null` si
   * falló (el error ya se mostró).
   */
  async function guardar(
    payload: PayloadFallaForm,
    falla: Falla | null,
  ): Promise<Falla['id'][] | null> {
    guardando.value = true
    try {
      const ids = falla ? [await editar(falla, payload)] : await crear(payload)
      if (payload.notificacion && ids.length) await notificar(ids)
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
