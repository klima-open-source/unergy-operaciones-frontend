/** Un resultado de la búsqueda global: lo que se muestra y la ficha a la que lleva. */
export interface ResultadoBusqueda {
  id: number
  titulo: string
  detalle: string
  /** Ruta de la ficha (`/proyectos/12`, `/contratos/340`…). */
  url: string
}

/** `GET /busqueda?q=`: hasta 6 de cada tipo. */
export interface RespuestaBusqueda {
  proyectos: ResultadoBusqueda[]
  clientes: ResultadoBusqueda[]
  contratos: ResultadoBusqueda[]
  fronteras: ResultadoBusqueda[]
}
