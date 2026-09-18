<template>
  <div class="flex flex-col gap-4">
    <!-- Encabezado -->
    <div class="flex items-center gap-2.5">
      <ChartLineIcon class="size-4 text-primary" />
      <h2 class="text-base font-bold text-foreground">Generación</h2>
      <span class="hidden text-xs text-muted-foreground sm:inline">
        · Compara la energía generada por proyecto
      </span>
      <div class="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="!datasets.length" @click="exportarExcel">
          <FileSpreadsheetIcon />
          Excel
        </Button>
        <Button variant="outline" size="sm" :disabled="loading" @click="cargar">
          <LoaderCircleIcon v-if="loading" class="animate-spin" />
          <RefreshCwIcon v-else />
          Actualizar
        </Button>
      </div>
    </div>

    <!-- Filtros -->
    <Card size="sm">
      <CardContent class="flex flex-wrap items-center gap-2.5">
        <!-- 1) Granularidad -->
        <div class="flex items-center gap-1">
          <Button
            v-for="g in GRANULARIDADES"
            :key="g.key"
            type="button"
            :variant="granularidad === g.key ? 'secondary' : 'outline'"
            size="sm"
            @click="onGranularidadChange(g.key)"
          >
            <component :is="g.icon" />
            {{ g.label }}
          </Button>
        </div>

        <!-- 2) Modo -->
        <div class="flex items-center gap-1">
          <Button
            v-for="m in modosActuales"
            :key="m.key"
            type="button"
            :variant="modo === m.key ? 'secondary' : 'outline'"
            size="sm"
            @click="onModoChange(m.key)"
          >
            {{ m.label }}
          </Button>
        </div>

        <!-- 3) Selector contextual según granularidad + modo -->
        <Select
          v-if="granularidad === 'mensual' && modo === 'anio'"
          :model-value="String(anioSel)"
          @update:model-value="
            (v) => {
              anioSel = Number(v)
              aplicarModo()
            }
          "
        >
          <SelectTrigger class="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="a in aniosDisponibles" :key="a.value" :value="String(a.value)">{{
              a.label
            }}</SelectItem>
          </SelectContent>
        </Select>

        <div v-else-if="modo === 'intervalo'" class="flex items-center gap-1.5">
          <Input
            v-model="rangoDesdeInput"
            :type="rangoEsMensual ? 'month' : 'date'"
            :max="rangoEsMensual ? hoyMes : hoyDia"
            class="w-auto"
          />
          <span class="text-muted-foreground">→</span>
          <Input
            v-model="rangoHastaInput"
            :type="rangoEsMensual ? 'month' : 'date'"
            :max="rangoEsMensual ? hoyMes : hoyDia"
            class="w-auto"
          />
        </div>

        <Input
          v-else-if="granularidad === 'diaria' && modo === 'mes'"
          v-model="mesSelInput"
          type="month"
          :max="hoyMes"
          class="w-auto"
        />

        <Input
          v-else-if="granularidad === 'horaria' && modo === 'dia'"
          v-model="diaSelInput"
          type="date"
          :max="hoyDia"
          class="w-auto"
        />

        <!-- Etiqueta del rango resuelto -->
        <Badge variant="secondary">
          <CalendarClockIcon />
          {{ rangoLabel }}
        </Badge>

        <!-- Avisos -->
        <span
          v-if="rangoError && rangoError !== 'Selecciona un rango'"
          class="flex items-center gap-1 text-xs font-medium text-destructive"
        >
          <CircleAlertIcon class="size-3.5" /> {{ rangoError }}
        </span>
        <span
          v-else-if="avisoRango"
          class="flex items-center gap-1 text-xs font-medium text-warning"
        >
          <InfoIcon class="size-3.5" /> {{ avisoRango }}
        </span>

        <!-- Selección de proyectos -->
        <Popover v-model:open="proyectosPickerOpen">
          <PopoverTrigger as-child>
            <Button variant="outline" class="min-w-56 flex-1 justify-start font-normal">
              <span v-if="!proyectosSel.length" class="text-muted-foreground"
                >Selecciona proyectos…</span
              >
              <span v-else
                >{{ proyectosSel.length }} proyecto{{
                  proyectosSel.length > 1 ? 's' : ''
                }}
                seleccionados</span
              >
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-80 p-0" align="start">
            <div class="border-b border-border p-2">
              <Input v-model="proyectosFiltro" placeholder="Buscar proyecto..." />
            </div>
            <div class="max-h-72 overflow-y-auto p-1">
              <label
                v-for="p in proyectosFiltrados"
                :key="p.sub_project"
                class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox
                  :model-value="proyectosSel.includes(p.sub_project)"
                  @update:model-value="() => toggleProyecto(p.sub_project)"
                />
                <span class="min-w-0 flex-1 truncate">{{ p.nombre_comercial }}</span>
                <span class="shrink-0 text-xs text-muted-foreground">{{ p.municipio }}</span>
              </label>
              <p
                v-if="!proyectosFiltrados.length"
                class="px-2 py-3 text-center text-sm text-muted-foreground"
              >
                Sin resultados.
              </p>
            </div>
          </PopoverContent>
        </Popover>

        <!-- Consultar -->
        <Button
          :variant="pendiente && proyectosSel.length && !rangoError ? 'default' : 'outline'"
          :disabled="!proyectosSel.length || !!rangoError"
          :title="
            !proyectosSel.length
              ? 'Selecciona al menos un proyecto'
              : rangoError
                ? 'Corrige el rango de fechas'
                : 'Consultar generación'
          "
          @click="cargar"
        >
          <LoaderCircleIcon v-if="loading" class="animate-spin" />
          <SearchIcon v-else />
          Consultar
        </Button>
      </CardContent>
    </Card>

    <p v-if="proyectos.length" class="flex items-center gap-1.5 text-xs text-muted-foreground">
      <ZapIcon class="size-3.5" />
      {{ proyectos.length }} proyectos disponibles · generación en vivo desde la API de Unergy
    </p>

    <!-- Estados vacíos -->
    <Card v-if="!proyectosSel.length">
      <CardContent class="flex flex-col items-center gap-1 py-12 text-center">
        <InfoIcon class="mb-2 size-8 text-primary" />
        <p class="text-base font-semibold text-foreground">
          Selecciona uno o más proyectos para comenzar
        </p>
        <p class="text-sm text-muted-foreground">
          Elige proyectos y un rango, luego presiona <strong>Consultar</strong>.
        </p>
      </CardContent>
    </Card>

    <Card v-else-if="loading">
      <CardContent class="flex flex-col items-center gap-3 py-12 text-center">
        <LoaderCircleIcon class="size-8 animate-spin text-primary" />
        <p class="text-sm text-muted-foreground">Cargando datos de generación…</p>
      </CardContent>
    </Card>

    <Card v-else-if="error">
      <CardContent class="flex items-start gap-3">
        <CircleAlertIcon class="mt-0.5 size-5 shrink-0 text-destructive" />
        <div class="flex-1">
          <p class="font-semibold text-destructive">No se pudo consultar la generación</p>
          <p class="mt-0.5 text-sm text-muted-foreground">{{ error }}</p>
        </div>
        <Button variant="outline" size="sm" @click="cargar">
          <RefreshCwIcon />
          Reintentar
        </Button>
      </CardContent>
    </Card>

    <Card v-else-if="!hasQueried">
      <CardContent class="flex flex-col items-center gap-1 py-12 text-center">
        <SearchIcon class="mb-2 size-8 text-primary" />
        <p class="text-base font-semibold text-foreground">Listo para consultar</p>
        <p class="text-sm text-muted-foreground">
          Ajusta el rango y la granularidad, luego presiona Consultar.
        </p>
        <Button class="mt-3" :disabled="!!rangoError" @click="cargar">
          <LoaderCircleIcon v-if="loading" class="animate-spin" />
          <SearchIcon v-else />
          Consultar
        </Button>
      </CardContent>
    </Card>

    <Card v-else-if="!datasets.length || datasets.every((d) => !d.points.length)">
      <CardContent class="flex flex-col items-center gap-1 py-12 text-center">
        <DatabaseIcon class="mb-2 size-8 text-muted-foreground" />
        <p class="text-base font-semibold text-foreground">Sin datos para el rango seleccionado</p>
        <p class="text-sm text-muted-foreground">
          Los proyectos seleccionados no tienen generación registrada en este intervalo. Prueba con
          un rango más amplio o fechas anteriores.
        </p>
        <Button variant="outline" class="mt-3" @click="verEsteAnioMensual">
          <CalendarIcon />
          Ver el año en curso (mensual)
        </Button>
      </CardContent>
    </Card>

    <!-- Contenido principal -->
    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card size="sm">
          <CardContent class="flex items-center gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning"
            >
              <ZapIcon class="size-4" />
            </div>
            <div>
              <div class="text-xl font-extrabold text-foreground">{{ fmtNum(totalKwh) }}</div>
              <div class="text-xs font-medium text-muted-foreground uppercase">kWh totales</div>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent class="flex items-center gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <ChartColumnIcon class="size-4" />
            </div>
            <div>
              <div class="text-xl font-extrabold text-foreground">
                {{
                  fmtNum(totalKwh / Math.max(1, datasets.length) / Math.max(1, periodos.length), 1)
                }}
              </div>
              <div class="text-xs font-medium text-muted-foreground uppercase">
                Promedio kWh / {{ unidadPeriodo }}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent class="flex items-center gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success"
            >
              <TrophyIcon class="size-4" />
            </div>
            <div>
              <div class="truncate text-sm font-extrabold text-foreground">
                {{ topProyecto?.nombre || '—' }}
              </div>
              <div class="text-xs font-medium text-muted-foreground uppercase">
                Mayor generación
              </div>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent class="flex items-center gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            >
              <CalendarIcon class="size-4" />
            </div>
            <div>
              <div class="text-sm font-extrabold text-foreground">
                {{ periodos.length }} {{ unidadPeriodoPlural }}
              </div>
              <div class="text-xs font-medium text-muted-foreground uppercase">
                Período cubierto
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Gráfica -->
      <Card>
        <CardHeader>
          <CardTitle>{{ tituloGrafico }}</CardTitle>
          <CardAction class="flex items-center gap-1">
            <Button
              type="button"
              :variant="tipoGrafico === 'line' ? 'secondary' : 'outline'"
              size="icon-sm"
              aria-label="Líneas"
              @click="tipoGrafico = 'line'"
            >
              <ChartLineIcon />
            </Button>
            <Button
              type="button"
              :variant="tipoGrafico === 'bar' ? 'secondary' : 'outline'"
              size="icon-sm"
              aria-label="Barras"
              @click="tipoGrafico = 'bar'"
            >
              <ChartColumnIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent class="flex flex-col gap-3">
          <!-- Legend -->
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="ds in datasets"
              :key="ds.proyectoId"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs transition-opacity hover:bg-muted"
              :class="ds.hidden ? 'opacity-40' : ''"
              @click="ds.hidden = !ds.hidden"
            >
              <span class="size-2 shrink-0 rounded-full" :style="{ background: ds.color }" />
              <span class="font-medium text-foreground">{{ ds.nombre }}</span>
              <Badge v-if="ds.fuente === 'cruda'" variant="outline" :title="TITULO_CRUDA"
                >sin verificar</Badge
              >
              <span class="text-muted-foreground">{{ fmtNum(ds.total) }} kWh</span>
            </button>
            <!-- No es un boton: la meta no se apaga, es la referencia. -->
            <span
              v-if="hayMetaP90"
              class="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
            >
              <span class="h-0 w-3.5 border-t-2 border-dashed border-warning" />
              <span class="font-medium text-foreground">
                Meta P90 ({{ granularidad === 'diaria' ? 'diaria' : 'mensual' }})
              </span>
            </span>
          </div>

          <!-- SVG chart -->
          <div ref="chartWrapRef" class="relative w-full">
            <svg
              ref="chartSvgRef"
              :viewBox="`0 0 ${chartW} ${chartH}`"
              preserveAspectRatio="none"
              class="block h-70 w-full"
              @mousemove="onChartMove"
              @mouseleave="onChartLeave"
            >
              <!-- Y grid lines + labels -->
              <g>
                <template v-for="(y, i) in yTicks" :key="'y' + i">
                  <line
                    :x1="paddingL"
                    :x2="chartW - paddingR"
                    :y1="yToPx(y)"
                    :y2="yToPx(y)"
                    class="stroke-border"
                    stroke-dasharray="3 3"
                  />
                  <text
                    :x="paddingL - 6"
                    :y="yToPx(y) + 3.5"
                    class="fill-muted-foreground text-[9px]"
                    text-anchor="end"
                  >
                    {{ fmtYTick(y) }}
                  </text>
                </template>
              </g>
              <!-- X labels -->
              <g>
                <text
                  v-for="(p, i) in xLabels"
                  :key="'x' + i"
                  :x="xToPx(p.idx)"
                  :y="chartH - paddingB / 2 + 4"
                  class="fill-muted-foreground text-[9px]"
                  :text-anchor="i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'"
                >
                  {{ p.label }}
                </text>
              </g>
              <!-- Line series -->
              <template v-if="tipoGrafico === 'line'">
                <g v-for="ds in datasets.filter((d) => !d.hidden)" :key="ds.proyectoId">
                  <polyline
                    :points="lineaPoints(ds)"
                    fill="none"
                    :stroke="ds.color"
                    stroke-width="2"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                  <circle
                    v-for="(pt, i) in ds.points"
                    :key="i"
                    :cx="xToPx(i)"
                    :cy="yToPx(pt.kwh)"
                    r="2.5"
                    :fill="ds.color"
                  />
                </g>
              </template>
              <!-- Bar series -->
              <template v-else>
                <g v-for="(p, i) in periodos" :key="'b' + i">
                  <rect
                    v-for="(ds, j) in datasets.filter((d) => !d.hidden)"
                    :key="ds.proyectoId"
                    :x="barX(i, j, datasets.filter((d) => !d.hidden).length)"
                    :y="yToPx(ds.points[i]?.kwh ?? 0)"
                    :width="barW(datasets.filter((d) => !d.hidden).length)"
                    :height="Math.max(0, chartH - paddingB - yToPx(ds.points[i]?.kwh ?? 0))"
                    :fill="ds.color"
                    rx="1.5"
                  />
                </g>
              </template>

              <!-- Meta P90 de la simulación. Punteada y gris: es una referencia,
                   no una medición, y no debe competir con las series reales. -->
              <polyline
                v-if="hayMetaP90"
                :points="metaP90Points"
                fill="none"
                stroke="#f59e0b"
                stroke-width="2"
                stroke-dasharray="6 4"
                stroke-linejoin="round"
                pointer-events="none"
              />

              <!-- Fallas con impacto en generación: subrayado rojo del día/período -->
              <g v-if="periodosFlagged.length" pointer-events="none">
                <template v-for="i in periodosFlagged" :key="'fl' + i">
                  <line
                    :x1="xToPx(i)"
                    :x2="xToPx(i)"
                    :y1="paddingT"
                    :y2="chartH - paddingB"
                    class="stroke-destructive/35"
                    stroke-dasharray="2 3"
                  />
                  <line
                    :x1="xToPx(i) - marcadorHalfW"
                    :x2="xToPx(i) + marcadorHalfW"
                    :y1="chartH - paddingB + 2.5"
                    :y2="chartH - paddingB + 2.5"
                    class="stroke-destructive"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                  <circle :cx="xToPx(i)" :cy="paddingT + 2" r="2.6" class="fill-destructive" />
                </template>
              </g>

              <!-- Hover: línea guía vertical + puntos resaltados -->
              <g v-if="hover" pointer-events="none">
                <line
                  :x1="hover.gx"
                  :x2="hover.gx"
                  :y1="paddingT"
                  :y2="chartH - paddingB"
                  class="stroke-primary/75"
                  stroke-dasharray="4 3"
                />
                <circle
                  v-for="s in hoverSeries"
                  :key="'h' + s.proyectoId"
                  :cx="hover.gx"
                  :cy="yToPx(s.kwh)"
                  r="4"
                  :fill="s.color"
                  stroke="#fff"
                  stroke-width="1.5"
                />
              </g>
            </svg>

            <!-- Tooltip: valor de X (período) y de Y (kWh) bajo el cursor -->
            <div
              v-if="hover"
              class="absolute z-10 max-w-60 min-w-36 rounded-lg border border-border bg-popover p-2.5 text-xs shadow-md"
              :style="{
                left: `${hover.tipLeft}px`,
                top: `${hover.tipTop}px`,
                transform: hover.flip
                  ? 'translate(calc(-100% - 12px), -50%)'
                  : 'translate(12px, -50%)',
              }"
            >
              <div class="mb-1 font-bold whitespace-nowrap text-foreground">{{ hover.label }}</div>
              <div
                v-for="s in hoverSeries"
                :key="'t' + s.proyectoId"
                class="flex items-center gap-1.5 py-px"
              >
                <span class="size-2 shrink-0 rounded-full" :style="{ background: s.color }" />
                <span class="flex-1 truncate text-muted-foreground">{{ s.nombre }}</span>
                <span class="font-bold text-foreground tabular-nums"
                  >{{ fmtNum(s.kwh, 1) }} kWh</span
                >
              </div>
              <div
                v-if="hoverSeries.length > 1"
                class="mt-1 flex items-center gap-1.5 border-t border-border pt-1"
              >
                <span class="flex-1 text-muted-foreground">Total</span>
                <span class="font-bold text-foreground tabular-nums"
                  >{{ fmtNum(hoverTotal, 1) }} kWh</span
                >
              </div>
              <div
                v-if="hoverFalla"
                class="mt-1.5 flex items-center gap-1.5 border-t border-border pt-1.5 font-bold text-destructive"
              >
                <TriangleAlertIcon class="size-3.5" />
                {{ hoverFalla.count }} falla{{ hoverFalla.count !== 1 ? 's' : '' }} de generación ·
                {{ fmtNum(hoverFalla.kwh) }} kWh perdidos
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Fallas reportadas en el período -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <TriangleAlertIcon class="size-4 text-destructive" />
            Fallas reportadas en el período
          </CardTitle>
          <CardAction class="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{{ fallasDelPeriodo.length }} en total</Badge>
            <Badge v-if="fallasGenCount" variant="destructive"
              >{{ fallasGenCount }} afectan generación</Badge
            >
            <Badge v-if="kwhPerdidoTotal > 0" variant="destructive"
              >{{ fmtNum(kwhPerdidoTotal) }} kWh perdidos</Badge
            >
          </CardAction>
        </CardHeader>
        <CardContent>
          <div
            v-if="fallasCargando && !allFallas.length"
            class="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground"
          >
            <LoaderCircleIcon class="size-6 animate-spin" />
            <p>Cargando fallas…</p>
          </div>
          <div
            v-else-if="!fallasDelPeriodo.length"
            class="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground"
          >
            <CircleCheckIcon class="size-6 text-success" />
            <p>Sin fallas reportadas en este intervalo para los proyectos seleccionados.</p>
          </div>
          <div v-else class="flex flex-col gap-3">
            <div class="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Falla</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Energía perdida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="f in fallasVisibles"
                    :key="f.id"
                    class="cursor-pointer"
                    :class="
                      involucraGeneracion(f) ? 'bg-destructive/5 hover:bg-destructive/10' : ''
                    "
                    @click="router.push(`/fallas/${f.id}`)"
                  >
                    <TableCell class="font-medium whitespace-nowrap">{{
                      fmtFechaCorta(f.fecha_identificacion)
                    }}</TableCell>
                    <TableCell>{{ f.proyecto?.nombre_comercial || '—' }}</TableCell>
                    <TableCell>
                      <div class="font-medium text-foreground">
                        {{ f.tipo?.etiqueta || 'Sin tipo' }}
                      </div>
                      <div class="line-clamp-1 max-w-90 text-xs text-muted-foreground">
                        {{ f.descripcion }}
                      </div>
                    </TableCell>
                    <TableCell>
                      <GBadge :color="colorPrioridad(f.prioridad?.codigo)">{{
                        f.prioridad?.etiqueta || '—'
                      }}</GBadge>
                    </TableCell>
                    <TableCell>
                      <GBadge :color="colorEstado(f.estado?.codigo)">{{
                        f.estado?.etiqueta || '—'
                      }}</GBadge>
                    </TableCell>
                    <TableCell>
                      <Badge v-if="involucraGeneracion(f)" variant="destructive">
                        <ZapIcon /> {{ fmtNum(energiaPerdida(f)) }} kWh
                      </Badge>
                      <span v-else class="text-muted-foreground">—</span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div v-if="fallasTotalPages > 1" class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground"
                >Página {{ fallasPagina }} de {{ fallasTotalPages }}</span
              >
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="fallasPagina <= 1"
                  @click="fallasPagina--"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="fallasPagina >= fallasTotalPages"
                  @click="fallasPagina++"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { toast } from 'vue-sonner'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import { useRouter } from 'vue-router'
