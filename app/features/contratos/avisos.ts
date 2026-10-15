import { toast } from 'vue-sonner'

/**
 * Los avisos que no bloquean de la API de contratos (`avisos` en la respuesta al
 * crear o editar). Hoy: una planta que pagaría administración dos veces —en el
 * contrato de representación y en el de O&M, o en dos del mismo inversionista—.
 * Se guardó igual; el aviso es para que alguien lo revise.
 */
export function mostrarAvisos(respuesta: unknown): void {
  const avisos = (respuesta as { avisos?: unknown } | null)?.avisos
  if (!Array.isArray(avisos)) return
  for (const aviso of avisos) {
    if (typeof aviso === 'string' && aviso) toast.warning('Revisa la administración', { description: aviso, duration: 8000 })
  }
}
