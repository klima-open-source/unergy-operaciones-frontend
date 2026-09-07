/**
 * Forma verificada contra las vistas de `mobile`: `MobileSolarView.vue`,
 * `ReconnectSheet.vue` y `ReconnectorPanel.vue`. El resto de endpoints que
 * consume `mobile` (fallas, proyectos, usuarios, notificaciones, generación
 * solar, reporte CGM) ya están tipados en sus slices propios.
 */

/** `GET /reconectadores/estados`: estado + telemetría del relay por proyecto. */
export interface EstadoReconectador {
  proyecto_id: number
  active: boolean | null
  [clave: string]: unknown
}

export interface PayloadComandoReconectador {
  username: string
  password: string
  accion: 'ON' | 'OFF'
  is_interrogating?: boolean
}