import { MonitoreoLegacyService } from '~/features/operaciones/services/monitoreo-legacy'
import { FallasService } from '~/features/fallas/services/fallas'
import {
  CalendarClockIcon,
  CalendarIcon,
  ChartColumnIcon,
  ChartLineIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  InfoIcon,
  ListIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  TriangleAlertIcon,
  TrophyIcon,
  ZapIcon,
} from '@lucide/vue'

const router = useRouter()
const monitoreoLegacyService = new MonitoreoLegacyService()
const fallasService = new FallasService()

// ── Constantes ────────────────────────────────────────────────────────
const MESES_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]
const PALETTE = [
  '#915BD8',
  '#2563eb',
  '#10b981',
  '#D4A017',
  '#dc2626',
  '#0891b2',
  '#7c3aed',
  '#db2777',
  '#65a30d',
  '#0d9488',
]

const GRANULARIDADES = [
  { key: 'mensual', label: 'Mensual', icon: CalendarIcon },
  { key: 'diaria', label: 'Diaria', icon: ListIcon },
  { key: 'horaria', label: 'Horaria', icon: ClockIcon },
]

// Modos de selección por granularidad: presets rápidos + intervalo libre.
// La unidad natural de cada granularidad: año (mensual), mes (diaria), día (horaria).
const MODOS = {
  mensual: [
    { key: 'actual', label: 'Este año' },
    { key: 'pasado', label: 'Año pasado' },
    { key: 'anio', label: 'Año…' },
    { key: 'intervalo', label: 'Intervalo' },
  ],
  diaria: [
    { key: 'actual', label: 'Este mes' },
    { key: 'mes', label: 'Mes…' },
    { key: 'intervalo', label: 'Intervalo' },
  ],
  horaria: [
    { key: 'ayer', label: 'Ayer' },
    { key: 'dia', label: 'Día…' },
    { key: 'intervalo', label: 'Intervalo' },
  ],
}
const MODO_DEFAULT = { mensual: 'actual', diaria: 'actual', horaria: 'ayer' }

