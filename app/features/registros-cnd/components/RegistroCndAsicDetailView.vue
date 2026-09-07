<template>
  <div class="space-y-4" v-if="reg">
    <!-- Cabecera -->
    <div class="flex items-center gap-3">
      <Button text rounded @click="$router.push('/registros-cnd-asic')">
        <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
      </Button>
      <div class="flex-1">
        <h1 class="text-lg font-bold" style="color:var(--color-unergy-deep);">{{ reg.nombre_comercial }}</h1>
        <p class="text-xs mt-0.5" style="color:#9b89b5;">
          {{ [reg.codigo_cnd, reg.clasificacion_regulatoria, reg.tecnologia, reg.operador_red].filter(Boolean).join(' · ') || '—' }}
        </p>
      </div>
      <div class="text-right">
        <div class="text-2xl font-bold" style="color:var(--color-unergy-purple-dark);">{{ reg.avance_pct }}%</div>
        <div class="text-xs" style="color:#9b89b5;">avance</div>
      </div>
    </div>

    <div class="rounded-full overflow-hidden" style="height:10px;background:#ECE7F2;">
      <div :style="`height:100%;width:${Math.min(100, reg.avance_pct)}%;background:linear-gradient(90deg,var(--color-unergy-purple),var(--color-unergy-purple-dark));transition:width .5s;`"></div>
    </div>

    <!-- ============ MAPA DEL PROCESO (estilo mundos de plataformas) ============ -->
    <div class="mapa-card">
      <div class="mapa-header">
        <span class="mapa-titulo">Mapa del proceso de conexión</span>
        <div class="mapa-leyenda">
          <span><i class="dot" style="background:var(--color-unergy-purple)"></i>Completada</span>
          <span><i class="dot ring" ></i>En progreso</span>
          <span><i class="dot" style="background:#f3eefb;border:2px solid #d9c9f0"></i>Pendiente</span>
          <span><i class="dot" style="background:#fde8e8;border:2px solid #e05252"></i>Bloqueada</span>
        </div>
      </div>

      <div class="mapa-wrap">
        <svg viewBox="0 0 1040 320" class="mapa-svg" preserveAspectRatio="xMidYMid meet">
          <!-- lanes -->
          <text x="16" y="46" class="lane-label">PROCESO PRINCIPAL</text>
          <text x="16" y="300" class="lane-label frontera">FRONTERA · línea paralela</text>

          <!-- senderos (dibujados primero, los nodos los tapan) -->
          <g fill="none" stroke="#cdbcec" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 12">
            <!-- principal 1-2-3-4-5-8 -->
            <path d="M96,96 L250,96 L410,96 L560,96 L700,96 L860,96" />
            <!-- 8 -> energizacion -->
            <path d="M860,96 C925,96 955,135 980,164" />
            <!-- bifurcacion de frontera (desde CREG174 / 9.1) -->
            <path d="M96,120 C110,215 245,250 384,250" stroke="#a9d8c0" />
            <!-- frontera 6-7 -->
            <path d="M410,250 L620,250" stroke="#a9d8c0" />
            <!-- 7 -> energizacion (convergencia) -->
            <path d="M646,250 C800,250 915,215 976,178" stroke="#a9d8c0" />
          </g>

          <!-- etiqueta bifurcacion -->
          <text x="150" y="185" class="hint">se puede iniciar desde CREG 174 / 9.1</text>

          <!-- nodos de etapa -->
          <g v-for="n in mapaNodos" :key="n.etapa" class="nodo" @click="seleccionar(n.etapa)">
            <!-- anillo de seleccion -->
            <circle v-if="n.etapa === seleccionada" :cx="n.x" :cy="n.y" r="34" fill="none" stroke="var(--color-unergy-yellow)" stroke-width="4" />
            <!-- anillo pulsante si es la etapa actual -->
            <circle v-if="n.etapa === etapaActual" :cx="n.x" :cy="n.y" r="33" fill="none" stroke="var(--color-unergy-purple)" stroke-width="3" class="anillo-actual" />
            <circle :cx="n.x" :cy="n.y" r="26" :fill="fillNodo(n.status)" :stroke="strokeNodo(n.status)" stroke-width="3" />
            <text :x="n.x" :y="n.y + 6" text-anchor="middle" class="nodo-num" :fill="textNodo(n.status)">{{ n.num }}</text>
            <!-- badge completada -->
            <template v-if="n.status === 'completa'">
              <circle :cx="n.x + 18" :cy="n.y - 18" r="9" fill="#3fb984" stroke="#fff" stroke-width="2" />
              <text :x="n.x + 18" :y="n.y - 14" text-anchor="middle" class="check">✓</text>
            </template>
            <!-- marcador de posicion actual -->
            <text v-if="n.etapa === etapaActual" :x="n.x" :y="n.y - 40" text-anchor="middle" class="sol">☀</text>
            <!-- etiqueta -->
            <text :x="n.x" :y="n.y + (n.y > 150 ? 46 : -38)" text-anchor="middle" class="nodo-label">{{ n.label }}</text>
          </g>

          <!-- meta: energizacion -->
          <g>
            <circle :cx="GOAL.x" :cy="GOAL.y" r="24" fill="var(--color-unergy-deep)" />
            <text :x="GOAL.x" :y="GOAL.y + 7" text-anchor="middle" style="font-size:22px">🏁</text>
            <text :x="GOAL.x" :y="GOAL.y + 46" text-anchor="middle" class="nodo-label" style="fill:var(--color-unergy-deep);font-weight:700">Energización</text>
          </g>
        </svg>
      </div>

      <!-- Panel de la etapa seleccionada -->
      <div v-if="etapaSel" class="etapa-panel">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div class="text-sm font-bold" style="color:var(--color-unergy-deep);">{{ etapaSel.etiqueta }}</div>
            <div class="text-xs" style="color:#9b89b5;">
              Estado: <span class="font-semibold" style="color:var(--color-unergy-purple-dark);">{{ estadoLabel(etapaSel.estado_actual) }}</span>
              <span v-if="etapaSel.responsable_actual"> · resp: {{ etapaSel.responsable_actual }}</span>
              · {{ etapaSel.ganado_pct }}/{{ etapaSel.total_pct }}%
            </div>
          </div>
          <div class="flex gap-2">
            <Button v-if="seleccionada === 'ETAPA_5_REQ_9_3'" label="Editar parámetros 9.3" size="small" text @click="activeTab = 2">
              <template #icon><SlidersHorizontalIcon class="size-[1em]" /></template>
            </Button>
            <Button v-if="seleccionada === 'ETAPA_6_FRONTERA' || seleccionada === 'ETAPA_7_REGISTRO_ASIC'" label="Equipos y documentos" size="small" text @click="activeTab = 3">
              <template #icon><BoxIcon class="size-[1em]" /></template>
            </Button>
          </div>
        </div>

        <div class="flex items-center gap-1 flex-wrap mt-3">
          <span class="text-xs" style="color:#9b89b5;">Avanzar a:</span>
          <button v-for="s in siguientesEstados(etapaSel)" :key="s"
            class="pill" :disabled="transicionando" @click="hacerTransicion(etapaSel.etapa, s)">
            {{ estadoLabel(s) }}
          </button>
          <span v-if="!siguientesEstados(etapaSel).length" class="text-xs" style="color:#9b89b5;">— sin transiciones disponibles</span>
        </div>

        <div class="mt-3">
          <div class="text-xs font-semibold mb-1" style="color:var(--color-unergy-deep);">Hitos de esta etapa</div>
          <div v-for="h in hitosDeEtapa(seleccionada)" :key="h.hito" class="hito-linea">
            <span class="font-mono font-semibold" :style="`color:${h.completado ? '#3fb984' : '#9b89b5'}`">{{ h.completado ? '✓' : '○' }} {{ h.codigo }}</span>
            <span class="flex-1" style="color:var(--color-unergy-deep);">{{ h.descripcion }}</span>
            <span style="color:var(--color-unergy-purple-dark);font-weight:600">{{ h.peso_pct }}%</span>
          </div>
          <div v-if="!hitosDeEtapa(seleccionada).length" class="text-xs" style="color:#9b89b5;">Sin hitos ponderados en esta etapa.</div>
        </div>
      </div>

      <div v-if="reg.bloqueos?.length" class="bloqueos">
        <span class="font-semibold" style="color:#b91c1c;">⛔ Bloqueos:</span>
        <span v-for="b in reg.bloqueos" :key="b.etapa" style="color:var(--color-unergy-deep);"> {{ b.etiqueta }} ({{ b.motivo }});</span>
      </div>
    </div>

    <!-- ============ Datos del proyecto (pestañas) ============ -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden" style="border:1px solid #e8e0f0;">
      <TabView v-model:activeIndex="activeTab">
        <!-- 0. GENERAL -->
        <TabPanel header="General">
          <div class="grid md:grid-cols-3 gap-3 p-1">
            <label class="text-xs" style="color:var(--color-unergy-deep);">N° expediente
              <InputText v-model="general.numero_expediente" class="w-full" /></label>
            <label class="text-xs" style="color:var(--color-unergy-deep);">ID requerimiento OR
              <InputText v-model="general.id_requerimiento_or" class="w-full" /></label>
            <label class="text-xs" style="color:var(--color-unergy-deep);">N° solicitud appweb
              <InputText v-model="general.numero_solicitud_appweb" class="w-full" /></label>
            <label class="text-xs" style="color:var(--color-unergy-deep);">Fecha conexión estimada
              <input type="date" v-model="general.fecha_conexion_estimada" class="w-full border rounded px-2 py-1" style="border-color:#e8e0f0;" /></label>
            <label class="text-xs" style="color:var(--color-unergy-deep);">Vigencia CREG 174 / ámbito
              <input type="date" v-model="general.vigencia_aprobacion_conexion" class="w-full border rounded px-2 py-1" style="border-color:#e8e0f0;" /></label>
            <label class="text-xs" style="color:var(--color-unergy-deep);">Fecha visita protecciones
              <input type="date" v-model="general.fecha_visita_protecciones" class="w-full border rounded px-2 py-1" style="border-color:#e8e0f0;" /></label>
            <label class="text-xs" style="color:var(--color-unergy-deep);">Tipo visita protecciones
              <Select v-model="general.tipo_visita_protecciones" :options="cat.tipos_visita" showClear placeholder="—" class="w-full" /></label>
            <label class="text-xs col-span-2" style="color:var(--color-unergy-deep);">Punto de conexión (texto)
              <InputText v-model="general.punto_conexion_texto" class="w-full" /></label>
            <label class="text-xs col-span-3" style="color:var(--color-unergy-deep);">Notas
              <Textarea v-model="general.notas" rows="2" class="w-full" /></label>
            <div class="flex gap-4 col-span-3">
              <label class="flex items-center gap-2 text-sm" style="color:var(--color-unergy-deep);">
                <Checkbox v-model="general.exporta" :binary="true" /> Exporta energía</label>
              <label class="flex items-center gap-2 text-sm" style="color:var(--color-unergy-deep);">
                <Checkbox v-model="general.comercializador_es_or" :binary="true" /> Comercializador es el OR</label>
            </div>
          </div>
          <Button label="Guardar datos generales" size="small" class="mt-2" :loading="guardandoGeneral" @click="guardarGeneral" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);">
            <template #icon><SaveIcon class="size-[1em]" /></template>
          </Button>
        </TabPanel>

        <!-- 1. HITOS -->
        <TabPanel header="Hitos">
          <DataTable :value="reg.hitos" class="text-sm" rowHover>
            <Column field="codigo" header="Hito" style="width:80px">
              <template #body="{ data }">
                <span class="font-mono font-semibold">{{ data.completado ? '✓ ' : '' }}{{ data.codigo }}</span>
              </template>
            </Column>
            <Column field="descripcion" header="Descripción" />
            <Column field="peso_pct" header="Peso" style="width:80px">
              <template #body="{ data }">{{ data.peso_pct }}%</template>
            </Column>
            <Column header="Estado" style="width:110px">
              <template #body="{ data }">
                <GBadge :color="data.completado ? 'success' : 'default'" class="text-xs">{{ data.completado ? 'Completado' : 'Pendiente' }}</GBadge>
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- 2. PARÁMETROS 9.3 -->
        <TabPanel header="Parámetros 9.3">
          <div class="grid md:grid-cols-2 gap-4 p-1">
            <div>
              <div class="text-sm font-semibold mb-2" style="color:var(--color-unergy-deep);">Parámetros técnicos</div>
              <div class="grid grid-cols-2 gap-2">
                <label v-for="f in campos93" :key="f.k" class="text-xs" style="color:var(--color-unergy-deep);">
                  {{ f.label }}
                  <input type="number" step="any" v-model.number="params[f.k]" class="w-full border rounded px-2 py-1 mt-0.5" style="border-color:#e8e0f0;" />
                </label>
              </div>
              <Button label="Guardar parámetros" size="small" class="mt-3" :loading="guardandoParams" @click="guardarParams" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);">
                <template #icon><SaveIcon class="size-[1em]" /></template>
              </Button>
            </div>
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="text-sm font-semibold" style="color:var(--color-unergy-deep);">Validación</div>
                <GBadge v-if="validacion"
                  :color="validacion.sin_parametros ? 'default' : (validacion.valido ? 'success' : 'destructive')" class="text-xs">{{ validacion.sin_parametros ? 'sin datos' : (validacion.valido ? 'sin errores' : 'con errores') }}</GBadge>
              </div>
              <div v-if="validacion && validacion.resultados.length" class="space-y-1">
                <div v-for="(r, i) in validacion.resultados" :key="i" class="flex items-center justify-between text-xs rounded px-2 py-1" style="background:#faf8fd;">
                  <span style="color:var(--color-unergy-deep);">{{ r.regla }}</span>
                  <GBadge :color="sevColor(r.severidad)" class="text-xs" :title="r.mensaje">{{ r.severidad }}</GBadge>
                </div>
              </div>
              <p v-else class="text-xs" style="color:#9b89b5;">Guarda parámetros para ver la validación.</p>
            </div>
          </div>
        </TabPanel>

        <!-- 3. FRONTERA Y DOCUMENTOS -->
        <TabPanel header="Frontera y documentos">
          <div class="space-y-5 p-1">
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="text-sm font-semibold" style="color:var(--color-unergy-deep);">Equipos de frontera</div>
                <Button label="Agregar equipo" size="small" text @click="abrirEquipo">
                  <template #icon><PlusIcon class="size-[1em]" /></template>
                </Button>
              </div>
              <DataTable :value="equipos" class="text-sm" rowHover>
                <template #empty><div class="py-4 text-center text-xs" style="color:#9b89b5;">Sin equipos.</div></template>
                <Column field="tipo" header="Tipo" />
                <Column field="marca" header="Marca" />
                <Column field="modelo" header="Modelo" />
                <Column field="serial" header="Serial" />
                <Column field="fecha_vencimiento_calibracion" header="Venc. calibración" />
                <Column header="" style="width:48px">
                  <template #body="{ data }">
                    <Button text rounded size="small" severity="danger" @click="borrarEquipo(data)">
                      <template #icon><Trash2Icon class="size-[1em]" /></template>
                    </Button>
                  </template>
                </Column>
              </DataTable>
            </div>
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="text-sm font-semibold" style="color:var(--color-unergy-deep);">Documentos</div>
                <Button label="Agregar documento" size="small" text @click="abrirDoc">
                  <template #icon><PlusIcon class="size-[1em]" /></template>
                </Button>
              </div>
              <DataTable :value="documentos" class="text-sm" rowHover>
                <template #empty><div class="py-4 text-center text-xs" style="color:#9b89b5;">Sin documentos.</div></template>
                <Column field="tipo" header="Tipo" />
                <Column field="radicado" header="Radicado" />
                <Column field="estado" header="Estado" />
                <Column field="firmado_por" header="Firmado por" />
                <Column header="" style="width:90px">
                  <template #body="{ data }">
                    <a v-if="data.url_drive" :href="data.url_drive" target="_blank" class="mr-1"><ExternalLinkIcon class="size-[1em]" style="color:var(--color-unergy-purple);" /></a>
                    <Button text rounded size="small" severity="danger" @click="borrarDoc(data)">
                      <template #icon><Trash2Icon class="size-[1em]" /></template>
                    </Button>
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </TabPanel>

        <!-- 4. ALERTAS -->
        <TabPanel header="Alertas">
          <div class="p-1">
            <div class="flex items-center justify-between mb-2">
              <div class="text-sm font-semibold" style="color:var(--color-unergy-deep);">Alertas</div>
              <Button label="Recomputar" size="small" :loading="recomputando" @click="recomputar">
                <template #icon><RefreshCwIcon class="size-[1em]" /></template>
              </Button>
            </div>
            <div v-if="alertas.length" class="space-y-2">
              <div v-for="(a, i) in alertas" :key="i" class="rounded-lg p-2 text-sm" style="border-left:3px solid #f6b73c;background:#fffbf0;">
                <div class="text-xs font-semibold" style="color:#b45309;">{{ a.tipo }}</div>
                <div style="color:var(--color-unergy-deep);">{{ a.mensaje }}</div>
              </div>
            </div>
            <p v-else class="text-xs" style="color:#9b89b5;">Sin alertas. Usa «Recomputar» para recalcular con las fechas actuales.</p>
          </div>
        </TabPanel>

        <!-- 5. CORREOS -->
        <TabPanel header="Correos">
          <div class="p-1 space-y-2">
            <div class="text-sm" style="color:var(--color-unergy-deep);">Genera un borrador de correo tipo (se rellena con los datos del proyecto):</div>
            <div class="flex gap-2 flex-wrap">
              <Button label="Firmas al OR (9.1/9.7)" size="small" outlined @click="generarCorreo('SOLICITUD_FIRMAS_OR')" />
              <Button label="Creación en MDC (XM)" size="small" outlined @click="generarCorreo('CREACION_MDC_XM')" />
              <Button label="Documentación (Solenium)" size="small" outlined @click="generarCorreo('DOC_FRONTERA_SOLENIUM')" />
            </div>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <!-- Dialogo equipo -->
    <Dialog v-model:visible="equipoDialog" modal header="Nuevo equipo de frontera" :style="{ width: '30rem' }">
      <div class="grid grid-cols-2 gap-3">
        <label class="text-xs col-span-2" style="color:var(--color-unergy-deep);">Tipo *
          <Select v-model="equipoForm.tipo" :options="cat.tipos_equipo" placeholder="Tipo…" class="w-full" />
        </label>
        <label class="text-xs" style="color:var(--color-unergy-deep);">Marca<InputText v-model="equipoForm.marca" class="w-full" /></label>
        <label class="text-xs" style="color:var(--color-unergy-deep);">Modelo<InputText v-model="equipoForm.modelo" class="w-full" /></label>
        <label class="text-xs" style="color:var(--color-unergy-deep);">Serial<InputText v-model="equipoForm.serial" class="w-full" /></label>
        <label class="text-xs" style="color:var(--color-unergy-deep);">Venc. calibración<input type="date" v-model="equipoForm.fecha_vencimiento_calibracion" class="w-full border rounded px-2 py-1" style="border-color:#e8e0f0;" /></label>
        <label class="text-xs" style="color:var(--color-unergy-deep);">Solicitud Solenium<input type="date" v-model="equipoForm.fecha_solicitud_solenium" class="w-full border rounded px-2 py-1" style="border-color:#e8e0f0;" /></label>
        <label class="text-xs" style="color:var(--color-unergy-deep);">Envío al OR<input type="date" v-model="equipoForm.fecha_envio_or" class="w-full border rounded px-2 py-1" style="border-color:#e8e0f0;" /></label>
      </div>
      <template #footer>
        <Button label="Cancelar" text @click="equipoDialog = false" />
        <Button label="Agregar" :disabled="!equipoForm.tipo" @click="crearEquipo" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);" />
      </template>
    </Dialog>

    <!-- Dialogo documento -->
    <Dialog v-model:visible="docDialog" modal header="Nuevo documento" :style="{ width: '30rem' }">
      <div class="grid grid-cols-2 gap-3">
        <label class="text-xs col-span-2" style="color:var(--color-unergy-deep);">Tipo *
          <Select v-model="docForm.tipo" :options="cat.tipos_documento" filter placeholder="Tipo…" class="w-full" />
        </label>
        <label class="text-xs" style="color:var(--color-unergy-deep);">Radicado<InputText v-model="docForm.radicado" class="w-full" /></label>
        <label class="text-xs" style="color:var(--color-unergy-deep);">Firmado por<InputText v-model="docForm.firmado_por" class="w-full" /></label>
        <label class="text-xs" style="color:var(--color-unergy-deep);">Emisión<input type="date" v-model="docForm.fecha_emision" class="w-full border rounded px-2 py-1" style="border-color:#e8e0f0;" /></label>
        <label class="text-xs" style="color:var(--color-unergy-deep);">Vencimiento<input type="date" v-model="docForm.fecha_vencimiento" class="w-full border rounded px-2 py-1" style="border-color:#e8e0f0;" /></label>
        <label class="text-xs col-span-2" style="color:var(--color-unergy-deep);">Enlace Drive<InputText v-model="docForm.url_drive" class="w-full" /></label>
      </div>
      <template #footer>
        <Button label="Cancelar" text @click="docDialog = false" />
        <Button label="Agregar" :disabled="!docForm.tipo" @click="crearDoc" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);" />
      </template>
    </Dialog>

    <!-- Dialogo correo -->
    <Dialog v-model:visible="correoDialog" modal header="Borrador de correo" :style="{ width: '42rem' }">
      <div v-if="correo" class="space-y-2 text-sm">
        <div><span class="text-xs font-semibold" style="color:#9b89b5;">Para:</span> {{ (correo.para || []).join(', ') || '—' }}</div>
        <div><span class="text-xs font-semibold" style="color:#9b89b5;">CC:</span> {{ (correo.cc || []).join(', ') }}</div>
        <div><span class="text-xs font-semibold" style="color:#9b89b5;">Asunto:</span> {{ correo.asunto }}</div>
        <div v-if="correo.adjuntos?.length"><span class="text-xs font-semibold" style="color:#9b89b5;">Adjuntos:</span> {{ correo.adjuntos.join('; ') }}</div>
        <Textarea :modelValue="correo.cuerpo" rows="12" class="w-full text-sm" readonly />
      </div>
      <template #footer>
        <Button label="Copiar cuerpo" text @click="copiarCorreo">
          <template #icon><CopyIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Cerrar" @click="correoDialog = false" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);" />
      </template>
    </Dialog>
  </div>

  <div v-else class="flex items-center justify-center py-20">
    <LoaderCircleIcon class="text-2xl size-[1em] animate-spin" style="color:var(--color-unergy-purple);" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { RegistrosCndService } from '~/features/registros-cnd/services/registros-cnd'
