/**
 * Un catálogo chico (operadores de red, portafolios, patrimonios…) pedido una vez
 * y compartido entre vistas, con vigencia.
 *
 * Cada vista que llenaba un desplegable lo pedía al montarse: abrir una planta,
 * su formulario y después Fronteras eran tres peticiones idénticas al Worker de
 * Cloudflare para la misma lista de operadores. Es el patrón de
 * `useProyectosCatalogo`, generalizado: los datos en `useState` (sobreviven a la
 * navegación) y la petición en vuelo compartida, para que una vista y su
 * formulario que montan a la vez no pidan dos veces.
 *
 * **Vigencia de 5 minutos e invalidación explícita.** Estos catálogos cambian
 * poco y en pocos sitios: la pantalla que los administra llama a `invalidar()`
 * después de crear, editar o borrar, y la vigencia cubre lo que se cambie desde
 * otra pestaña o por otra persona.
 *
 * Un fallo no se guarda: se lanza, y la siguiente llamada vuelve a intentarlo.
 * Debe llamarse dentro de `setup()` (usa `useState`); `cargar()` se puede llamar
 * después desde cualquier lado.
 */
const VIGENCIA_MS = 5 * 60_000

/** La petición en curso por catálogo. Una promesa no es serializable: no va en `useState`. */
const enVuelo = new Map<string, Promise<unknown>>()

export function useCatalogoCompartido<T>(clave: string, pedir: () => Promise<T>) {
  const datos = useState<T | null>(`catalogo:${clave}`, () => null)
  const cargadoEn = useState<number>(`catalogo:${clave}:ts`, () => 0)

  /** El catálogo, del caché si está vigente y de la red si no. */
  function cargar(): Promise<T> {
    if (datos.value !== null && Date.now() - cargadoEn.value < VIGENCIA_MS) {
      return Promise.resolve(datos.value as T)
    }
    const pendiente = enVuelo.get(clave) as Promise<T> | undefined
    if (pendiente) return pendiente
    const peticion = pedir()
      .then((valor) => {
        datos.value = valor
        cargadoEn.value = Date.now()
        return valor
      })
      .finally(() => enVuelo.delete(clave))
    enVuelo.set(clave, peticion)
    return peticion
  }

  /** La próxima `cargar()` va a la red. Para después de crear, editar o borrar. */
  function invalidar(): void {
    cargadoEn.value = 0
  }

  return { cargar, invalidar }
}