const hoy = new Date()
hoy.setHours(0, 0, 0, 0)
// Tope de los inputs de fecha/mes: no se puede consultar generación futura.
const hoyMes = toMonthInput(hoy)
const hoyDia = isoDate(hoy)

// ── Estado ───────────────────────────────────────────────────────────
const loading = ref(false)
const error = ref(null)
const proyectos = ref([])
const proyectosSel = ref([])
const proyectosPickerOpen = ref(false)
const proyectosFiltro = ref('')

const granularidad = ref('diaria')
const modo = ref('actual')
const fechaDesde = ref(new Date())
const fechaHasta = ref(new Date())
// Selectores específicos por modo:
const anioSel = ref(new Date().getFullYear()) // mensual · "Año…"
const mesSel = ref(new Date()) // diaria  · "Mes…"  (cualquier día del mes)
const diaSel = ref(new Date()) // horaria · "Día…"
const rango = ref(null) // modo intervalo: UN solo picker de rango [desde, hasta]

/**
 * Solo se marca la CRUDA, no la verificada.
 *
 * Lo normal es que la curva venga de lecturas revisadas --medido contra la API
 * el 2026-09-12: 19 de 20 plantas las tenian-- asi que etiquetar las dos
 * llenaria la leyenda de ruido para senalar lo esperado. Se marca la excepcion,
 * que es la que cambia como leer el numero.
 */
