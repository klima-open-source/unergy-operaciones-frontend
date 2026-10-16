/**
 * Una señal que se cancela cuando el componente se desmonta: para cortar esperas
 * largas (sondeos de tareas) al salir de la vista en vez de dejarlas corriendo
 * para nadie. Ver `LiquidacionesApiService.esperarTarea`.
 */
export function useSenalAlSalir(): AbortSignal {
  const controlador = new AbortController()
  onUnmounted(() => controlador.abort())
  return controlador.signal
}