import { ArrowLeftIcon, BoxIcon, CopyIcon, ExternalLinkIcon, LoaderCircleIcon, PlusIcon, RefreshCwIcon, SaveIcon, SlidersHorizontalIcon, Trash2Icon } from '@lucide/vue'

const registrosCndService = new RegistrosCndService()

const route = useRoute()
const proyectoId = route.params.proyectoId

const reg = ref(null)
const regId = ref(null)
const cat = ref({ transiciones: {}, tipos_equipo: [], tipos_documento: [], tipos_visita: [] })
const general = ref({})
const params = ref({})
const validacion = ref(null)
const equipos = ref([])
const documentos = ref([])
const alertas = ref([])
const transicionando = ref(false)
const guardandoParams = ref(false)
const guardandoGeneral = ref(false)
const recomputando = ref(false)
const activeTab = ref(0)
const seleccionada = ref('ETAPA_1_CREG174_AMBITO')

// ---- Mapa del proceso: posiciones fijas (estilo selector de mundos) ----
const NODE_LAYOUT = {
  ETAPA_1_CREG174_AMBITO: { x: 96,  y: 96,  num: '1', label: 'CREG 174 / Ámbito' },
  ETAPA_2_CARTAS_9_1_9_7: { x: 250, y: 96,  num: '2', label: 'Cartas 9.1 / 9.7' },
  ETAPA_3_MDC:            { x: 410, y: 96,  num: '3', label: 'Aplicativo MDC' },
  ETAPA_4_MONTAJE_9_2:    { x: 560, y: 96,  num: '4', label: 'Carta 9.2' },
  ETAPA_5_REQ_9_3:        { x: 700, y: 96,  num: '5', label: 'Requisito 9.3' },
  ETAPA_8_REQ_9_4:        { x: 860, y: 96,  num: '8', label: 'Requisito 9.4' },
  ETAPA_6_FRONTERA:       { x: 410, y: 250, num: '6', label: 'Equipos frontera' },
  ETAPA_7_REGISTRO_ASIC:  { x: 620, y: 250, num: '7', label: 'Registro ASIC · FRT' },
}
const GOAL = { x: 980, y: 172 }

