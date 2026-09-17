/**
 * Arma la lista de plantas de un PPA para mandarla en `PATCH /ppa/:id`.
 *
 * **`proyecto_ids` REEMPLAZA el conjunto, no agrega.** El backend borra las
 * filas de `ppa_contrato_proyectos` del contrato y vuelve a crearlas con lo que
 * reciba (`contratos_service.fijar_proyectos`). Mandar solo la planta nueva
 * borra las que ya estaban, en la base y sin aviso.
 *
 * Por eso esto vive en su propia función y no dentro del componente: es el
 * pedazo que puede destruir datos si se escribe mal, y así se puede probar sin
 * montar la vista.
 *
 * No existe `POST /ppa/:id/proyectos` —el detalle lo llamaba y siempre dio 404,
 * tampoco existía en FastAPI—, y no se construyó a propósito: habría dos formas
 * de fijar las plantas de un contrato. Ver `docs/DIAGNOSTICO_PPA.md` en el
 * backend.
 */

/** Lo mínimo que se necesita de una planta: su id. */
export interface PlantaRef {
  id: number
}

/**
 * Las plantas actuales del contrato más una nueva, sin repetir.
 *
 * Devolver la lista ya sin duplicados importa porque el par
 * `(contrato_id, proyecto_id)` es la llave primaria de la tabla de vínculos: un
 * id repetido revienta el `bulk_create` con un 500.
 */
export function idsConPlantaAgregada(
  actuales: readonly (PlantaRef | null | undefined)[] | null | undefined,
  nueva: PlantaRef | null | undefined,
): number[] {
  const ids = (actuales ?? [])
    .map((p) => p?.id)
    .filter((id): id is number => typeof id === 'number')

  if (nueva?.id != null && !ids.includes(nueva.id)) ids.push(nueva.id)

  return ids
}

/** `true` si la planta ya está en el contrato: el diálogo no tiene nada que hacer. */
export function yaEstaVinculada(
  actuales: readonly (PlantaRef | null | undefined)[] | null | undefined,
  planta: PlantaRef | null | undefined,
): boolean {
  if (planta?.id == null) return false
  return (actuales ?? []).some((p) => p?.id === planta.id)
}
