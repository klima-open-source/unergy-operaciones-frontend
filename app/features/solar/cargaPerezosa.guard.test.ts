/**
 * Guard de código fuente: la carga perezosa de las tarjetas de Generación Solar.
 *
 * El detalle de UNA tarjeta cuesta cuatro llamadas externas (curva de potencia,
 * generación de hoy, y los dos medidores). Pedirlo de las ~47 plantas eran ~188
 * llamadas por carga, la mayoría de tarjetas que nadie bajaba a mirar. Ahora se
 * pide de las que están en pantalla, con un IntersectionObserver.
 *
 * Esto se prueba leyendo el archivo y no montando el componente, igual que
 * `detalleMonitoreo.guard.test.ts`: `SolarLiveView.vue` trae Chart.js,
 * vuedraggable y ocho servicios, y montarlo para verificar cuatro invariantes
 * cuesta más de lo que protege. Lo que se fija acá son justamente las cuatro
 * cosas que, si alguien las quita sin darse cuenta, NO fallan en ninguna prueba
 * y se manifiestan como una vista que se pone lenta otra vez o que se cuelga:
 *
 *   · la guarda contra recargar lo ya cargado -- sin ella, el observador dispara
 *     cada vez que una tarjeta entra y sale, y scrollear arriba y abajo pide lo
 *     mismo una y otra vez: peor que antes del cambio;
 *   · la guarda contra dos pedidos simultáneos de la misma tarjeta;
 *   · el `disconnect()` al desmontar -- un observador vivo sobre nodos muertos
 *     es una fuga que solo se nota después de un rato en la pantalla;
 *   · que el refresco automático mire solo lo visible, que es de donde sale el
 *     ahorro real cuando el auto-refresh corre cada minuto.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ARCHIVO = join(__dirname, 'components', 'SolarLiveView.vue')
const fuente = readFileSync(ARCHIVO, 'utf8')

describe('carga perezosa de las tarjetas', () => {
  it('no vuelve a pedir un detalle que ya tiene', () => {
    expect(fuente).toContain('if (!refrescar && detailMap[id] !== undefined) return')
  })

  it('no pide dos veces la misma tarjeta a la vez', () => {
    expect(fuente).toContain('detalleEnVuelo')
    expect(fuente).toContain('if (detalleEnVuelo.has(id)) return')
  })

  it('suelta la marca de "en vuelo" aunque la llamada falle', () => {
    // Sin el `finally`, una tarjeta que falla queda marcada para siempre y no
    // se vuelve a pedir nunca, ni al refrescar.
    expect(fuente).toMatch(/finally\s*\{\s*\n\s*detalleEnVuelo\.delete\(id\)/)
  })

  it('deja la tarjeta en {} si falla, no sin definir', () => {
    // `undefined` es lo que dibuja el esqueleto "Cargando datos...": dejarlo
    // así al fallar deja la tarjeta girando para siempre.
    expect(fuente).toContain('detailMap[id] = {}')
  })

  it('desconecta el observador al desmontar', () => {
    expect(fuente).toContain('observador?.disconnect()')
  })

  it('el refresco automático mira solo lo que está en pantalla', () => {
    expect(fuente).toContain('ids.filter(id => tarjetasVisibles.has(id))')
  })

  it('la primera carga no espera al observador', () => {
    // En la primera carga no hay nada dibujado todavía, así que el observador
    // no puede decir qué se ve: sin esta ola inicial la pantalla arranca vacía
    // y no se llena hasta que el usuario mueve el scroll.
    expect(fuente).toContain('ids.slice(0, tamanoPrimeraOla())')
  })

  it('sobrevive a un navegador sin IntersectionObserver', () => {
    expect(fuente).toContain("typeof IntersectionObserver !== 'undefined'")
    expect(fuente).toContain('observador?.observe(el)')
  })

  it('precarga un poco antes de que la tarjeta entre', () => {
    // Sin margen, la tarjeta empieza a pedir sus datos justo cuando ya se ve, y
    // el usuario mira el esqueleto todo el viaje de red.
    expect(fuente).toContain('rootMargin: MARGEN_PRECARGA')
  })

  it('sigue pidiendo el detalle sin la serie de 30 días', () => {
    // El otro ahorro del mismo día: si alguien lo revierte, cada tarjeta vuelve
    // a costar una llamada externa más.
    const servicio = readFileSync(join(__dirname, 'services', 'generacion-solar.ts'), 'utf8')
    expect(servicio).toContain('incluir_30d: false')
  })
})