const CAMPOS_GENERAL = [
  'numero_expediente', 'id_requerimiento_or', 'numero_solicitud_appweb',
  'fecha_conexion_estimada', 'vigencia_aprobacion_conexion', 'fecha_visita_protecciones',
  'tipo_visita_protecciones', 'exporta', 'comercializador_es_or', 'punto_conexion_texto', 'notas',
]

const campos93 = [
  { k: 'voltaje_max_kv', label: 'V máx (kV)' },
  { k: 'voltaje_nominal_kv', label: 'V nom (kV)' },
  { k: 'voltaje_min_kv', label: 'V mín (kV)' },
  { k: 'in_eq_ka', label: 'In eq (kA)' },
  { k: 'icc_subtrans_pico_kap', label: 'Icc pico (kAp)' },
  { k: 'icc_subtrans_3f_ka', label: 'Icc 3F (kA)' },
  { k: 'icc_subtrans_2f_ka', label: 'Icc 2F (kA)' },
  { k: 'icc_subtrans_1f_ka', label: 'Icc 1F (kA)' },
  { k: 'icc_estado_estable_ka', label: 'Icc EE (kA)' },
  { k: 'impedancia_equivalente_ohm', label: 'Z eq (Ω)' },
  { k: 'frecuencia_max_hz', label: 'Frec máx (Hz)' },
  { k: 'frecuencia_min_hz', label: 'Frec mín (Hz)' },
]