const TITULO_CRUDA =
  'Esta planta no tiene lecturas verificadas por un operador en la API de ' +
  'Unergy, asi que se muestran todas tal como llegaron del medidor. No es ' +
  'estrictamente comparable con las curvas verificadas ni con la meta P90.'

const datasets = ref([])
const tipoGrafico = ref('line')
const chartWrapRef = ref(null)
const chartSvgRef = ref(null)
const chartContainerWidth = ref(900)

// Hover sobre la gráfica: período (X) + valor kWh (Y) de cada serie bajo el cursor.
const hover = ref(null) // { idx, gx, tipLeft, tipTop, flip, label } | null

// Consulta manual: hasQueried distingue "aún no consultado" de "sin datos";
// pendiente resalta el botón Consultar cuando hay cambios sin aplicar.
const hasQueried = ref(false)
const pendiente = ref(false)

// ── Modo de selección + cálculo de fechas ─────────────────────────────
const modosActuales = computed(() => MODOS[granularidad.value] || [])

const aniosDisponibles = computed(() => {
  const y = new Date().getFullYear()
  const arr = []
  for (let a = y; a >= 2019; a--) arr.push({ label: String(a), value: a })
  return arr
})

// Mapa sub_project → nombre comercial (para etiquetar cada serie).
const nombrePorSub = computed(() => {
  const m = {}
  for (const p of proyectos.value) if (p.sub_project) m[p.sub_project] = p.nombre_comercial
  return m
})

const proyectosFiltrados = computed(() => {
  const q = proyectosFiltro.value.trim().toLowerCase()
  if (!q) return proyectos.value
  return proyectos.value.filter((p) => (p.nombre_comercial || '').toLowerCase().includes(q))
})

function toggleProyecto(sub) {
  proyectosSel.value = proyectosSel.value.includes(sub)
    ? proyectosSel.value.filter((s) => s !== sub)
    : [...proyectosSel.value, sub]
  onProyectosChange()
}

