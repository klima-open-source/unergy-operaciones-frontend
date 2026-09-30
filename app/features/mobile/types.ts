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

/**
 * El comando va con el token del servidor. `password` es la de la cuenta de la
 * PLATAFORMA de quien lo manda (no la de Solenium): confirma la acción, como la
 * pide SolarView antes de abrir o cerrar un reconectador.
 */
export interface PayloadComandoReconectador {
  accion: 'ON' | 'OFF'
  password: string
}