const porEtapaMap = computed(() => {
  const m = {}
  for (const e of (reg.value?.por_etapa || [])) m[e.etapa] = e
  return m
})
const etapaActual = computed(() => reg.value?.siguiente_paso?.etapa || null)
const etapaSel = computed(() => porEtapaMap.value[seleccionada.value] || null)

const mapaNodos = computed(() =>
  Object.entries(NODE_LAYOUT).map(([etapa, pos]) => ({
    etapa, ...pos, status: statusEtapa(porEtapaMap.value[etapa]),
  }))
)

function statusEtapa(row) {
  if (!row) return 'pendiente'
  if (row.bloqueada || row.estado_actual === 'VENCIDO') return 'bloqueada'
  if (row.total_pct > 0 && row.ganado_pct >= row.total_pct) return 'completa'
  if (row.estado_actual && row.estado_actual !== 'NO_INICIADO') return 'progreso'
  return 'pendiente'
}
function fillNodo(s) { return { completa: '#915BD8', progreso: '#ffffff', pendiente: '#f3eefb', bloqueada: '#fde8e8' }[s] }
function strokeNodo(s) { return { completa: '#6E3FB8', progreso: '#915BD8', pendiente: '#d9c9f0', bloqueada: '#e05252' }[s] }
function textNodo(s) { return { completa: '#ffffff', progreso: '#6E3FB8', pendiente: '#9b89b5', bloqueada: '#b91c1c' }[s] }

