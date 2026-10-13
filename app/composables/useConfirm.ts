/**
 * Confirmación imperativa: `confirm({ title, onConfirm })` desde un manejador
 * de evento, sin declarar un diálogo por cada sitio que lo necesita.
 *
 * El estado vive en `useState` (uno solo para toda la app: un diálogo de
 * confirmación a la vez, igual que el `ConfirmDialog` de PrimeVue que
 * reemplaza) y lo renderiza `~/components/blocks/ConfirmDialog.vue`, montado
 * una vez en `app.vue`.
 */
export interface ConfirmOptions {
  title: string
  /** Detalle: qué implica, por qué no se puede deshacer. */
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** `'destructive'` para eliminar o cualquier acción que no se puede deshacer. */
  variant?: 'default' | 'destructive'
  onConfirm: () => void
  /** Se cerró sin confirmar (Cancelar, Escape, clic fuera). */
  onCancel?: () => void
}

interface ConfirmState {
  open: boolean
  options: ConfirmOptions | null
}

export function useConfirmState() {
  return useState<ConfirmState>('confirm-dialog', () => ({ open: false, options: null }))
}

/** Usage: `const confirm = useConfirm(); confirm({ title: '...', onConfirm: () => ... })` */
export function useConfirm() {
  const state = useConfirmState()

  return (options: ConfirmOptions) => {
    state.value = { open: true, options }
  }
}
