<template>
  <div>
    <div class="mb-3 flex flex-wrap gap-2 text-xs">
      <span
        v-if="!finalVacia"
        class="chip"
        style="border-color: var(--color-unergy-purple); color: var(--color-unergy-purple)"
        >● Final reportada</span
      >
      <span v-if="medidorPath" class="chip" style="border-color: #3b82f6; color: #3b82f6"
        >■ {{ medidorLabel }}</span
      >
      <span v-if="soleniumPath" class="chip" style="border-color: #0d9488; color: #0d9488"
        >▲ Solenium</span
      >
      <span v-if="reconectadorPath" class="chip" style="border-color: #9c8b68; color: #7a6a48"
        >⬥ Reconectador</span
      >
      <span v-if="horasRellenadas.size" class="chip" style="border-color: #f0c040; color: #b8860b"
        >◆ Hora rellenada</span
      >
      <span v-if="capacidadKwh != null" class="chip" style="border-color: #9b89b5; color: #6b5a8a"
        >┅ Capacidad efectiva ({{ capacidadMwFmt }} MW)</span
      >
    </div>
    <svg :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`" class="w-full">
      <line
        v-for="f in [0, 0.25, 0.5, 0.75, 1]"
        :key="f"
        :x1="padL"
        :x2="W - padR"
        :y1="y(maxV * f)"
        :y2="y(maxV * f)"
        stroke="#eee"
        stroke-width="1"
      />
      <text
        v-for="f in [0, 0.25, 0.5, 0.75, 1]"
        :key="'t' + f"
        :x="4"
        :y="y(maxV * f) + 3"
        font-size="9"
        fill="#9b89b5"
      >
        {{ Math.round(maxV * f) }}
      </text>
      <text
        v-for="h in [0, 6, 12, 18, 23]"
        :key="'h' + h"
        :x="x(h)"
        :y="H - 4"
        font-size="9"
        fill="#9b89b5"
        text-anchor="middle"
      >
        {{ h }}h
      </text>

      <!-- 'Final reportada' se dibuja primero, de fondo -- Medidor/Solenium
           van despues, encima, para que sus marcadores sigan siendo visibles
           incluso cuando coinciden casi exacto con el valor final (ej. Caso
           1/2, donde el medidor validado ES la fuente del total). -->
      <template v-if="!finalVacia">
        <path :d="finalArea" fill="var(--color-unergy-purple)" opacity="0.08" />
        <path :d="finalPath" fill="none" stroke="var(--color-unergy-purple)" stroke-width="3" />
        <template v-for="h in 24" :key="'p' + h">
          <rect
            v-if="horasRellenadas.has(h - 1)"
            :x="x(h - 1) - 4"
            :y="y(val(finalCurve, h - 1)) - 4"
            width="8"
            height="8"
            fill="#F0C040"
            stroke="white"
            stroke-width="1.5"
            :transform="`rotate(45 ${x(h - 1)} ${y(val(finalCurve, h - 1))})`"
          />
          <circle
            v-else
            :cx="x(h - 1)"
            :cy="y(val(finalCurve, h - 1))"
            r="3.2"
            fill="var(--color-unergy-purple)"
            stroke="white"
            stroke-width="1.5"
          />
        </template>
      </template>

      <path v-if="medidorPath" :d="medidorPath" fill="none" stroke="#3B82F6" stroke-width="2" />
      <template v-if="medidorPath">
        <rect
          v-for="h in 24"
          :key="'m' + h"
          :x="x(h - 1) - 3"
          :y="y(val(medidor, h - 1)) - 3"
          width="6"
          height="6"
          fill="#3B82F6"
          stroke="white"
          stroke-width="1"
        />
      </template>

      <path
        v-if="soleniumPath"
        :d="soleniumPath"
        fill="none"
        stroke="#0D9488"
        stroke-width="2"
        stroke-dasharray="6 4"
      />
      <template v-if="soleniumPath">
        <polygon
          v-for="h in 24"
          :key="'s' + h"
          :points="trianguloPoints(x(h - 1), y(val(solenium, h - 1)))"
          fill="#0D9488"
          stroke="white"
          stroke-width="1"
        />
      </template>

      <!-- Reconectador -- casi nunca presente (solo cuando medidor e
           inversores ya dejaron huecos ese día). Deliberadamente discreto
           (línea fina, gris-arena, dash amplio, marcador chico y hueco):
           es una referencia de apoyo, no debe competir visualmente con
           Final/Medidor/Solenium, que son las 3 series que de verdad
           importan (pedido 2026-08-21). -->
      <path
        v-if="reconectadorPath"
        :d="reconectadorPath"
        fill="none"
        stroke="#9c8b68"
        stroke-width="1.25"
        stroke-dasharray="1 4"
        opacity="0.85"
      />
      <template v-if="reconectadorPath">
        <rect
          v-for="h in 24"
          :key="'r' + h"
          :x="x(h - 1) - 2.5"
          :y="y(val(reconectador, h - 1)) - 2.5"
          width="5"
          height="5"
          fill="white"
          stroke="#9c8b68"
          stroke-width="1.25"
          opacity="0.9"
          :transform="`rotate(45 ${x(h - 1)} ${y(val(reconectador, h - 1))})`"
        />
      </template>

      <!-- Capacidad efectiva -- linea de referencia, no es una serie de datos --
           encima de todo para que siempre se vea si alguna curva la cruza. -->
      <template v-if="capacidadKwh != null">
        <line
          :x1="padL"
          :x2="W - padR"
          :y1="y(capacidadKwh)"
          :y2="y(capacidadKwh)"
          stroke="#9b89b5"
          stroke-width="1.5"
          stroke-dasharray="4 3"
        />
      </template>
    </svg>
  </div>
</template>

<script setup lang="ts">
type Curva = (number | null)[]

const props = withDefaults(
  defineProps<{
    final?: Curva
    medidor?: Curva | null
    /**
     * Cuál medidor viene en la prop `medidor` -- el padre resuelve principal
     * con fallback a respaldo, así que la etiqueta no puede ser fija (pedido
     * 2026-08-20: "Medidor" sin más era ambiguo).
     */
    medidorLabel?: string
    solenium?: Curva | null
    reconectador?: Curva | null
    horasReconectador?: number[]
    horasSolenium?: number[]
    horasHistorico?: number[]
    horasMedidorCruzado?: number[]
    /**
     * Capacidad efectiva de la frontera (MW) -- viene en MW, pero el chart
     * grafica en kWh por hora, así que se convierte (1 MW sostenida 1h = 1.000 kWh).
     */
    capacidadMw?: number | null
    /**
     * Ver finalVacia -- una curva en 0 puede ser el placeholder de Caso 1/CGM
     * (ocultar) o una corrección manual real con 'Matriz de ceros' (mostrar).
     */
    editadoManualmente?: boolean
  }>(),
  {
    final: () => Array(24).fill(null),
    medidor: null,
    medidorLabel: 'Medidor',
    solenium: null,
    reconectador: null,
    horasReconectador: () => [],
    horasSolenium: () => [],
    horasHistorico: () => [],
    horasMedidorCruzado: () => [],
    capacidadMw: null,
    editadoManualmente: false,
  },
)

const W = 700,
  H = 210,
  padL = 30,
  padR = 10,
  padT = 10,
  padB = 20
const plotW = W - padL - padR,
  plotH = H - padT - padB

const finalCurve = computed(() => props.final || Array(24).fill(null))
// Antes el chip enumeraba las fuentes ("Rellenado (reconectador + Solenium
// × FP)") -- con medidor cruzado suman ya 5 fuentes posibles entre los dos
// árboles, así que se simplifica a un solo rótulo genérico "Hora
// rellenada" (2026-08-12): el detalle de cuál fuente fue cada hora vive en
// 'Detalle de la clasificación', no hace falta repetirlo en la leyenda.
const horasRellenadas = computed(
  () =>
    new Set([
      ...(props.horasReconectador || []),
      ...(props.horasSolenium || []),
      ...(props.horasHistorico || []),
      ...(props.horasMedidorCruzado || []),
    ]),
)
// Caso 1/CGM (reporte válido): se confía en el total diario que ya validó
// Quoia -- no se reconstruye una curva horaria propia, así que 'final'
// llega en 0 las 24 horas. Mostrar esa línea plana confunde (parece un
// error); mejor ocultarla y dejar solo el medidor de referencia.
// PERO si la curva en 0 es una corrección manual real ('Matriz de ceros'),
// sí hay que mostrarla -- ahí el 0 es justo lo que la persona quiso
// reportar y confirmar visualmente (ver MGS 0081 Galeras Occidente
// 2026-08-12: corregida con Matriz de ceros, pero la línea desaparecía
// igual que en el placeholder de CGM).
const finalVacia = computed(
  () =>
    !props.editadoManualmente &&
    finalCurve.value.every((v) => v === null || v === undefined || Number(v) === 0),
)

function val(arr: Curva | null | undefined, h: number): number {
  const v = arr?.[h]
  return v === null || v === undefined ? 0 : Number(v)
}
// Triángulo pequeño centrado en (cx, cy) -- marcador propio de Solenium,
// distinto del cuadrado de Medidor y el círculo de Final, para que la
// diferencia no dependa solo del color.
function trianguloPoints(cx: number, cy: number): string {
  const r = 4
  return `${cx},${cy - r} ${cx - r},${cy + r} ${cx + r},${cy + r}`
}

const capacidadKwh = computed(() => (props.capacidadMw != null ? props.capacidadMw * 1000 : null))
const capacidadMwFmt = computed(() =>
  props.capacidadMw != null
    ? props.capacidadMw.toLocaleString('es-CO', { maximumFractionDigits: 2 })
    : '',
)

const maxV = computed(() => {
  const all = [
    ...finalCurve.value,
    ...(props.medidor || []),
    ...(props.solenium || []),
    ...(props.reconectador || []),
  ]
    .filter((v) => v !== null && v !== undefined)
    .map(Number)
  // La linea de capacidad tambien entra en el calculo del eje -- si la
  // generacion se queda muy por debajo, igual se ve la referencia completa;
  // si la generacion la supera, se ve el cruce en vez de cortarse el chart.
  if (capacidadKwh.value != null) all.push(capacidadKwh.value)
  return Math.max(1, ...all) * 1.15
})

function x(h: number): number {
  return padL + (h / 23) * plotW
}
function y(v: number): number {
  return padT + plotH - (v / maxV.value) * plotH
}

function pathDe(arr: Curva | null): string | null {
  if (!arr) return null
  let d = ''
  let tramo = false
  for (let h = 0; h < 24; h++) {
    const v = arr[h]
    if (v === null || v === undefined) {
      tramo = false
      continue
    }
    d += (!tramo ? 'M' : 'L') + x(h).toFixed(1) + ',' + y(Number(v)).toFixed(1) + ' '
    tramo = true
  }
  return d || null
}

// Un hueco horario (null) se dibuja como 0 en las 4 curvas -- decisión
// visual explícita del usuario (2026-08-12): la línea nunca se corta,
// aunque eso signifique que "sin dato" y "generó/consumió 0 de verdad" se
// vean igual en el chart (esa distinción vive en 'Detalle de la
// clasificación'/'Horas rellenadas', no hace falta repetirla acá).
function conCeros(arr: Curva | null | undefined): Curva | null {
  if (!arr) return null
  return arr.map((v) => (v === null || v === undefined ? 0 : v))
}

const finalPath = computed(() => pathDe(conCeros(finalCurve.value)) || '')
const finalArea = computed(() => {
  const base = finalPath.value
  if (!base) return ''
  return (
    base +
    ` L${x(23).toFixed(1)},${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`
  )
})
const medidorPath = computed(() => pathDe(conCeros(props.medidor)))
const soleniumPath = computed(() => pathDe(conCeros(props.solenium)))
const reconectadorPath = computed(() => pathDe(conCeros(props.reconectador)))
</script>

<style scoped>
.chip {
  border: 1px solid;
  border-radius: 999px;
  padding: 2px 10px;
  font-weight: 600;
}
</style>
