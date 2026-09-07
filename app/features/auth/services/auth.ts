import type { SessionResponse, SignInRequest } from '~/features/auth/types'
import air from '@korastd/air'
import { BaseService } from '~/core/service'

/**
 * The browser's half of authentication. It talks to this app's own Nitro routes,
 * never to the auth API: the tokens live in httpOnly cookies that only the
 * server can set, and keeping the exchange server-side also keeps a separately
 * hosted auth API out of CORS.
 *
 * The server's half — the code that actually calls the auth API — is
 * `server/utils/auth-api.ts`.
 *
 * Bare `air` client, not the platform's shared one: `getMe()` answers 401 when
 * there is simply no session yet, which is a normal outcome here, not a
 * broken session the platform's interceptor should react to.
 */
export class AuthService extends BaseService {
  constructor() {
    super(air.create({ baseURL: '' }))
  }

  login(data: SignInRequest): Promise<SessionResponse> {
    return this.post<SessionResponse>('/api/auth/login', data)
  }

  logout(): Promise<unknown> {
    return this.post<unknown>('/api/auth/logout')
  }

  getMe(): Promise<SessionResponse> {
    return this.get<SessionResponse>('/api/auth/me')
  }
}
