import { describe, expect, it } from 'vitest'
import { mensajeDeError } from './mensajeDeError'

// Bug real (2026-09-09): al crear un contrato de energía el toast decía
// «POST /api/v1/liquidaciones-api/contratos-energia failed with 400» y nada
// más. El backend sí explicaba el motivo —{"code": ["Este campo es
// requerido."]}— pero la vista solo miraba `data.detail`, que DRF no manda
// cuando el error es de validación por campo.
describe('mensajeDeError', () => {
  const axiosError = (data: unknown) => ({ response: { data }, message: 'Request failed with 400' })

  it('lee el `detail` de siempre', () => {
    expect(mensajeDeError(axiosError({ detail: 'No hay ids para actualizar' })))
      .toBe('No hay ids para actualizar')
  })

  it('arma el mensaje de los errores por campo de DRF, que era lo que se perdía', () => {
    expect(mensajeDeError(axiosError({ code: ['Este campo es requerido.'] })))
      .toBe('code: Este campo es requerido.')
  })

  it('junta varios campos y varios mensajes por campo', () => {
    const m = mensajeDeError(axiosError({
      code: ['Este campo es requerido.'],
      company: ['Este campo es requerido.'],
    }))
    expect(m).toBe('code: Este campo es requerido. · company: Este campo es requerido.')
  })

  it('acepta una lista suelta, como la que devuelve un ValidationError sin campo', () => {
    expect(mensajeDeError(axiosError(['No se enviaron campos para actualizar'])))
      .toBe('No se enviaron campos para actualizar')
  })

  it('acepta un cuerpo que ya es texto', () => {
    expect(mensajeDeError(axiosError('Error del servidor'))).toBe('Error del servidor')
  })

  it('lee tambien el cuerpo de ofetch, que lo pone en `data`', () => {
    // main usa ofetch ($fetch) y master axios: el cuerpo cambia de sitio.
    expect(mensajeDeError({ data: { code: ['Este campo es requerido.'] }, message: 'x' }))
      .toBe('code: Este campo es requerido.')
  })

  it('cae al mensaje del error cuando no hay cuerpo que leer', () => {
    expect(mensajeDeError({ message: 'Network Error' })).toBe('Network Error')
  })

  it('siempre devuelve algo, aunque no le llegue nada útil', () => {
    expect(mensajeDeError(undefined)).toBeTruthy()
    expect(mensajeDeError({})).toBeTruthy()
  })

  it('usa el respaldo que le den', () => {
    expect(mensajeDeError({}, 'No se pudo crear el contrato')).toBe('No se pudo crear el contrato')
  })
})