function estadoLabel(s) {
  if (!s) return '—'
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}
function sevColor(s) {
  return { OK: 'success', ERROR: 'destructive', ADVERTENCIA: 'warning', PENDIENTE: 'default' }[s] || 'default'
}
function siguientesEstados(e) {
  return (cat.value.transiciones?.[e.etapa]?.[e.estado_actual]) || []
}
function hitosDeEtapa(etapa) {
  return (reg.value?.hitos || []).filter(h => h.etapa === etapa)
}
function seleccionar(etapa) { seleccionada.value = etapa }

function setReg(data) {
  reg.value = data
  regId.value = data.id
  alertas.value = data.alertas_pendientes || []
  general.value = Object.fromEntries(CAMPOS_GENERAL.map(k => [k, data[k] ?? '']))
  general.value.exporta = !!data.exporta
  general.value.comercializador_es_or = !!data.comercializador_es_or
  // seleccionar por defecto la etapa actual (o dejar la ya elegida)
  if (etapaActual.value && porEtapaMap.value[etapaActual.value]) seleccionada.value = etapaActual.value
}

async function materializar() {
  setReg(await registrosCndService.materializarPorProyecto(proyectoId))
}
async function recargarReg() {
  setReg(await registrosCndService.obtener(regId.value))
}
async function cargarCatalogos() {
  cat.value = await registrosCndService.obtenerCatalogos()
}
async function cargarParams() {
  params.value = (await registrosCndService.obtenerParametros93(regId.value)) || {}
  await cargarValidacion()
}
async function cargarValidacion() {
  validacion.value = await registrosCndService.obtenerValidacion93(regId.value)
}
async function cargarEquipos() {
  equipos.value = await registrosCndService.listarEquipos(regId.value)
}
async function cargarDocumentos() {
  documentos.value = await registrosCndService.listarDocumentos(regId.value)
}