// ── Adaptadores para <input type="month"|"date"> ──────────────────────
function toMonthInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function fromMonthInput(v) {
  const [y, m] = v.split('-').map(Number)
  return new Date(y, m - 1, 1)
}
function fromDateInput(v) {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const mesSelInput = computed({
  get: () => toMonthInput(mesSel.value),
  set: (v) => {
    if (!v) return
    mesSel.value = fromMonthInput(v)
    aplicarModo()
  },
})
const diaSelInput = computed({
  get: () => isoDate(diaSel.value),
  set: (v) => {
    if (!v) return
    diaSel.value = fromDateInput(v)
    aplicarModo()
  },
})

// El rango comparte un solo picker "desde/hasta" para las tres granularidades:
// mensual usa <input type="month">, diaria/horaria usan <input type="date">.
const rangoEsMensual = computed(() => granularidad.value === 'mensual')

const rangoDesdeInput = computed({
  get: () => {
    const d = rango.value?.[0] ?? fechaDesde.value
    return rangoEsMensual.value ? toMonthInput(d) : isoDate(d)
  },
  set: (v) => setRango(0, v),
})
const rangoHastaInput = computed({
  get: () => {
    const d = rango.value?.[1] ?? rango.value?.[0] ?? fechaHasta.value
    return rangoEsMensual.value ? toMonthInput(d) : isoDate(d)
  },
  set: (v) => setRango(1, v),
})
function setRango(idx, v) {
  if (!v) return
  const d = rangoEsMensual.value ? fromMonthInput(v) : fromDateInput(v)
  const current = rango.value ? [...rango.value] : [d, d]
  current[idx] = d
  rango.value = current
  aplicarModo()
}

function finDeAnioOHoy(y) {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const last = new Date(y, 11, 31)
  return last > t ? t : last
}
function finDeMesOHoy(y, m) {
  // m 0-based
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const last = new Date(y, m + 1, 0)
  return last > t ? t : last
}

// Rango del picker único (modo intervalo) para día/hora → [desde, hasta] normalizado.
function rangoDiasSel() {
  const r = rango.value || []
  const a = r[0] ? new Date(r[0]) : new Date(fechaDesde.value)
  const b = r[1] ? new Date(r[1]) : new Date(r[0] || fechaHasta.value)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return b < a ? [b, a] : [a, b]
}
// Rango del picker único (modo intervalo mensual) → límites de mes.
function rangoMesesSel() {
  const r = rango.value || []
  const a0 = r[0] ? new Date(r[0]) : new Date(fechaDesde.value)
  const b0 = r[1] ? new Date(r[1]) : new Date(r[0] || fechaHasta.value)
  const a = new Date(a0.getFullYear(), a0.getMonth(), 1)
  const b = finDeMesOHoy(b0.getFullYear(), b0.getMonth())
  return b < a
    ? [new Date(b0.getFullYear(), b0.getMonth(), 1), finDeMesOHoy(a0.getFullYear(), a0.getMonth())]
    : [a, b]
}

// Calcula fechaDesde/fechaHasta a partir de {granularidad, modo, selectores}.
function recomputarFechas() {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const y = t.getFullYear()
  let d = null,
    h = null
  if (granularidad.value === 'mensual') {
    if (modo.value === 'actual') {
      d = new Date(y, 0, 1)
      h = finDeAnioOHoy(y)
    } else if (modo.value === 'pasado') {
      d = new Date(y - 1, 0, 1)
      h = new Date(y - 1, 11, 31)
    } else if (modo.value === 'anio') {
      const yy = anioSel.value || y
      d = new Date(yy, 0, 1)
      h = finDeAnioOHoy(yy)
    } else {
      ;[d, h] = rangoMesesSel()
    }
  } else if (granularidad.value === 'diaria') {
    if (modo.value === 'actual') {
      d = new Date(y, t.getMonth(), 1)
      h = new Date(t)
    } else if (modo.value === 'mes') {
      const m = mesSel.value || t
      d = new Date(m.getFullYear(), m.getMonth(), 1)
      h = finDeMesOHoy(m.getFullYear(), m.getMonth())
    } else {
      ;[d, h] = rangoDiasSel()
    }
  } else {
    // horaria
    if (modo.value === 'ayer') {
      const ay = new Date(t)
      ay.setDate(ay.getDate() - 1)
      d = ay
      h = new Date(ay)
    } else if (modo.value === 'dia') {
      const dd = new Date(diaSel.value || t)
      dd.setHours(0, 0, 0, 0)
      d = dd
      h = new Date(dd)
    } else {
      ;[d, h] = rangoDiasSel()
    }
  }
  if (d) fechaDesde.value = d
  if (h) fechaHasta.value = h
}

function aplicarModo() {
  recomputarFechas()
  marcarPendiente()
}

function onGranularidadChange(g) {
  if (g === granularidad.value) return
  granularidad.value = g
  modo.value = MODO_DEFAULT[g]
  recomputarFechas()
  marcarPendiente()
}

function onModoChange(m) {
  if (m === modo.value) return
  modo.value = m
  // Al entrar a "intervalo", precarga el picker de rango con el rango vigente.
  if (m === 'intervalo') rango.value = [new Date(fechaDesde.value), new Date(fechaHasta.value)]
  recomputarFechas()
  marcarPendiente()
}

// Atajo desde el estado "sin datos": vista mensual del año en curso.
function verEsteAnioMensual() {
  granularidad.value = 'mensual'
  modo.value = 'actual'
  recomputarFechas()
  cargar()
}

// Marca que hay filtros sin aplicar (resalta el botón Consultar).
function marcarPendiente() {
  pendiente.value = true
}

// Cambio en la selección de proyectos: si se vacía, limpia resultados.
function onProyectosChange() {
  pendiente.value = true
  if (!proyectosSel.value.length) {
    datasets.value = []
    hasQueried.value = false
    error.value = null
  }
}

// ── Validación (sin límites de tamaño: sólo coherencia) ───────────────
const rangoDias = computed(() => {
  if (!fechaDesde.value || !fechaHasta.value) return 0
  return Math.max(0, Math.ceil((fechaHasta.value - fechaDesde.value) / 86400000) + 1)
})
const rangoError = computed(() => {
  if (!fechaDesde.value || !fechaHasta.value) return 'Selecciona un rango'
  if (fechaHasta.value < fechaDesde.value)
    return 'La fecha final debe ser igual o posterior a la inicial'
  return null
})
// Aviso NO bloqueante (rango horario muy amplio puede truncarse en la API).
const avisoRango = computed(() =>
  granularidad.value === 'horaria' && rangoDias.value > 31
    ? 'Rango horario amplio: la API puede truncar lecturas muy extensas.'
    : null,
)

// Etiqueta legible del rango resuelto (feedback claro de qué se va a consultar).
const rangoLabel = computed(() => {
  const d = fechaDesde.value,
    h = fechaHasta.value
  if (!d || !h) return ''
  if (granularidad.value === 'mensual')
    return `${MESES_ES[d.getMonth()]} ${d.getFullYear()} → ${MESES_ES[h.getMonth()]} ${h.getFullYear()}`
  const f = (x) =>
    `${String(x.getDate()).padStart(2, '0')} ${MESES_ES[x.getMonth()].toLowerCase()} ${x.getFullYear()}`
  if (d.getTime() === h.getTime()) return f(d)
  return `${f(d)} → ${f(h)}`
})

// ── Período label helper ─────────────────────────────────────────────
const unidadPeriodo = computed(
  () => ({ mensual: 'mes', diaria: 'día', horaria: 'hora' })[granularidad.value],
)
const unidadPeriodoPlural = computed(
  () => ({ mensual: 'meses', diaria: 'días', horaria: 'horas' })[granularidad.value],
)

// ── Carga (datos EN VIVO de la API de Unergy vía /monitoreo/_legacy) ──────
// La generación NO vive en la tabla local; se consulta a api.unergy.io con el
// sub_project de cada proyecto (misma fuente que usa el resto de la plataforma).
async function cargar() {
  if (!proyectosSel.value.length || rangoError.value) return
  loading.value = true
  error.value = null
  pendiente.value = false
  hasQueried.value = true
  // Snapshot del query → el panel de fallas se alinea con lo que muestra la gráfica.
  qDesde.value = new Date(fechaDesde.value)
  qHasta.value = new Date(fechaHasta.value)
  qNombres.value = proyectosSel.value.map((sub) => nombrePorSub.value[sub]).filter(Boolean)
  try {
    const fInicio = isoDate(fechaDesde.value)
    const fFin = isoDate(fechaHasta.value)

    // En paralelo con la generacion: el panel de fallas es independiente y no
    // debe retrasar la grafica, que es lo que se vino a ver.
    cargarFallas(fInicio, fFin)

    // Una llamada por proyecto: getGeneration trae lecturas en vivo de Unergy.
    // Endpoint real: /api/v1/monitoreo/_legacy (baseURL del cliente ya es /api/v1).
    const results = await Promise.allSettled(
      proyectosSel.value.map((sub) =>
        monitoreoLegacyService
          .obtenerGeneracion({ sub_project: sub, date_from: fInicio, date_to: fFin })
          .then((body) => ({ sub, body })),
      ),
    )

    const parsed = []
    const errores = []
    results.forEach((r, idx) => {
      const sub = proyectosSel.value[idx]
      const nombre = nombrePorSub.value[sub] || sub
      if (r.status !== 'fulfilled') {
        const reason = r.reason
        const msg = reason?.data?.detail || reason?.message || 'error de conexión'
        errores.push(`${nombre}: ${msg}`)
        return
      }
      const body = r.value.body
      if (body && body.ok === false) {
        errores.push(`${nombre}: ${body.error || 'la API de Unergy no devolvió datos'}`)
        return
      }
      const raw = Array.isArray(body?.data) ? body.data : []
      // `simulation` viene desde siempre y esta vista la tiraba: la curva se
      // dibujaba sin nada contra que compararla.
      parsed.push({
        sub,
        nombre,
        map: sumarPorGranularidad(raw),
        sim: body?.simulation ?? null,
        fuente: body?.fuente ?? null,
      })
    })

    // Si TODAS fallaron, es un fallo real: mostrarlo (no "sin datos").
    if (!parsed.length && errores.length) {
      error.value =
        errores.length === 1 ? errores[0] : `No se pudo consultar ningún proyecto. ${errores[0]}`
      datasets.value = []
      return
    }
    if (errores.length) {
      toast.warning('Algunos proyectos no cargaron', {
        description: errores.join(' · '),
        duration: 6000,
      })
    }

    // Eje común continuo → todas las series quedan alineadas en chart y tabla.
    const keys = construirEjeKeys()
    const ds = parsed.map((p, idx) => {
      const points = keys.map((k) => ({ key: k, kwh: p.map.get(k) ?? 0, label: labelDeClave(k) }))
      const total = points.reduce((s, pt) => s + pt.kwh, 0)
      return {
        proyectoId: p.sub,
        nombre: p.nombre,
        color: PALETTE[idx % PALETTE.length],
        points,
        total,
        hidden: false,
        sim: p.sim,
        fuente: p.fuente,
      }
    })
    ds.sort((a, b) => b.total - a.total)
    datasets.value = ds
  } catch (e) {
    error.value = e.data?.detail || e.message || 'Error de conexión'
  } finally {
    loading.value = false
  }
}

// ── Agregación por granularidad ───────────────────────────────────────
// raw: [{ time: 'YYYY-MM-DD HH:MM', date: 'YYYY-MM-DD', kwh: number }] (deltas por intervalo)
function sumarPorGranularidad(raw) {
  const map = new Map()
  for (const it of raw) {
    if (it == null || it.kwh == null) continue
    let k = null
    if (granularidad.value === 'diaria') k = it.date
    else if (granularidad.value === 'mensual') k = (it.date || '').slice(0, 7)
    else {
      // horaria: agrupa por hora real usando el timestamp de la lectura
      const t = it.time || ''
      k =
        t.length >= 13
          ? `${t.slice(0, 10)} ${t.slice(11, 13)}:00`
          : it.date
            ? `${it.date} 00:00`
            : null
    }
    if (!k) continue
    map.set(k, (map.get(k) || 0) + Number(it.kwh))
  }
  return map
}

// Eje continuo de períodos en el rango seleccionado (alinea todas las series).
function construirEjeKeys() {
  const keys = []
  if (!fechaDesde.value || !fechaHasta.value) return keys
  const start = new Date(fechaDesde.value)
  start.setHours(0, 0, 0, 0)
  const end = new Date(fechaHasta.value)
  end.setHours(0, 0, 0, 0)
  if (granularidad.value === 'diaria') {
    const cur = new Date(start)
    while (cur <= end) {
      keys.push(isoDate(cur))
      cur.setDate(cur.getDate() + 1)
    }
  } else if (granularidad.value === 'mensual') {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cur <= last) {
      keys.push(isoDate(cur).slice(0, 7))
      cur.setMonth(cur.getMonth() + 1)
    }
  } else {
    const cur = new Date(start)
    const endH = new Date(end)
    endH.setHours(23, 0, 0, 0)
    while (cur <= endH) {
      keys.push(`${isoDate(cur)} ${String(cur.getHours()).padStart(2, '0')}:00`)
      cur.setHours(cur.getHours() + 1)
    }
  }
  return keys
}

