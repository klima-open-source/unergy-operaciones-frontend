/**
 * `UnergyAuthService`: el login con Unergy Auth (authentication-system).
 *
 * Dos pasos, porque Unergy Auth sabe quién es la persona pero no qué rol tiene
 * en Operaciones:
 *
 *   1. `POST /unergy-auth/login` (ruta de Nitro → `auth.unergy.io`) devuelve el
 *      par de tokens;
 *   2. `GET /api/v1/auth/me` con ese access le pregunta al backend de
 *      operaciones qué usuario local le corresponde (por email) y con qué rol.
 *      Si el email no tiene cuenta en Operaciones responde 403.
 *
 * Igual que `OperacionesAuthService`, usa una instancia de `ofetch` propia, sin
 * el contrato de sesión de `~/core/client.ts`: aquí un 401 o un 403 son
 * respuestas normales de un login fallido, no una sesión que caducó.
 */
import { ofetch } from 'ofetch'
import { AppError, codeFromHttpStatus, isFetchError } from '~/core/errors'
import { BaseService } from '~/core/service'

const RUTAS = {
  login: '/unergy-auth/login',
  me: '/api/v1/auth/me',
} as const

export interface TokensUnergy {
  access: string
  refresh: string | null
}

/** `UsuarioSerializer` del backend de operaciones (`api/v1/auth/serializers.py`). */
export interface UsuarioOperaciones {
  id: number
  email: string
  nombre: string
  rol: string
  created_at: string
  updated_at: string
}

/**
 * Los dos cuerpos de error que llegan aquí: el del backend de operaciones
 * (`{ detail }`, DRF) y el de las rutas de Nitro (`createError` responde
 * `{ message, data: { detail } }`, con el detalle anidado).
 */
interface DetalleError {
  detail?: string
  data?: { detail?: string }
}

function comoAppError(err: unknown): AppError {
  if (!isFetchError<DetalleError>(err))
    return new AppError('UNKNOWN', err instanceof Error ? err.message : String(err))

  const detalle = err.data?.detail ?? err.data?.data?.detail
  return new AppError(codeFromHttpStatus(err.status ?? 0), detalle, { cause: err })
}

export class UnergyAuthService extends BaseService {
  constructor() {
    super(ofetch.create({ retry: false }))
  }

  async login(email: string, password: string): Promise<TokensUnergy> {
    try {
      return await this.post<TokensUnergy>(RUTAS.login, { email, password })
    } catch (err) {
      throw comoAppError(err)
    }
  }

  async usuarioActual(access: string): Promise<UsuarioOperaciones> {
    try {
      return await this.get<UsuarioOperaciones>(RUTAS.me, {
        headers: { Authorization: `Bearer ${access}` },
      })
    } catch (err) {
      throw comoAppError(err)
    }
  }
}
