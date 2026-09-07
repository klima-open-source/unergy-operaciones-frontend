/**
 * Recuperación de contraseña contra el backend de operaciones
 * (`ForgotPasswordView.vue`, `ResetPasswordView.vue`).
 *
 * A diferencia de `OperacionesAuthService`, sí lleva el interceptor de sesión
 * compartido (`~/core/client.ts`): un 401/403 aquí es tan anómalo como en
 * cualquier otra llamada autenticada, no la respuesta esperada de un intento
 * fallido (ese es el caso de `login`, no de esta pantalla).
 */
import { BaseService } from '~/core/service'

const RUTAS = {
  solicitar: '/auth/forgot-password',
  restablecer: '/auth/reset-password',
} as const

export class RecuperacionPasswordService extends BaseService {
  solicitar(email: string): Promise<unknown> {
    return this.post<unknown>(RUTAS.solicitar, { email })
  }

  restablecer(token: string, password: string): Promise<unknown> {
    return this.post<unknown>(RUTAS.restablecer, { token, password })
  }
}