function labelDeClave(k) {
  if (granularidad.value === 'mensual') return mesLabel(k)
  if (granularidad.value === 'horaria') return `${k.slice(8, 10)}/${k.slice(5, 7)} ${k.slice(11)}`
  return diaLabel(k)
}

function mesLabel(yyyymm) {
  const [y, m] = yyyymm.split('-')
  return `${MESES_ES[+m - 1]} ${y.slice(2)}`
}

function diaLabel(yyyymmdd) {
  const [, m, d] = yyyymmdd.split('-')
  return `${d}/${m}`
}

function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Período + chart data ─────────────────────────────────────────────
const periodos = computed(() => datasets.value[0]?.points || [])

const totalKwh = computed(() => datasets.value.reduce((s, d) => s + (d.hidden ? 0 : d.total), 0))

const topProyecto = computed(() => {
  const sorted = [...datasets.value].filter((d) => !d.hidden).sort((a, b) => b.total - a.total)
  return sorted[0] || null
})

const tituloGrafico = computed(() => {
  if (!datasets.value.length) return 'Sin datos'
  const d1 = isoDate(fechaDesde.value)
  const d2 = isoDate(fechaHasta.value)
  return `Generación ${granularidad.value === 'mensual' ? 'mensual' : granularidad.value === 'diaria' ? 'diaria' : 'horaria'} · ${d1} → ${d2}`
})

// ── Chart geometry (SVG) ─────────────────────────────────────────────
const paddingL = 50
const paddingR = 20
const paddingT = 16
const paddingB = 30
const chartH = 280
const chartW = computed(() => chartContainerWidth.value)

/**
 * La meta P90 de cada periodo del eje, sumando los proyectos visibles.
 *
 * El backend manda `curva_p90_kwh`: los doce valores mensuales del proyecto, que
 * son ENERGIA DEL MES. De ahi salen los dos casos que tienen sentido dibujar:
 *
 *   · mensual -> el valor del mes, tal cual;
 *   · diaria  -> ese valor repartido entre los dias de ESE mes.
 *
 * En horaria no se dibuja nada. Repartir la energia del mes entre sus horas
 * daria una linea plana que no se parece a nada: la generacion solar no es
 * uniforme --de noche es cero-- asi que esa "meta" estaria inventada.
 *
 * Se usan los doce valores y no el `p90_monthly` que tambien viene, porque ese
 * es el del mes en que ARRANCA el rango: con un rango de enero a diciembre
 * pintaria la referencia de enero sobre los doce meses, y el P90 varia fuerte
 * por estacion.
 *
 * `null` en un periodo --no cero-- cuando ningun proyecto visible tiene curva:
 * un cero se lee como "la meta era no generar nada".
 */
const metaP90 = computed(() => {
  if (granularidad.value === 'horaria') return []
  const visibles = datasets.value.filter((d) => !d.hidden && d.sim?.curva_p90_kwh)
  if (!visibles.length) return []

  return periodos.value.map((p) => {
    const [anio, mes] = p.key.split('-').map(Number)
    if (!anio || !mes) return null
    const diasDelMes = new Date(anio, mes, 0).getDate()
    let suma = 0
    let alguno = false
    for (const ds of visibles) {
      const delMes = Number(ds.sim.curva_p90_kwh[mes - 1])
      if (!Number.isFinite(delMes) || delMes <= 0) continue
      suma += granularidad.value === 'diaria' ? delMes / diasDelMes : delMes
      alguno = true
    }
    return alguno ? suma : null
  })
})