async function guardarGeneral() {
  guardandoGeneral.value = true
  try {
    const payload = { ...general.value }
    for (const k of CAMPOS_GENERAL) if (payload[k] === '') payload[k] = null
    await registrosCndService.actualizar(regId.value, payload)
    await recargarReg()
    toast.success('Datos guardados', { duration: 2500 })
  } catch (e) {
    toast.error('No se pudo guardar', { description: e.data?.detail ?? '', duration: 6000 })
  } finally {
    guardandoGeneral.value = false
  }
}

async function hacerTransicion(etapa, aEstado) {
  transicionando.value = true
  try {
    const data = await registrosCndService.transicionar(regId.value, etapa, aEstado)
    const prevSel = seleccionada.value
    setReg(data)
    seleccionada.value = prevSel  // mantener el foco en la etapa que se estaba tocando
    toast.success('Estado actualizado', { duration: 2500 })
  } catch (e) {
    toast.error('Transición no válida', { description: e.data?.detail ?? '', duration: 6000 })
  } finally {
    transicionando.value = false
  }
}

async function guardarParams() {
  guardandoParams.value = true
  try {
    const payload = {}
    for (const f of campos93) if (params.value[f.k] !== undefined && params.value[f.k] !== '') payload[f.k] = params.value[f.k]
    await registrosCndService.guardarParametros93(regId.value, payload)
    await cargarValidacion()
    toast.success('Parámetros guardados', { duration: 2500 })
  } catch (e) {
    toast.error('No se pudo guardar', { description: e.data?.detail ?? '', duration: 6000 })
  } finally {
    guardandoParams.value = false
  }
}

