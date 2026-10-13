/**
 * Vincular el operador de red de un proyecto de TSF con el catálogo de
 * Operaciones (por su `code` de originabot), pidiendo confirmación si eso lo
 * CREARÍA. Lo usan «Importar desde TSF» y «Sincronizar con TSF».
 *
 * Nunca lanza: si no se confirma o falla, el operador no queda vinculado y quien
 * llama sigue (el formulario cae al nombre, la sincronización no lo propone).
 */
import type { ConfirmOptions } from '~/composables/useConfirm'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'

export function useVinculoOperadorTsf() {
  const operadoresRed = new OperadoresRedService()
  const confirm = useConfirm()

  function confirmar(opciones: Omit<ConfirmOptions, 'onConfirm' | 'onCancel'>): Promise<boolean> {
    return new Promise((resolver) =>
      confirm({ ...opciones, onConfirm: () => resolver(true), onCancel: () => resolver(false) }),
    )
  }

  async function vincularOperador(codigo: string, nombre: string, siNo: string): Promise<void> {
    try {
      const simulacion = await operadoresRed.simularVinculoOriginabot(codigo, nombre)
      if (simulacion.estado === 'existente') return
      if (simulacion.estado === 'creado') {
        const si = await confirmar({
          title: `Esta acción creará el operador de red «${nombre}» en Operaciones`,
          description: `Viene de TSF y aún no está en el catálogo. ¿Desea continuar? ${siNo}`,
          confirmLabel: 'Sí, crear',
        })
        if (!si) return
      }
      await operadoresRed.vincularOriginabot(codigo, nombre)
    } catch {
      // Sin vínculo: quien llama sigue sin él.
    }
  }

  return { confirmar, vincularOperador }
}