const hayMetaP90 = computed(() => metaP90.value.some((v) => v != null))

/** La polilinea de la meta, saltando los periodos sin dato. */
const metaP90Points = computed(() =>
  metaP90.value
    .map((v, i) => (v == null ? null : `${xToPx(i)},${yToPx(v)}`))
    .filter(Boolean)
    .join(' '),
)

const maxY = computed(() => {
  let max = 0
  datasets.value.forEach((d) => {
    if (d.hidden) return
    d.points.forEach((p) => {
      if (p.kwh > max) max = p.kwh
    })
  })
  // La meta entra en la escala: si no, una planta que rinde por debajo deja la
  // linea fuera del grafico y no se ve justo cuando mas importa.
  metaP90.value.forEach((v) => {
    if (v != null && v > max) max = v
  })
  return max > 0 ? max * 1.08 : 10
})

const yTicks = computed(() => {
  const max = maxY.value
  const step = max / 4
  return [0, step, step * 2, step * 3, max]
})

function yToPx(y) {
  if (maxY.value === 0) return chartH - paddingB
  return paddingT + (1 - y / maxY.value) * (chartH - paddingT - paddingB)
}

function xToPx(idx) {
  const n = periodos.value.length
  if (n <= 1) return paddingL
  return paddingL + (idx / (n - 1)) * (chartW.value - paddingL - paddingR)
}

function lineaPoints(ds) {
  return ds.points.map((p, i) => `${xToPx(i)},${yToPx(p.kwh)}`).join(' ')
}

function barX(periodIdx, dsIdx, dsCount) {
  const slotW = (chartW.value - paddingL - paddingR) / Math.max(1, periodos.value.length)
  const innerW = slotW * 0.7
  const barWidth = innerW / Math.max(1, dsCount)
  return paddingL + slotW * periodIdx + (slotW - innerW) / 2 + barWidth * dsIdx
}
function barW(dsCount) {
  const slotW = (chartW.value - paddingL - paddingR) / Math.max(1, periodos.value.length)
  return (slotW * 0.7) / Math.max(1, dsCount)
}

const xLabels = computed(() => {
  const n = periodos.value.length
  if (n === 0) return []
  // Show max ~8 labels evenly distributed
  const stride = Math.max(1, Math.ceil(n / 8))
  const labels = []
  for (let i = 0; i < n; i += stride) {
    labels.push({ idx: i, label: periodos.value[i].label })
  }
  // Always show the last one
  if (labels[labels.length - 1]?.idx !== n - 1) {
    labels.push({ idx: n - 1, label: periodos.value[n - 1].label })
  }
  return labels
})

function fmtYTick(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'k'
  return v.toFixed(0)
}

// Separador de miles = espacio (evita confundirlo con la coma decimal), coma decimal.
function fmtNum(v, maxDecimals = 0) {
  return (v ?? 0)
    .toLocaleString('es-CO', { maximumFractionDigits: maxDecimals })
    .replace(/\./g, ' ')
}

// ── Hover (tooltip de valores X/Y) ───────────────────────────────────
// Series visibles con su valor en el período bajo el cursor.
const hoverSeries = computed(() => {
  if (!hover.value) return []
  const i = hover.value.idx
  return datasets.value
    .filter((d) => !d.hidden)
    .map((d) => ({
      proyectoId: d.proyectoId,
      color: d.color,
      nombre: d.nombre,
      kwh: d.points[i]?.kwh ?? 0,
    }))
})
const hoverTotal = computed(() => hoverSeries.value.reduce((s, d) => s + d.kwh, 0))

function onChartMove(e) {
  const n = periodos.value.length
  if (!n || !chartSvgRef.value) {
    hover.value = null
    return
  }
  const rect = chartSvgRef.value.getBoundingClientRect()
  if (!rect.width) return
  // mapea pixel del cursor → coordenada X del viewBox (preserveAspectRatio=none ⇒ lineal)
  const userX = ((e.clientX - rect.left) / rect.width) * chartW.value
  const span = chartW.value - paddingL - paddingR
  let idx = n <= 1 ? 0 : Math.round(((userX - paddingL) / span) * (n - 1))
  idx = Math.max(0, Math.min(n - 1, idx))
  const wrapRect = chartWrapRef.value?.getBoundingClientRect()
  const tipLeft = wrapRect ? e.clientX - wrapRect.left : 0
  const tipTop = wrapRect ? e.clientY - wrapRect.top : 0
  const flip = wrapRect ? tipLeft > wrapRect.width * 0.6 : false
  hover.value = {
    idx,
    gx: xToPx(idx),
    tipLeft,
    tipTop,
    flip,
    label: periodos.value[idx]?.label || '',
  }
}
function onChartLeave() {
  hover.value = null
}

// ── Fallas del período + correlación con la gráfica ───────────────────
function energiaPerdida(f) {
  const v = f?.kwh_perdidos_estimado
  return v == null ? 0 : Number(v) || 0
}
function involucraGeneracion(f) {
  return energiaPerdida(f) > 0
}

// ── Fallas del período (correlación generación ↔ incidencias) ─────────
const allFallas = ref([])
const fallasCargando = ref(false)
// Snapshot del rango/proyectos consultados, para que el panel de fallas coincida
// con lo que MUESTRA la gráfica (no con filtros aún sin aplicar).
const qDesde = ref(null)
const qHasta = ref(null)
const qNombres = ref([]) // nombres_comerciales consultados

// Fallas de los proyectos consultados dentro del rango consultado (snapshot).
const fallasDelPeriodo = computed(() => {
  if (!qDesde.value || !qHasta.value || !qNombres.value.length) return []
  const nombres = new Set(qNombres.value)
  const desde = isoDate(qDesde.value)
  const hasta = isoDate(qHasta.value)
  return allFallas.value
    .filter((f) => {
      const fi = (f.fecha_identificacion || '').slice(0, 10)
      if (!fi || fi < desde || fi > hasta) return false
      return nombres.has(f.proyecto?.nombre_comercial)
    })
    .sort((a, b) => (b.fecha_identificacion || '').localeCompare(a.fecha_identificacion || ''))
})

const fallasGenCount = computed(() => fallasDelPeriodo.value.filter(involucraGeneracion).length)
const kwhPerdidoTotal = computed(() =>
  fallasDelPeriodo.value.reduce((s, f) => s + energiaPerdida(f), 0),
)

// Días con fallas que impactan generación → para subrayar en rojo.
const faultsByDay = computed(() => {
  const m = {} // 'YYYY-MM-DD' → { count, kwh }
  for (const f of fallasDelPeriodo.value) {
    if (!involucraGeneracion(f)) continue
    const d = (f.fecha_identificacion || '').slice(0, 10)
    if (!d) continue
    if (!m[d]) m[d] = { count: 0, kwh: 0 }
    m[d].count++
    m[d].kwh += energiaPerdida(f)
  }
  return m
})
const flaggedMonths = computed(() => {
  const s = {}
  for (const d in faultsByDay.value) {
    const mk = d.slice(0, 7)
    if (!s[mk]) s[mk] = { count: 0, kwh: 0 }
    s[mk].count += faultsByDay.value[d].count
    s[mk].kwh += faultsByDay.value[d].kwh
  }
  return s
})

