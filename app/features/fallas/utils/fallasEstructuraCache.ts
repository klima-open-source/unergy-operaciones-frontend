import type { CategoriaFalla } from '~/features/fallas/types'
import { FallasService } from '~/features/fallas/services/fallas'

// GET /fallas/estructura es un catálogo prácticamente estático (la
// estructura canónica de categorías/tipos de falla) -- se cachea a nivel de
// módulo para que abrir el formulario de Nueva/Editar varias veces en la
// misma sesión no repita la llamada cada vez.
let _cache: CategoriaFalla[] | null = null

export async function getEstructuraFallas(): Promise<CategoriaFalla[]> {
  if (_cache) return _cache
  try {
    _cache = await new FallasService().obtenerEstructura()
  } catch {
    return []
  }
  return _cache
}