async function recomputar() {
  recomputando.value = true
  try {
    const data = await registrosCndService.recomputarAlertas(regId.value)
    alertas.value = data.alertas || []
    toast.success(`Alertas: ${data.alertas.length} (${data.creadas} nuevas)`, { duration: 3000 })
  } catch (e) {
    toast.error('Error al recomputar', { description: e.data?.detail ?? '', duration: 5000 })
  } finally {
    recomputando.value = false
  }
}

// Equipos
const equipoDialog = ref(false)
const equipoForm = ref({})
function abrirEquipo() { equipoForm.value = {}; equipoDialog.value = true }
async function crearEquipo() {
  try {
    const payload = Object.fromEntries(Object.entries(equipoForm.value).filter(([, v]) => v !== '' && v != null))
    await registrosCndService.crearEquipo(regId.value, payload)
    equipoDialog.value = false
    await cargarEquipos()
    toast.success('Equipo agregado', { duration: 2500 })
  } catch (e) {
    toast.error('No se pudo agregar', { description: e.data?.detail ?? '', duration: 5000 })
  }
}
async function borrarEquipo(row) {
  if (!confirm(`¿Eliminar el equipo ${row.tipo}?`)) return
  await registrosCndService.eliminarEquipo(regId.value, row.id)
  await cargarEquipos()
}