// Info de fallas-generación para la clave de un período del eje (según granularidad).
function infoFallaPeriodo(key) {
  if (!key) return null
  if (granularidad.value === 'mensual') return flaggedMonths.value[key] || null
  if (granularidad.value === 'horaria') return faultsByDay.value[key.slice(0, 10)] || null
  return faultsByDay.value[key] || null // diaria
}

// Índices de períodos marcados (para los subrayados rojos).
const periodosFlagged = computed(() =>
  periodos.value.map((p, i) => (infoFallaPeriodo(p.key) ? i : -1)).filter((i) => i >= 0),
)
// Medio ancho del marcador rojo en coordenadas SVG.
const marcadorHalfW = computed(() => {
  const n = periodos.value.length
  if (n <= 1) return 6
  const span = chartW.value - paddingL - paddingR
  return Math.max(3, Math.min(12, (span / (n - 1)) * 0.4))
})
// Info de falla del período bajo el cursor (para el tooltip).
const hoverFalla = computed(() => {
  if (!hover.value) return null
  return infoFallaPeriodo(periodos.value[hover.value.idx]?.key)
})

function fmtFechaCorta(d) {
  if (!d) return '—'
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
  })
}

// ── Tabla de fallas: paginación simple sobre lo ya cargado ────────────
const FALLAS_POR_PAGINA = 10
const fallasPagina = ref(1)
watch(fallasDelPeriodo, () => {
  fallasPagina.value = 1
})
const fallasTotalPages = computed(() =>
  Math.max(1, Math.ceil(fallasDelPeriodo.value.length / FALLAS_POR_PAGINA)),
)
const fallasVisibles = computed(() => {
  const start = (fallasPagina.value - 1) * FALLAS_POR_PAGINA
  return fallasDelPeriodo.value.slice(start, start + FALLAS_POR_PAGINA)
})

// ── Tabla (detalle para exportar) ─────────────────────────────────────
const tablaFilas = computed(() => {
  return periodos.value.map((p, i) => {
    const row = { periodo: p.label, total: 0 }
    datasets.value.forEach((ds) => {
      const v = ds.points[i]?.kwh
      if (v != null) {
        row[ds.proyectoId] = v
        row.total += v
      }
    })
    return row
  })
})

// ── Export Excel ─────────────────────────────────────────────────────
async function exportarExcel() {
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // Hoja 1: Resumen
    const resumen = [
      ['Reporte de Generación'],
      [`Generado: ${new Date().toLocaleString('es-CO')}`],
      [`Granularidad: ${unidadPeriodo.value}`],
      [`Período: ${isoDate(fechaDesde.value)} → ${isoDate(fechaHasta.value)}`],
      [`Proyectos: ${datasets.value.map((d) => d.nombre).join(', ')}`],
      [],
      ['Proyecto', 'Total kWh', `Promedio kWh/${unidadPeriodo.value}`],
      ...datasets.value.map((d) => [
        d.nombre,
        Number(d.total.toFixed(2)),
        Number((d.total / Math.max(1, d.points.length)).toFixed(2)),
      ]),
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(resumen)
    ws1['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen')

    // Hoja 2: Detalle
    const headers = [unidadPeriodo.value, ...datasets.value.map((d) => d.nombre), 'Total']
    const rows = tablaFilas.value.map((r) => {
      const arr = [r.periodo]
      datasets.value.forEach((ds) =>
        arr.push(r[ds.proyectoId] != null ? Number(r[ds.proyectoId].toFixed(2)) : null),
      )
      arr.push(Number(r.total.toFixed(2)))
      return arr
    })
    const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws2['!cols'] = [{ wch: 14 }, ...datasets.value.map(() => ({ wch: 18 })), { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Detalle')

    const filename = `generacion_${granularidad.value}_${isoDate(fechaDesde.value)}_${isoDate(fechaHasta.value)}.xlsx`
    XLSX.writeFile(wb, filename)
    toast.success('Excel descargado', { description: filename, duration: 2500 })
  } catch (e) {
    toast.error('Error al exportar', { description: e?.message, duration: 4000 })
  }
}

// ── Carga inicial ────────────────────────────────────────────────────
// Proyectos consultables = los que tienen sub_project (API ID Unergy).
// getProjects ya filtra a proyectos en operación con ID de API y lo entrega.
async function cargarProyectos() {
  try {
    const data = await monitoreoLegacyService.obtenerProyectos()
    const seen = new Set()
    proyectos.value = (data?.projects ?? [])
      .filter((p) => {
        if (!p.sub_project || seen.has(p.sub_project)) return false
        seen.add(p.sub_project)
        return true
      })
      .sort((a, b) => (a.nombre_comercial || '').localeCompare(b.nombre_comercial || ''))
  } catch {
    error.value = 'No se pudieron cargar los proyectos'
  }
}

/**
 * Las fallas del período consultado.
 *
 * Antes se traía el historial COMPLETO --6.400 fallas-- al abrir la pestaña,
 * antes de que se eligiera nada, para después filtrarlo en el navegador por
 * fecha y por planta. Dos problemas:
 *
 * 1. Eran 33 peticiones de arranque, cada una con el serializer entero de la
 *    lista de fallas (seis relaciones anidadas y trece campos calculados) de
 *    los que esta vista usa ocho.
 * 2. El bucle contaba páginas de 200 y el servidor las sirve de 100, así que
 *    cada página se solapaba 100 filas con la anterior y la lista se cortaba
 *    en la 3.400: llegaban 3.200 fallas DUPLICADAS y faltaba el 47% del
 *    historial. `kWh perdido` salía inflado sobre una base incompleta.
 *
 * Ahora el rango va en la petición (`fecha_identificacion_desde/hasta`, que el
 * backend no aceptaba y se agregó para esto) y la lista cabe casi siempre en
 * una sola respuesta. Si no cupiera, `completarPaginas` la completa sola: el
 * bucle de acá, que era el que duplicaba, ya no existe.
 *
 * Se llama desde `cargar()`, no al montar: hasta que no se aprieta Consultar no
 * se sabe qué período mirar.
 */
async function cargarFallas(desde, hasta) {
  fallasCargando.value = true
  try {
    const res = await fallasService.listar({
      fecha_identificacion_desde: desde,
      fecha_identificacion_hasta: hasta,
      size: 100,
    })
    allFallas.value = res.items ?? []
  } catch {
    /* no crítico: la gráfica funciona sin el cruce de fallas */
  } finally {
    fallasCargando.value = false
  }
}

// ── ResizeObserver para chart responsive ─────────────────────────────
let resizeObserver
onMounted(async () => {
  recomputarFechas() // fija el rango inicial según granularidad/modo por defecto
  await cargarProyectos()
  await nextTick()
  if (chartWrapRef.value) {
    const upd = () => {
      chartContainerWidth.value = chartWrapRef.value?.clientWidth || 900
    }
    upd()
    resizeObserver = new ResizeObserver(upd)
    resizeObserver.observe(chartWrapRef.value)
  }
})

watch(chartWrapRef, (el) => {
  if (el && resizeObserver) resizeObserver.observe(el)
})
</script>