// Documentos
const docDialog = ref(false)
const docForm = ref({ estado: 'BORRADOR' })
function abrirDoc() { docForm.value = { estado: 'BORRADOR' }; docDialog.value = true }
async function crearDoc() {
  try {
    const payload = Object.fromEntries(Object.entries(docForm.value).filter(([, v]) => v !== '' && v != null))
    await registrosCndService.crearDocumento(regId.value, payload)
    docDialog.value = false
    await cargarDocumentos()
    toast.success('Documento agregado', { duration: 2500 })
  } catch (e) {
    toast.error('No se pudo agregar', { description: e.data?.detail ?? '', duration: 5000 })
  }
}
async function borrarDoc(row) {
  if (!confirm(`¿Eliminar el documento ${row.tipo}?`)) return
  await registrosCndService.eliminarDocumento(regId.value, row.id)
  await cargarDocumentos()
}

// Correos
const correoDialog = ref(false)
const correo = ref(null)
async function generarCorreo(tipo) {
  try {
    correo.value = await registrosCndService.generarCorreo(regId.value, tipo)
    correoDialog.value = true
  } catch (e) {
    toast.error('No se pudo generar', { description: e.data?.detail ?? '', duration: 5000 })
  }
}
function copiarCorreo() {
  if (correo.value?.cuerpo) navigator.clipboard?.writeText(correo.value.cuerpo)
  toast.success('Cuerpo copiado', { duration: 2000 })
}

onMounted(async () => {
  try {
    await materializar()
    await Promise.all([cargarCatalogos(), cargarParams(), cargarEquipos(), cargarDocumentos()])
  } catch (e) {
    toast.error('No se pudo abrir el proyecto', {
      description: e.data?.detail ?? '',
      duration: 6000,
    })
  }
})
</script>

<style scoped>
.mapa-card {
  background: radial-gradient(1200px 200px at 20% -40%, #efe7fb 0%, var(--color-unergy-avena) 60%);
  border: 1px solid #e8e0f0;
  border-radius: 16px;
  padding: 14px 16px 18px;
  box-shadow: 0 1px 3px rgba(44,32,57,.06);
}
.mapa-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
.mapa-titulo { font-weight: 700; color: var(--color-unergy-deep); font-size: .95rem; }
.mapa-leyenda { display: flex; gap: 12px; flex-wrap: wrap; font-size: .68rem; color: #6b5a8a; }
.mapa-leyenda span { display: inline-flex; align-items: center; gap: 4px; }
.mapa-leyenda .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
.mapa-leyenda .dot.ring { background: #fff; border: 2px solid var(--color-unergy-purple); }
.mapa-wrap { overflow-x: auto; }
.mapa-svg { width: 100%; min-width: 880px; height: auto; display: block; }
.lane-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; fill: #b9a9d6; }
.lane-label.frontera { fill: #86c2a4; }
.hint { font-size: 10px; fill: #86c2a4; font-style: italic; }
.nodo { cursor: pointer; }
.nodo-num { font-size: 18px; font-weight: 800; }
.nodo-label { font-size: 11px; fill: #6b5a8a; font-weight: 600; }
.check { font-size: 11px; fill: #fff; font-weight: 800; }
.sol { font-size: 20px; }
.anillo-actual { animation: pulso 1.6s ease-in-out infinite; }
@keyframes pulso { 0%,100% { opacity: .25 } 50% { opacity: .85 } }

.etapa-panel { margin-top: 14px; background: #fff; border: 1px solid #ECE7F2; border-radius: 12px; padding: 12px 14px; }
.pill {
  padding: 5px 12px; border-radius: 999px; font-size: .75rem; border: 1px solid #d9c9f0;
  background: #fff; color: var(--color-unergy-purple-dark); transition: all .15s; font-weight: 600;
}
.pill:hover:not(:disabled) { background: var(--color-unergy-purple); color: #fff; border-color: var(--color-unergy-purple); }
.pill:disabled { opacity: .5; cursor: default; }
.hito-linea { display: flex; align-items: center; gap: 8px; font-size: .78rem; padding: 2px 0; }
.bloqueos { margin-top: 12px; font-size: .78rem; background: #fff5f5; border: 1px solid #f0c0c0; border-radius: 10px; padding: 8px 12px; }
</style>
