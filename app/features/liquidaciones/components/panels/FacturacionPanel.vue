<template>
  <div class="fac p-4 sm:p-5 space-y-4">
    <!-- Sub-pestañas -->
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="fac-subtabs">
        <button v-for="s in SUBS" :key="s.key" class="fac-subtab"
          :class="{ on: sub === s.key }" @click="sub = s.key">
          <component :is="s.icon" class="size-[1em]" /><span>{{ s.label }}</span>
        </button>
      </div>
      <span class="text-[11px]" style="color:#9b8fb0">
        Energía del despacho × tarifa PPA indexada por IPP · {{ formatPeriodo(periodo) }}
      </span>
    </div>

    <ProgressSpinner v-if="loading" class="block mx-auto my-10" />

    <template v-else>
      <!-- Aviso IPP faltante -->
      <div v-if="!ippActual && sub !== 'ipp'" class="rounded-lg px-3 py-2.5 text-xs flex items-center gap-2"
        style="background:#fff7e6; border:1px solid #f5d99a; color:#8a5a12">
        <TriangleAlertIcon class="size-[1em]" />
        Falta el <b>IPP</b> de {{ formatPeriodo(periodo) }}. La facturación no se puede calcular sin él.
        <button class="fac-link ml-1" @click="sub = 'ipp'">Cargarlo →</button>
      </div>

      <!-- ═══ 1. FACTURACIÓN ═══ -->
      <template v-if="sub === 'facturacion'">
        <!-- Los totales ya salen en el pie de la tabla; solo se deja el aviso de los
             contratos sin PPA, que es lo que hay que accionar. -->
        <div v-if="res.sin_ppa" class="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
             style="background:#fdecea; border:1px solid #f5c2bd; color:#a13527">
          <TriangleAlertIcon class="size-[1em]" />
          <b>{{ res.sin_ppa }}</b> contrato{{ res.sin_ppa === 1 ? '' : 's' }} sin PPA marco: no se factura
          por esta vía hasta asociarle su PPA. Ver el detalle abajo.
        </div>

        <div class="fac-card">
          <div class="tblwrap">
            <table class="dt">
              <thead><tr>
                <th class="l">Proyecto / Contrato</th><th class="l">Comerc.</th>
                <th>Energía (kWh)</th><th>Tarifa</th><th>Facturación</th>
              </tr></thead>
              <tbody>
                <tr v-for="l in facturables" :key="l.contrato">
                  <td class="l"><span class="proj">{{ l.proyecto || l.contrato }}</span>
                    <span class="sub2">{{ l.contrato }}</span></td>
                  <td class="l"><span class="tag">{{ l.comprador || '—' }}</span></td>
                  <td>{{ fmtNum(l.kwh) }}</td>
                  <td>{{ fmtNum(l.tarifa_indexada) }}</td>
                  <td class="fw">{{ fmtCOP(l.facturacion) }}</td>
                </tr>
              </tbody>
              <tfoot><tr>
                <td class="l" colspan="2">Total ({{ facturables.length }} contratos)</td>
                <td>{{ fmtNum(res.kwh_total) }}</td><td></td>
                <td class="fw">{{ fmtCOP(res.facturacion_total || 0) }}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>

        <!-- No facturables: sin PPA marco, o con PPA pero sin tarifa/IPP. Antes solo
             se listaban los "sin PPA" y los otros casos no aparecían en ninguna parte. -->
        <div v-if="noFacturables.length" class="fac-card">
          <p class="fac-note"><InfoIcon class="size-[1em]" /> No facturables por esta vía ({{ noFacturables.length }}):</p>
          <div class="tblwrap">
            <table class="dt">
              <thead><tr><th class="l">Planta / Contrato</th><th class="l">Comerc.</th><th class="l">Motivo</th><th>Energía (kWh)</th></tr></thead>
              <tbody>
                <tr v-for="l in noFacturables" :key="l.contrato">
                  <!-- Mismo formato que la tabla de arriba: la planta manda y el código
                       queda debajo. Antes solo se veía el código y no se sabía qué planta era. -->
                  <td class="l"><span class="proj">{{ l.proyecto || 'Planta sin identificar' }}</span>
                    <span class="sub2">{{ l.contrato }}</span></td>
                  <td class="l"><span class="tag warn">{{ l.comprador || '—' }}</span></td>
                  <td class="l muted">{{ MOTIVOS[l.estado] || l.estado }}</td>
                  <td>{{ fmtNum(l.kwh) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <!-- ═══ 1b. FACTURAS (por comercializador, divisibles) ═══ -->
      <template v-else-if="sub === 'facturas'">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <p class="text-[11px] flex-1" style="color:#9b8fb0; min-width:260px">
            Una fila por factura (contrato marco / PPA). Puedes <b>dividir</b> una en sub-facturas:
            despliega, marca proyectos y ponles un nombre (con un <b>%</b> si solo va una parte del
            contrato). La tarifa no cambia (sale del PPA). Se guarda y aplica cada mes.
          </p>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[11px]" style="color:#6b5a8a">
              {{ res.emitidas || 0 }}/{{ res.facturas || porFactura.length }} facturadas
            </span>
            <button v-if="ordenTocado" class="fac-btn" :disabled="guardandoOrden" @click="guardarOrden">
              <LoaderCircleIcon v-if="guardandoOrden" class="text-xs size-[1em] animate-spin" />
              <SaveIcon v-else class="text-xs size-[1em]" /> Guardar orden
            </button>
            <button class="fac-link" @click="restablecerOrden">Orden por valor</button>
          </div>
        </div>

        <!-- Buscador: por planta / PPA o por número de factura (para ubicar una rápido) -->
        <div class="fac-buscar">
          <span style="position:relative; flex:1; min-width:240px">
            <SearchIcon class="size-[1em]" style="position:absolute; left:11px; top:50%; transform:translateY(-50%); color:#9b8fb0; font-size:12px" />
            <input v-model="facFiltro" class="fac-in" style="width:100%; padding-left:32px"
                   placeholder="Buscar por planta, PPA, contrato o N° de factura…" />
          </span>
          <button v-if="facFiltro" class="fac-link" @click="facFiltro = ''">Limpiar</button>
          <span v-if="filtroActivo" class="text-[11px]" style="color:#9b8fb0">
            {{ porFacturaMostradas.length }} de {{ porFactura.length }}
          </span>
        </div>

        <!-- Tarjetas informativas del mes -->
        <div class="fac-kpis">
          <div class="fac-kpi hero">
            <p class="k">Ingresos venta de energía</p>
            <p class="v">{{ fmtCOP(res.ingreso_total || res.facturacion_total || 0) }}</p>
            <p class="sub2">{{ fmtCOP(res.facturacion_total || 0) }} PPA + {{ fmtCOP(res.ingreso_bolsa || 0) }} bolsa</p>
          </div>
          <div class="fac-kpi">
            <p class="k">Energía despachada</p>
            <p class="v">{{ fmtMWh(despacho.kwh_total) }}</p>
            <p class="sub2">{{ fmtMWh(res.kwh_total) }} facturables</p>
          </div>
          <div class="fac-kpi">
            <p class="k">Tarifa promedio</p>
            <p class="v">{{ tarifaPromedio != null ? fmtNum(tarifaPromedio) + ' $/kWh' : '—' }}</p>
          </div>
          <div class="fac-kpi">
            <p class="k">Facturas</p>
            <p class="v">{{ res.facturas || porFactura.length }}</p>
            <p class="sub2">{{ res.emitidas || 0 }} facturadas</p>
          </div>
        </div>

        <div v-for="(f, i) in porFacturaMostradas" :key="f.factura" class="fac-card"
             :class="{ 'fac-emitida': f.emitida, 'fac-drag': dragIdx === i,
                       'fac-drop-antes': dropIdx === i && dragIdx > i,
                       'fac-drop-despues': dropIdx === i && dragIdx < i }"
             @dragover.prevent="!filtroActivo && arrastrarSobre(i)" @drop.prevent="!filtroActivo && soltar(i)">
          <div class="fac-fac-head" @click="toggleFac(f.factura)">
            <!-- Reordenar: arrastrar por el asa para saltos largos, flechas para
                 mover de a uno. DnD nativo, sin dependencias nuevas. Se oculta con el
                 filtro activo (reordenar un subconjunto no tiene sentido). -->
            <span v-if="!filtroActivo" class="fac-ord" @click.stop>
              <span class="fac-grip" draggable="true" v-tooltip.top="'Arrastra para reordenar'"
                    @dragstart="iniciarArrastre(i, $event)" @dragend="finArrastre">
                <MenuIcon class="size-[1em]" />
              </span>
              <span class="fac-ord-arrows">
                <button class="fac-ord-b" :disabled="i === 0" v-tooltip.top="'Subir'"
                        @click="moverFactura(i, -1)"><ChevronUpIcon class="size-[1em]" /></button>
                <button class="fac-ord-b" :disabled="i === porFactura.length - 1" v-tooltip.bottom="'Bajar'"
                        @click="moverFactura(i, 1)"><ChevronDownIcon class="size-[1em]" /></button>
              </span>
            </span>
            <input type="checkbox" :checked="f.emitida" @click.stop
                   v-tooltip.top="f.emitida ? tooltipEmitida(f) : 'Marcar como facturada'"
                   @change="onCheck(f, $event)" />
            <ChevronDownIcon v-if="abiertas.has(f.factura)" class="text-xs size-[1em]" style="color:#9b8fb0" />
            <ChevronRightIcon v-else class="text-xs size-[1em]" style="color:#9b8fb0" />
            <span class="proj">{{ f.factura }}</span>
            <span v-if="f.sin_ppa" class="tag" style="background:#fbeede;color:#c9701a">sin PPA · XM (bolsa)</span>
            <span v-else-if="f.personalizada" class="tag" style="background:#e6f6ef;color:#1f9d6b">dividida</span>
            <span v-else class="tag">{{ f.ppa || '—' }}</span>
            <!-- Número de factura: etiqueta no editable; el lápiz abre la ventana para cambiarlo. -->
            <span v-if="f.emitida && f.numero_factura" class="fac-numtag" @click.stop="abrirNumero(f)"
                  v-tooltip.top="'Editar el N° de factura'">
              <HashIcon class="text-[9px] size-[1em]" /> {{ f.numero_factura }}
            </span>
            <span v-else-if="f.emitida" class="tag" style="background:#e6f6ef;color:#1f9d6b; cursor:pointer" @click.stop="abrirNumero(f)"
                  v-tooltip.top="'Agregar el N° de factura'">facturada · N°?</span>
            <span class="fac-acts" @click.stop>
              <button class="fac-icobtn" @click="copiarMensaje(f)" v-tooltip.top="'Copiar el mensaje'">
                <CheckIcon v-if="copiada === f.factura" class="size-[1em]" />
                <CopyIcon v-else class="size-[1em]" />
              </button>
              <button class="fac-icobtn" @click="copiarImagen(f)" v-tooltip.top="'Copiar como imagen'">
                <CheckIcon v-if="imagenId === f.factura" class="size-[1em]" />
                <ImageIcon v-else class="size-[1em]" />
              </button>
            </span>
            <span class="ml-auto fac-fac-nums">
              <span class="muted">{{ f.contratos }} contr</span>
              <span class="muted">· {{ fmtNum(f.kwh) }} kWh</span>
              <span class="muted">· tarifa {{ tarifaFacturaTxt(f) }}</span>
              <b v-if="f.sin_ppa && !f.facturacion" class="muted" style="font-weight:600">sin precio bolsa</b>
              <b v-else>{{ fmtCOP(f.facturacion) }}</b>
            </span>
          </div>
          <div v-if="abiertas.has(f.factura)" class="fac-fac-body">
            <div class="tblwrap">
              <table class="dt">
                <thead><tr><th class="l" style="width:34px"></th><th class="l">Proyecto</th><th class="l">Contrato</th><th>Tarifa</th><th>Energía (kWh)</th><th>Facturación</th><th style="width:60px"></th></tr></thead>
                <tbody>
                  <tr v-for="p in f.proyectos" :key="p.contrato">
                    <td class="l"><input type="checkbox"
                      :checked="selDe(f.factura).has(p.contrato)" @change="toggleProy(f.factura, p.contrato)" /></td>
                    <td class="l">{{ p.proyecto || '—' }}
                      <span v-if="p.asignada" class="sub2">↳ movido aquí</span>
                      <span v-if="p.porcentaje != null" class="sub2">↳ {{ fmtPct(p.porcentaje) }} de este contrato</span>
                    </td>
                    <td class="l muted">{{ p.contrato }}</td>
                    <td>{{ fmtNum(p.tarifa_indexada) }}</td>
                    <td>{{ fmtNum(p.kwh) }}</td>
                    <td class="fw">{{ fmtCOP(p.facturacion) }}</td>
                    <td class="l"><button v-if="p.asignada" class="fac-link" @click="quitarAsignacion(p.contrato)">quitar</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="fac-div-row">
              <input v-model="nuevoNombre[f.factura]" class="fac-in" style="width:220px" placeholder="Nombre de la nueva factura (ej. Terpel 2 PA)" />
              <!-- % opcional: si va solo una parte del contrato, el resto queda en el
                   PPA original. Es el caso de Uruaco → 22.8066% a la nueva factura. -->
              <input v-model="nuevoPct[f.factura]" class="fac-in" style="width:110px"
                     placeholder="% (opcional)" inputmode="decimal" />
              <button class="fac-btn" :disabled="guardandoDiv" @click="moverSeleccionados(f.factura)">
                <LoaderCircleIcon v-if="guardandoDiv" class="text-xs size-[1em] animate-spin" />
                <ArrowRightIcon v-else class="text-xs size-[1em]" /> Mover seleccionados
              </button>
              <span class="text-[10px]" style="color:#9b8fb0">
                Sin % se mueve el contrato completo. Con % (ej. <b>22.8066</b>) se mueve esa
                parte y el resto queda en «{{ f.ppa || f.factura }}».
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- ═══ 2. POR CÓDIGO SIC ═══ -->
      <template v-else-if="sub === 'sic'">
        <div class="fac-card">
          <div class="tblwrap">
            <table class="dt">
              <thead><tr><th class="l">Código SIC (comercializador)</th><th>Contratos</th><th>Energía (kWh)</th><th>Facturación</th></tr></thead>
              <tbody>
                <tr v-for="g in porSic" :key="g.comprador">
                  <td class="l"><span class="tag">{{ g.comprador }}</span></td>
                  <td>{{ g.contratos }}</td><td>{{ fmtNum(g.kwh) }}</td><td class="fw">{{ fmtCOP(g.facturacion) }}</td>
                </tr>
              </tbody>
              <tfoot><tr>
                <td class="l">Total</td>
                <td>{{ porSic.reduce((s,g)=>s+g.contratos,0) }}</td>
                <td>{{ fmtNum(res.kwh_total) }}</td>
                <td class="fw">{{ fmtCOP(res.facturacion_total || 0) }}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      </template>

      <!-- ═══ CUMPLIMIENTO (compromiso vs despacho) ═══ -->
      <template v-else-if="sub === 'cumplimiento'">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <span class="text-[11px]" style="color:#9b8fb0">
            Compromiso (mínimo mensual del PPA) vs energía despachada · {{ formatPeriodo(periodo) }}
          </span>
          <button class="fac-upload" :disabled="!cumpl.filas.length" @click="exportarCumplimiento">
            <FileSpreadsheetIcon class="text-xs size-[1em]" /> Exportar Excel
          </button>
        </div>
        <div class="fac-kpis">
          <div class="fac-kpi">
            <p class="k">Cumplen el mínimo</p>
            <p class="v">{{ cumpl.resumen.cumplen || 0 }} / {{ cumpl.resumen.ppas || 0 }}</p>
          </div>
          <div class="fac-kpi">
            <p class="k">Por debajo del mínimo</p>
            <p class="v" :style="{ color: (cumpl.resumen.bajo_minimo || 0) ? '#c0392b' : undefined }">{{ cumpl.resumen.bajo_minimo || 0 }}</p>
          </div>
          <div class="fac-kpi">
            <p class="k">Energía incumplida</p>
            <p class="v" :style="{ color: (cumpl.resumen.faltante_kwh || 0) ? '#c0392b' : undefined }">{{ fmtNum(cumpl.resumen.faltante_kwh) }} kWh</p>
            <p class="sub2">{{ fmtNum(cumpl.resumen.faltante_mwh) }} MWh</p>
          </div>
        </div>
        <div class="fac-card">
          <div class="tblwrap">
            <table class="dt">
              <thead><tr>
                <th class="l">Contrato (PPA)</th><th class="l">Comerc.</th>
                <th>Mínimo (MWh)</th><th>Despachado (MWh)</th><th>Cumpl.</th><th>Incumplido (kWh)</th><th class="l">Estado</th>
              </tr></thead>
              <tbody>
                <tr v-for="f in cumpl.filas" :key="f.ppa || f.numero_contrato">
                  <td class="l"><span class="proj">{{ f.ppa || f.numero_contrato || '—' }}</span>
                    <span class="sub2">{{ f.proyecto || '' }}</span></td>
                  <td class="l"><span class="tag">{{ f.comprador || '—' }}</span></td>
                  <td>{{ f.minimo_mwh != null ? fmtNum(f.minimo_mwh) : '—' }}</td>
                  <td class="fw">{{ fmtNum(f.despachado_mwh) }}</td>
                  <td :style="{ color: f.estado === 'bajo_minimo' ? '#c0392b' : 'var(--color-unergy-deep)', fontWeight: 600 }">
                    {{ f.pct != null ? f.pct + '%' : '—' }}
                  </td>
                  <td :style="{ color: f.faltante_kwh > 0 ? '#c0392b' : '#9b8fb0', fontWeight: f.faltante_kwh > 0 ? 600 : 400 }">
                    {{ f.faltante_kwh > 0 ? fmtNum(f.faltante_kwh) : '—' }}
                  </td>
                  <td class="l">
                    <span class="tag" :style="cumplEstiloEstado(f.estado)">{{ MOTIVOS_CUMPL[f.estado] || f.estado }}</span>
                    <span v-if="f.unidad_sospechosa" class="tag" style="background:#fdecea;color:#a13527" title="La escala mínimo vs despacho se ve rara; revisa unidades (kWh vs MWh)">⚠ revisar unidad</span>
                  </td>
                </tr>
                <tr v-if="!cumpl.filas.length"><td class="l muted" colspan="7">Sin datos de cumplimiento para {{ formatPeriodo(periodo) }} (¿hay despacho cargado?).</td></tr>
              </tbody>
            </table>
          </div>
          <p class="fac-note"><InfoIcon class="size-[1em]" /> Compromiso por contrato marco (PPA), en MWh; despacho convertido de kWh. La energía sin PPA (bolsa/UNGC) no entra aquí.</p>
        </div>
      </template>

      <!-- ═══ 3. DESPACHOS ═══ -->
      <template v-else-if="sub === 'despachos'">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <span class="text-xs" style="color:#6b5a8a">
            <template v-if="despacho.contratos && despacho.contratos.length">
              {{ despacho.contratos.length }} contratos · {{ fmtMWh(despacho.kwh_total) }}
              <span v-if="despacho.archivo" class="sub2">· {{ despacho.archivo }}</span>
            </template>
            <template v-else>Sin despacho cargado para este mes.</template>
          </span>
          <button class="fac-upload" :disabled="subiendo" @click="pickDespacho">
            <LoaderCircleIcon v-if="subiendo" class="text-xs size-[1em] animate-spin" />
            <UploadIcon v-else class="text-xs size-[1em]" />
            {{ subiendo ? 'Subiendo…' : 'Subir despacho XM' }}
          </button>
        </div>
        <div v-if="despacho.contratos && despacho.contratos.length" class="fac-card">
          <!-- Filtro: por contrato, vendedor o comprador. Despliega un contrato para ver
               su energía día a día (GET /facturacion/despacho/dias). -->
          <div class="fac-desp-filtro">
            <span class="p-input-icon-left" style="position:relative">
              <SearchIcon class="size-[1em]" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#9b8fb0; font-size:12px" />
              <input v-model="despFiltro" class="fac-in" style="width:280px; padding-left:30px"
                     placeholder="Buscar contrato, vendedor o comprador…" />
            </span>
            <span class="text-[11px]" style="color:#9b8fb0">
              {{ despachoFiltrado.length }} de {{ despacho.contratos.length }} contratos
            </span>
          </div>
          <div class="tblwrap">
            <table class="dt">
              <thead><tr><th class="l" style="width:30px"></th><th class="l">Contrato</th><th class="l">Vendedor</th><th class="l">Comprador</th><th>Energía (kWh)</th></tr></thead>
              <tbody>
                <template v-for="d in despachoFiltrado" :key="d.contrato">
                  <tr class="fac-desp-row" @click="toggleDias(d.contrato)">
                    <td class="l"><ChevronDownIcon v-if="diasAbiertos.has(d.contrato)" class="text-[10px] size-[1em]" style="color:#9b8fb0" />
                    <ChevronRightIcon v-else class="text-[10px] size-[1em]" style="color:#9b8fb0" /></td>
                    <td class="l">{{ d.contrato }}</td><td class="l muted">{{ d.vendedor || '—' }}</td>
                    <td class="l"><span class="tag">{{ d.comprador || '—' }}</span></td>
                    <td>{{ fmtNum(d.kwh) }}</td>
                  </tr>
                  <tr v-if="diasAbiertos.has(d.contrato)" class="fac-desp-dias">
                    <td></td>
                    <td class="l" colspan="4">
                      <div v-if="dias[d.contrato] === 'loading'" class="text-[11px] muted py-1">
                        <LoaderCircleIcon class="text-[10px] size-[1em] animate-spin" /> Cargando días…
                      </div>
                      <div v-else-if="!dias[d.contrato] || !dias[d.contrato].length" class="text-[11px] muted py-1">
                        Sin detalle diario. Vuelve a subir el despacho de este mes para poblarlo.
                      </div>
                      <div v-else class="fac-dias-grid">
                        <div v-for="x in dias[d.contrato]" :key="x.fecha" class="fac-dia">
                          <span class="fac-dia-f">{{ fmtDia(x.fecha) }}</span>
                          <span class="fac-dia-k">{{ fmtNum(x.kwh) }}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
                <tr v-if="!despachoFiltrado.length"><td class="l muted" colspan="5">Ningún contrato coincide con «{{ despFiltro }}».</td></tr>
              </tbody>
              <tfoot><tr><td class="l" colspan="4">Total{{ despFiltro ? ' (filtrado)' : '' }}</td><td>{{ fmtNum(totalFiltrado) }}</td></tr></tfoot>
            </table>
          </div>
        </div>
      </template>

      <!-- ═══ 4. IPP ═══ -->
      <template v-else-if="sub === 'ipp'">
        <div class="fac-card p-4">
          <p class="text-sm font-bold mb-1" style="color:var(--color-unergy-deep)">IPP del mes — {{ formatPeriodo(periodo) }}</p>
          <p class="text-[11px] mb-3" style="color:#9b8fb0">Índice de Precios al Productor (DANE). Numerador de la indexación de las tarifas de energía.</p>
          <div class="flex items-end gap-2">
            <div>
              <label class="fac-lbl">Valor IPP</label>
              <input v-model.number="ippInput" type="number" step="0.01" class="fac-in" placeholder="187.43" />
            </div>
            <button class="fac-btn" :disabled="guardandoIpp || !ippInput" @click="guardarIpp">
              <LoaderCircleIcon v-if="guardandoIpp" class="text-xs size-[1em] animate-spin" />
              <SaveIcon v-else class="text-xs size-[1em]" /> Guardar
            </button>
            <span v-if="ippActual" class="text-[11px] ml-1" style="color:#2C7a3f">Actual: {{ ippActual }}</span>
          </div>
        </div>

        <!-- Precio de bolsa: valoriza la energía sin PPA (UNGC) -->
        <div class="fac-card p-4">
          <p class="text-sm font-bold mb-1" style="color:var(--color-unergy-deep)">Precio de bolsa — {{ formatPeriodo(periodo) }}</p>
          <p class="text-[11px] mb-3" style="color:#9b8fb0">
            Valoriza la energía de los contratos <b>sin PPA (UNGC / bolsa)</b>. <b>Lo calculas tú</b>
            (promedio horario→diario del mes) y lo cargas cada mes; la plataforma no lo calcula.
          </p>
          <div class="flex items-end gap-2 flex-wrap">
            <div>
              <label class="fac-lbl">Precio bolsa ($/kWh)</label>
              <input v-model.number="bolsaInput" type="number" step="0.01" class="fac-in" placeholder="$/kWh" />
            </div>
            <button class="fac-btn" :disabled="guardandoBolsa" @click="guardarBolsa">
              <LoaderCircleIcon v-if="guardandoBolsa" class="text-xs size-[1em] animate-spin" />
              <SaveIcon v-else class="text-xs size-[1em]" /> Guardar
            </button>
            <span class="text-[11px] ml-1" :style="{ color: bolsa.vigente != null ? '#2C7a3f' : '#c0392b' }">
              {{ bolsa.vigente != null ? 'Cargado: ' + fmtNum(bolsa.vigente) + ' $/kWh' : 'Sin precio — cárgalo para valorizar la bolsa' }}
            </span>
          </div>
        </div>
        <div class="fac-card">
          <p class="fac-note">Histórico</p>
          <div class="tblwrap">
            <table class="dt">
              <thead><tr><th class="l">Período</th><th>IPP</th></tr></thead>
              <tbody>
                <tr v-for="r in ippHist" :key="r.año + '-' + r.mes" :class="{ cur: r.año === añoMes.a && r.mes === añoMes.m }">
                  <td class="l">{{ r.año }}-{{ String(r.mes).padStart(2,'0') }}</td>
                  <td>{{ r.valor }}</td>
                </tr>
                <tr v-if="!ippHist.length"><td class="l muted" colspan="2">Sin IPP cargado aún.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </template>

    <!-- Ventana para el N° de factura al marcarla (o al editarlo) -->
    <Dialog v-model:visible="numModal.open" modal :closable="!numModal.saving" :draggable="false"
            :style="{ width: '380px' }" :header="numModal.modo === 'editar' ? 'N° de factura' : 'Marcar como facturada'">
      <div class="space-y-3">
        <p class="text-xs" style="color:#6b5a8a">
          <b>{{ numModal.factura }}</b><br>
          Escribe el número de la factura emitida (ej. <b>UESP2056</b>).
        </p>
        <input v-model="numModal.valor" class="fac-in" style="width:100%" placeholder="N° de factura"
               @keyup.enter="confirmarNumero" autofocus />
      </div>
      <template #footer>
        <button class="fac-link" :disabled="numModal.saving" @click="numModal.open = false">Cancelar</button>
        <button class="fac-btn ml-2" :disabled="numModal.saving" @click="confirmarNumero">
          <LoaderCircleIcon v-if="numModal.saving" class="text-xs size-[1em] animate-spin" />
          <CheckIcon v-else class="text-xs size-[1em]" />
          {{ numModal.modo === 'editar' ? 'Guardar' : 'Marcar facturada' }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import Dialog from 'primevue/dialog'
import { toast } from 'vue-sonner'
import { FacturacionService } from '~/features/liquidaciones/services/facturacion'
import { fmtCOP, formatPeriodo } from '~/features/liquidaciones/utils/liquidaciones'
import { exportarExcel } from '~/utils/exportarExcel'
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CircleCheckIcon, CopyIcon, DatabaseIcon, DollarSignIcon, FileIcon, FileSpreadsheetIcon, HashIcon, ImageIcon, InfoIcon, LoaderCircleIcon, MenuIcon, NetworkIcon, PercentIcon, SaveIcon, SearchIcon, TriangleAlertIcon, UploadIcon } from '@lucide/vue'

const facturacionService = new FacturacionService()

const props = defineProps({ periodo: { type: String, required: true } })

const SUBS = [
  { key: 'facturas', label: 'Facturas', icon: FileIcon },
  { key: 'facturacion', label: 'Detalle', icon: DollarSignIcon },
  { key: 'sic', label: 'Por código SIC', icon: NetworkIcon },
  { key: 'cumplimiento', label: 'Cumplimiento', icon: CircleCheckIcon },
  { key: 'despachos', label: 'Despachos', icon: DatabaseIcon },
  { key: 'ipp', label: 'IPP', icon: PercentIcon },
]
const sub = ref('facturas')
const loading = ref(false)
const res = ref({})
const lineas = ref([])
const porSic = ref([])
const cumpl = ref({ resumen: {}, filas: [] })   // compromiso vs cumplimiento
const porFactura = ref([])
const abiertas = reactive(new Set())      // facturas expandidas
const sel = reactive({})                   // factura key → Set(proyecto_id) seleccionados
const nuevoNombre = reactive({})           // factura key → nombre de la nueva sub-factura
const nuevoPct = reactive({})              // factura key → % del contrato que se mueve
const guardandoDiv = ref(false)
const guardandoOrden = ref(false)
const ordenTocado = ref(false)             // hay reordenamiento sin guardar
const copiada = ref(null)                  // factura cuyo mensaje se acaba de copiar
const imagenId = ref(null)                 // factura cuya imagen se acaba de copiar
const facFiltro = ref('')                  // buscador de facturas (planta / PPA / N° factura)
const numModal = reactive({ open: false, modo: 'marcar', factura: null, ref: null, valor: '', saving: false })
const despacho = ref({ contratos: [], kwh_total: 0 })
const despFiltro = ref('')                 // filtro de búsqueda en Despachos
const diasAbiertos = reactive(new Set())   // contratos con el día a día desplegado
const dias = reactive({})                  // contrato → [{fecha, kwh}] | 'loading'
const ippHist = ref([])
const ippInput = ref(null)
const subiendo = ref(false)
const guardandoIpp = ref(false)
const bolsa = ref({ manual: null, sugerido: null, vigente: null })
const bolsaInput = ref(null)
const guardandoBolsa = ref(false)

const per = computed(() => (props.periodo || '').slice(0, 7))
const añoMes = computed(() => { const [a, m] = per.value.split('-').map(Number); return { a, m } })
const ippActual = computed(() => {
  const r = ippHist.value.find(x => x.año === añoMes.value.a && x.mes === añoMes.value.m)
  return r ? r.valor : null
})
const facturables = computed(() => lineas.value.filter(l => l.estado === 'ok'))
// Todo lo que no se puede facturar, con el motivo: si solo se listaran los "sin PPA",
// un contrato sin tarifa o sin IPP base no aparecería en ninguna parte de la vista.
const MOTIVOS = {
  // No siempre es venta por UNGC: p. ej. el contrato 90060 (La Reserva) es de
  // SFEC y le falta asociarle su PPA de Santa Fe.
  sin_ppa: 'Sin PPA marco asociado',
  sin_tarifa: 'Sin tarifa del PPA para el mes',
  sin_ipp_base: 'El PPA no tiene IPP base',
  sin_ipp_mes: 'Falta el IPP del mes',
}
const noFacturables = computed(() => lineas.value.filter(l => l.estado !== 'ok'))
// Cumplimiento: etiqueta y color del estado.
const MOTIVOS_CUMPL = {
  cumple: 'Cumple', bajo_minimo: 'Por debajo', sobre_maximo: 'Sobre máximo', sin_compromiso: 'Sin compromiso',
}
const cumplEstiloEstado = (e) => ({
  cumple: 'background:#e6f6ef;color:#1f9d6b',
  bajo_minimo: 'background:#fdecea;color:#c0392b',
  sobre_maximo: 'background:#fbeede;color:#c9701a',
  sin_compromiso: 'background:#f0edf6;color:#6b5a8a',
}[e] || '')

const r2 = (v) => v == null ? null : Math.round(Number(v) * 100) / 100
async function exportarCumplimiento () {
  if (!cumpl.value.filas.length) return
  const cols = [
    { header: 'Contrato (PPA)', value: f => f.ppa || f.numero_contrato || '' },
    { header: 'Comercializador', value: f => f.comprador || '' },
    { header: 'Proyecto', value: f => f.proyecto || '' },
    { header: 'Mínimo (MWh)', value: f => r2(f.minimo_mwh) },
    { header: 'Máximo (MWh)', value: f => r2(f.maximo_mwh) },
    { header: 'Despachado (MWh)', value: f => r2(f.despachado_mwh) },
    { header: '% Cumplimiento', value: f => f.pct },
    { header: 'Incumplido (kWh)', value: f => f.faltante_kwh > 0 ? r2(f.faltante_kwh) : 0 },
    { header: 'Estado', value: f => MOTIVOS_CUMPL[f.estado] || f.estado },
  ]
  const mes = (formatPeriodo(props.periodo) || per.value).replace(/\s+/g, '_')
  await exportarExcel(cumpl.value.filas, cols, `Cumplimiento_${mes}.xlsx`, 'Cumplimiento')
}
// Facturas: buscador por planta / PPA / contrato / N° de factura. Para ubicar una
// rápido sin recorrer toda la lista.
const filtroActivo = computed(() => facFiltro.value.trim() !== '')
const porFacturaMostradas = computed(() => {
  const q = facFiltro.value.trim().toLowerCase()
  if (!q) return porFactura.value
  return porFactura.value.filter(f => {
    const campos = [f.factura, f.ppa, f.numero_factura,
      ...(f.proyectos || []).flatMap(p => [p.proyecto, p.contrato])]
    return campos.some(x => String(x || '').toLowerCase().includes(q))
  })
})
// Despachos: filtro por contrato / vendedor / comprador.
const despachoFiltrado = computed(() => {
  const q = despFiltro.value.trim().toLowerCase()
  const arr = despacho.value.contratos || []
  if (!q) return arr
  return arr.filter(d => [d.contrato, d.vendedor, d.comprador]
    .some(x => String(x || '').toLowerCase().includes(q)))
})
const totalFiltrado = computed(() => despachoFiltrado.value.reduce((s, d) => s + (Number(d.kwh) || 0), 0))
// Tarifa promedio ponderada ($/kWh) sobre lo facturable del mes.
const tarifaPromedio = computed(() => {
  const k = res.value.kwh_total || 0
  return k ? (res.value.facturacion_total || 0) / k : null
})

function tarifaFacturaTxt (f) {
  if (f.sin_ppa) return f.tarifa_indexada != null ? fmtNum(f.tarifa_indexada) + ' (bolsa)' : 'bolsa —'
  return f.tarifa_mixta ? 'varía' : fmtNum(f.tarifa_indexada)
}
const fmtNum = (v) => v == null ? '—' : Number(v).toLocaleString('es-CO', { maximumFractionDigits: 2 })
const fmtMWh = (kwh) => kwh == null ? '—' : (kwh / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' MWh'
// Los % de división llevan 4 decimales (22,8066); no se redondean a 2 o el reparto
// deja de cuadrar con el Excel.
const fmtPct = (v) => v == null ? '—' : Number(v).toLocaleString('es-CO', { maximumFractionDigits: 4 }) + '%'

async function load () {
  if (!per.value) return
  loading.value = true
  try {
    const [fac, desp, ipp, blz, cmp] = await Promise.all([
      facturacionService.obtener(per.value).catch(() => ({})),
      facturacionService.obtenerDespacho(per.value).catch(() => ({ contratos: [] })),
      facturacionService.listarIppMensual().catch(() => []),
      facturacionService.obtenerBolsa(per.value).catch(() => ({})),
      facturacionService.obtenerCumplimiento(per.value).catch(() => ({ resumen: {}, filas: [] })),
    ])
    res.value = fac.resumen || {}
    lineas.value = fac.lineas || []
    porSic.value = fac.por_codigo_sic || []
    porFactura.value = fac.por_factura || []
    despacho.value = desp || { contratos: [] }
    diasAbiertos.clear(); for (const k in dias) delete dias[k]   // el día a día es por mes
    ippHist.value = (ipp || []).slice().sort((a, b) => (b.año - a.año) || (b.mes - a.mes))
    ippInput.value = ippActual.value
    bolsa.value = blz || { manual: null, sugerido: null, vigente: null }
    bolsaInput.value = bolsa.value.manual
    cumpl.value = cmp || { resumen: {}, filas: [] }
  } finally {
    loading.value = false
  }
}

function pickDespacho () {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xlsx'
  input.onchange = () => { const f = input.files && input.files[0]; if (f) subirDespacho(f) }
  input.click()
}
async function subirDespacho (file) {
  subiendo.value = true
  try {
    const data = await facturacionService.subirDespacho(per.value, file)
    toast.success('Despacho cargado', {
      description: `${data.contratos} contratos · ${(data.kwh_total / 1000).toFixed(0)} MWh`,
      duration: 4000,
    })
    await load()
  } catch (e) {
    toast.error('No se pudo cargar', { description: e?.data?.detail || e.message, duration: 6000 })
  } finally { subiendo.value = false }
}

// ── División de facturas ────────────────────────────────────────────────────
function toggleFac (k) { abiertas.has(k) ? abiertas.delete(k) : abiertas.add(k) }
function selDe (k) { if (!sel[k]) sel[k] = reactive(new Set()); return sel[k] }
function toggleProy (k, contrato) { const s = selDe(k); s.has(contrato) ? s.delete(contrato) : s.add(contrato) }
async function moverSeleccionados (k) {
  const s = selDe(k); const nombre = (nuevoNombre[k] || '').trim()
  if (!s.size) { toast.warning('Selecciona contratos', { duration: 3000 }); return }
  if (!nombre) { toast.warning('Escribe el nombre de la factura', { duration: 3000 }); return }
  // El % admite coma o punto (se escribe "22,8066" en teclado es-CO).
  const crudo = (nuevoPct[k] || '').toString().trim().replace(',', '.')
  let pct = null
  if (crudo) {
    pct = Number(crudo)
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      toast.warning('Porcentaje inválido', {
        description: 'Debe ser un número entre 0 y 100.',
        duration: 4000,
      })
      return
    }
  }
  guardandoDiv.value = true
  try {
    const rows = [...s].filter(Boolean).map(c => ({ codigo_sic_contrato: c, nombre, porcentaje: pct }))
    await facturacionService.guardarAgrupaciones(rows)
    const comoPct = pct != null ? ` (${fmtPct(pct)})` : ''
    toast.success('Factura dividida', {
      description: `${rows.length} contratos → "${nombre}"${comoPct}`,
      duration: 3500,
    })
    s.clear(); nuevoNombre[k] = ''; nuevoPct[k] = ''
    await load()
  } catch (e) {
    toast.error('No se pudo dividir', { description: e?.data?.detail || e.message, duration: 6000 })
  } finally { guardandoDiv.value = false }
}

// ── Orden manual, marca de facturada y mensaje ───────────────────────────────
// Arrastrar y soltar para saltos largos (con 17 facturas, mover la última arriba
// eran 16 clics de flecha). Las flechas quedan para mover de a una posición.
const dragIdx = ref(null)
const dropIdx = ref(null)

function iniciarArrastre (i, ev) {
  dragIdx.value = i
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move'
    // Firefox no inicia el arrastre si no hay datos en el dataTransfer.
    ev.dataTransfer.setData('text/plain', String(i))
  }
}
function arrastrarSobre (i) { if (dragIdx.value !== null) dropIdx.value = i }
function finArrastre () { dragIdx.value = null; dropIdx.value = null }

function soltar (i) {
  const from = dragIdx.value
  if (from === null || from === i) { finArrastre(); return }
  const arr = porFactura.value.slice()
  const [item] = arr.splice(from, 1)
  arr.splice(i, 0, item)          // toma el lugar de la factura sobre la que se suelta
  porFactura.value = arr
  ordenTocado.value = true
  finArrastre()
}

function moverFactura (i, dir) {
  const j = i + dir
  if (j < 0 || j >= porFactura.value.length) return
  const arr = porFactura.value.slice()
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  porFactura.value = arr
  ordenTocado.value = true
}

async function guardarOrden () {
  guardandoOrden.value = true
  try {
    await facturacionService.guardarOrden(porFactura.value.map(f => f.factura))
    ordenTocado.value = false
    toast.success('Orden guardado', {
      description: 'Se aplica también a los próximos meses.',
      duration: 3500,
    })
  } catch (e) {
    toast.error('No se pudo guardar el orden', {
      description: e?.data?.detail || e.message,
      duration: 5000,
    })
  } finally { guardandoOrden.value = false }
}

async function restablecerOrden () {
  try {
    await facturacionService.restablecerOrden()
    ordenTocado.value = false
    await load()
    toast.success('Orden restablecido', { description: 'Vuelve a ordenarse por valor.', duration: 3000 })
  } catch (e) {
    toast.error('No se pudo restablecer', {
      description: e?.data?.detail || e.message,
      duration: 5000,
    })
  }
}

function tooltipEmitida (f) {
  const quien = f.emitida_por ? ` por ${f.emitida_por}` : ''
  const cuando = f.emitida_at ? ` el ${new Date(f.emitida_at).toLocaleDateString('es-CO')}` : ''
  return `Facturada${quien}${cuando} · clic para desmarcar`
}

// Clic en el chulito: si no está facturada, abre la ventana para el N° de factura;
// si ya lo está, la desmarca (con confirmación mínima).
function onCheck (f, ev) {
  if (ev && ev.target) ev.target.checked = f.emitida   // el estado real lo decide el flujo, no el DOM
  if (f.emitida) desmarcarEmitida(f)
  else abrirNumero(f, 'marcar')
}

function abrirNumero (f, modo = 'editar') {
  numModal.factura = f.factura
  numModal.ref = f
  numModal.valor = f.numero_factura || ''
  numModal.modo = f.emitida && modo !== 'marcar' ? 'editar' : 'marcar'
  numModal.saving = false
  numModal.open = true
}

async function confirmarNumero () {
  const f = numModal.ref
  if (!f) return
  const num = (numModal.valor || '').trim() || null
  const yaEmitida = f.emitida
  numModal.saving = true
  try {
    await facturacionService.marcarEmitida({ nombre: f.factura, periodo: per.value, emitida: true, numero_factura: num })
    f.emitida = true
    f.numero_factura = num
    if (!yaEmitida) res.value = { ...res.value, emitidas: (res.value.emitidas || 0) + 1 }
    numModal.open = false
    toast.success(yaEmitida ? 'N° actualizado' : 'Factura marcada', {
      description: num || 'Sin N°',
      duration: 2500,
    })
  } catch (e) {
    toast.error('No se pudo guardar', { description: e?.data?.detail || e.message, duration: 5000 })
  } finally { numModal.saving = false }
}

async function desmarcarEmitida (f) {
  f.emitida = false
  const num = f.numero_factura; f.numero_factura = null
  try {
    await facturacionService.marcarEmitida({ nombre: f.factura, periodo: per.value, emitida: false })
    res.value = { ...res.value, emitidas: Math.max(0, (res.value.emitidas || 0) - 1) }
  } catch (e) {
    f.emitida = true; f.numero_factura = num                 // revertir si el backend falló
    toast.error('No se pudo desmarcar', {
      description: e?.data?.detail || e.message,
      duration: 5000,
    })
  }
}

// ── Día a día del despacho de un contrato ─────────────────────────────────────
async function toggleDias (contrato) {
  if (diasAbiertos.has(contrato)) { diasAbiertos.delete(contrato); return }
  diasAbiertos.add(contrato)
  if (dias[contrato] && dias[contrato] !== 'loading') return   // ya cargado
  dias[contrato] = 'loading'
  try {
    const data = await facturacionService.obtenerDespachoDias({ periodo: per.value, contrato })
    dias[contrato] = data.dias || []
  } catch {
    dias[contrato] = []
  }
}
const fmtDia = (iso) => {
  const s = String(iso || '')
  return s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : s
}

async function copiarMensaje (f) {
  const texto = f.mensaje || ''
  if (!texto) { toast.warning('Sin datos para el mensaje', { duration: 3000 }); return }
  try {
    await navigator.clipboard.writeText(texto)
  } catch {
    // Fallback para navegadores/contextos sin permiso de clipboard.
    const ta = document.createElement('textarea')
    ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); document.body.removeChild(ta)
  }
  copiada.value = f.factura
  setTimeout(() => { if (copiada.value === f.factura) copiada.value = null }, 2500)
  if (f.tarifa_mixta) {
    toast.warning('Copiado — revisa la tarifa', {
      description: 'Esta factura mezcla contratos con tarifas distintas; el mensaje usa una sola.',
      duration: 5000,
    })
  }
}
// ── Copiar la factura como imagen ─────────────────────────────────────────────
// Mismo mecanismo que en Cumplimiento estrategia: se dibuja un canvas y se copia
// al portapapeles (o se descarga si el navegador no lo permite). Se dibuja a mano
// para no depender de html2canvas ni del DOM renderizado.
function _renderFacturaCanvas (f) {
  const DARK = '#2C2039', GREY = '#7a6e8a', PURPLE = '#915BD8'
  const scale = 2
  const W = 720, padX = 34
  const proys = f.proyectos || []
  const headerH = 92, tableHeadH = 28, rowH = 40, footerH = 46
  const bodyTop = headerH + tableHeadH
  const H = bodyTop + Math.max(proys.length, 1) * rowH + footerH

  const canvas = document.createElement('canvas')
  canvas.width = W * scale; canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = PURPLE; ctx.fillRect(0, 0, W, 6)

  const trunc = (txt, max) => {
    let s = String(txt || '')
    if (ctx.measureText(s).width <= max) return s
    while (s.length && ctx.measureText(s + '…').width > max) s = s.slice(0, -1)
    return s + '…'
  }

  // Header: nombre + PPA/tipo + período
  ctx.fillStyle = DARK; ctx.font = 'bold 20px Inter, Arial, sans-serif'
  ctx.fillText(trunc(f.factura || 'Factura', W - padX * 2), padX, 40)
  ctx.fillStyle = GREY; ctx.font = '13px Inter, Arial, sans-serif'
  const etiqueta = f.sin_ppa ? 'Sin PPA · XM (bolsa)' : (f.ppa || '—')
  ctx.fillText(trunc(etiqueta, W - padX * 2), padX, 60)
  ctx.fillStyle = PURPLE; ctx.font = 'bold 11px Inter, Arial, sans-serif'
  ctx.fillText(`Facturación de energía · ${formatPeriodo(props.periodo)}`, padX, 78)
  if (f.numero_factura) {
    ctx.font = 'bold 11px Inter, Arial, sans-serif'; ctx.fillStyle = '#1f9d6b'
    const t = `N° ${f.numero_factura}`, w = ctx.measureText(t).width
    ctx.fillText(t, W - padX - w, 40)
  }

  // Cabecera de tabla
  const colValR = W - padX            // Facturación
  const colKwhR = W - padX - 175      // Energía
  const colTarR = W - padX - 320      // Tarifa
  let y = headerH + 18
  ctx.fillStyle = '#faf7ff'; ctx.fillRect(0, headerH, W, tableHeadH)
  ctx.fillStyle = '#9b8fb0'; ctx.font = 'bold 10px Inter, Arial, sans-serif'
  ctx.fillText('PROYECTO / CONTRATO', padX, y)
  ctx.textAlign = 'right'
  ctx.fillText('TARIFA', colTarR, y); ctx.fillText('ENERGÍA (kWh)', colKwhR, y); ctx.fillText('FACTURACIÓN', colValR, y)
  ctx.textAlign = 'left'

  // Filas
  y = bodyTop + 20
  ctx.font = '12.5px Inter, Arial, sans-serif'
  for (const p of proys) {
    ctx.fillStyle = DARK
    ctx.fillText(trunc(p.proyecto || p.contrato || '—', colTarR - padX - 90), padX, y)
    ctx.fillStyle = GREY; ctx.font = '10.5px Inter, Arial, sans-serif'
    ctx.fillText(String(p.contrato || ''), padX, y + 13)
    ctx.font = '12.5px Inter, Arial, sans-serif'; ctx.fillStyle = DARK
    ctx.textAlign = 'right'
    ctx.fillText(p.tarifa_indexada != null ? fmtNum(p.tarifa_indexada) : '—', colTarR, y)
    ctx.fillText(fmtNum(p.kwh), colKwhR, y)
    ctx.fillText(fmtCOP(p.facturacion), colValR, y)
    ctx.textAlign = 'left'
    ctx.strokeStyle = '#f2edf8'; ctx.beginPath(); ctx.moveTo(padX, y + 22); ctx.lineTo(W - padX, y + 22); ctx.stroke()
    y += rowH
  }

  // Footer: total
  const fy = bodyTop + proys.length * rowH
  ctx.fillStyle = 'rgba(145,91,216,.07)'; ctx.fillRect(0, fy, W, footerH)
  ctx.strokeStyle = PURPLE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(W, fy); ctx.stroke()
  ctx.fillStyle = DARK; ctx.font = 'bold 13px Inter, Arial, sans-serif'
  ctx.fillText(`Total · ${fmtNum(f.kwh)} kWh`, padX, fy + 29)
  ctx.textAlign = 'right'; ctx.font = 'bold 15px Inter, Arial, sans-serif'
  ctx.fillText(f.sin_ppa && !f.facturacion ? 'sin precio bolsa' : fmtCOP(f.facturacion), colValR, fy + 30)
  ctx.textAlign = 'left'
  return canvas
}

async function copiarImagen (f) {
  let canvas
  try { canvas = _renderFacturaCanvas(f) }
  catch (e) { toast.error('No se pudo generar la imagen', { description: e.message, duration: 5000 }); return }
  canvas.toBlob(async (blob) => {
    if (!blob) return
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
      imagenId.value = f.factura
      setTimeout(() => { if (imagenId.value === f.factura) imagenId.value = null }, 2200)
    } catch {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `factura-${String(f.factura || 'factura').replace(/[^\w-]+/g, '_')}.png`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      toast.info('Imagen descargada', {
        description: 'El navegador no permite copiarla al portapapeles.',
        duration: 4000,
      })
    }
  }, 'image/png')
}

async function quitarAsignacion (contrato) {
  try {
    await facturacionService.guardarAgrupaciones([{ codigo_sic_contrato: contrato, nombre: '' }])
    await load()
  } catch (e) {
    toast.error('No se pudo quitar', { description: e?.data?.detail || e.message, duration: 5000 })
  }
}

async function guardarIpp () {
  guardandoIpp.value = true
  try {
    await facturacionService.guardarIppMensual([{ año: añoMes.value.a, mes: añoMes.value.m, valor: Number(ippInput.value) }])
    toast.success('IPP guardado', {
      description: `${formatPeriodo(props.periodo)} = ${ippInput.value}`,
      duration: 3500,
    })
    await load()
  } catch (e) {
    toast.error('No se pudo guardar', { description: e?.data?.detail || e.message, duration: 6000 })
  } finally { guardandoIpp.value = false }
}

async function guardarBolsa () {
  guardandoBolsa.value = true
  try {
    await facturacionService.guardarBolsa(per.value, bolsaInput.value ? Number(bolsaInput.value) : null)
    toast.success('Precio de bolsa guardado', { duration: 3000 })
    await load()
  } catch (e) {
    toast.error('No se pudo guardar', { description: e?.data?.detail || e.message, duration: 6000 })
  } finally { guardandoBolsa.value = false }
}

watch(() => props.periodo, load)
onMounted(load)
</script>

<style scoped>
.fac-subtabs { display:inline-flex; background:#F4F1FA; border:1px solid #E5E2EC; border-radius:10px; padding:3px; gap:2px; }
.fac-subtab { display:inline-flex; align-items:center; gap:6px; background:transparent; border:none; padding:6px 12px;
  font-size:12px; font-weight:700; color:#6B5A8A; border-radius:7px; cursor:pointer; white-space:nowrap; }
.fac-subtab.on { background:var(--color-unergy-purple); color:var(--color-unergy-avena); }
.fac-subtab:focus-visible { outline:2px solid var(--color-unergy-purple); outline-offset:2px; }


.fac-card { background:#fff; border:1px solid #e8e0f0; border-radius:14px; overflow:hidden; }
.fac-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin:4px 0 6px; }
.fac-kpi { background:#fff; border:1px solid #e8e0f0; border-radius:12px; padding:12px 14px; }
.fac-kpi.hero { background:#f3ecfb; border-color:transparent; }
.fac-kpi .k { font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:#6b5a8a; font-weight:600; }
.fac-kpi.hero .k { color:var(--color-unergy-purple-dark); }
.fac-kpi .v { font-size:18px; font-weight:800; color:var(--color-unergy-deep); margin-top:4px; font-variant-numeric:tabular-nums; }
.fac-kpi.hero .v { color:var(--color-unergy-purple-dark); }
.fac-kpi .sub2 { font-size:10.5px; color:#9b8fb0; margin-top:2px; }
.fac-note { font-size:11.5px; color:#6b5a8a; padding:10px 12px 2px; display:flex; align-items:center; gap:6px; }
.tblwrap { overflow-x:auto; }
.dt { width:100%; border-collapse:collapse; font-size:12.5px; }
.dt thead th { text-align:right; padding:9px 12px; font-size:10px; text-transform:uppercase; letter-spacing:.04em;
  color:#9b8fb0; font-weight:700; border-bottom:1px solid #f0ebf6; background:#faf7ff; white-space:nowrap; }
.dt th.l { text-align:left; }
.dt tbody td { padding:8px 12px; border-bottom:1px solid #f7f3fc; text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.dt td.l { text-align:left; white-space:normal; }
.dt tbody tr:hover { background:#faf7ff; }
.dt tbody tr.cur { background:#f3ecfb; }
.dt tfoot td { padding:9px 12px; border-top:2px solid var(--color-unergy-purple); background:rgba(145,91,216,.06);
  font-weight:800; color:var(--color-unergy-deep); text-align:right; font-variant-numeric:tabular-nums; }
.dt tfoot td.l { text-align:left; }
.proj { font-weight:600; color:var(--color-unergy-deep); }
.sub2 { display:block; font-size:10.5px; color:#9b8fb0; }
.muted { color:#9b8fb0; }
.fw { font-weight:700; color:var(--color-unergy-deep); }
.tag { display:inline-block; font-size:11px; padding:1px 7px; border-radius:6px; background:#f3ecfb; color:var(--color-unergy-purple-dark); font-weight:600; }
.tag.warn { background:#fbe9e7; color:#c0392b; }

.fac-upload, .fac-btn { display:inline-flex; align-items:center; gap:6px; background:var(--color-unergy-purple); color:#fff; border:none;
  padding:7px 14px; border-radius:9px; font-size:12px; font-weight:700; cursor:pointer; }
.fac-upload:disabled, .fac-btn:disabled { opacity:.6; cursor:default; }
.fac-lbl { display:block; font-size:11px; color:#6b5a8a; font-weight:600; margin-bottom:3px; }
.fac-in { width:140px; padding:6px 10px; border:1px solid #ddd6e8; border-radius:8px; font-size:13px;
  font-variant-numeric:tabular-nums; }
.fac-link { background:none; border:none; color:var(--color-unergy-purple); font-weight:700; font-size:11px; cursor:pointer; text-decoration:underline; }
.fac-fac-head { display:flex; align-items:center; gap:8px; padding:10px 14px; cursor:pointer; user-select:none; }
.fac-fac-head:hover { background:#faf7ff; }
.fac-fac-nums { display:inline-flex; align-items:center; gap:8px; font-size:12px; color:var(--color-unergy-deep); font-variant-numeric:tabular-nums; }
.fac-fac-body { border-top:1px solid #f0ebf6; padding:4px 0 0; }
.fac-div-row { display:flex; align-items:center; gap:8px; padding:10px 14px; border-top:1px solid #f7f3fc; background:#faf7ff; flex-wrap:wrap; }

/* Reordenar: asa de arrastre + flechas apiladas, compactas para no crecer la fila. */
.fac-ord { display:inline-flex; align-items:center; gap:2px; }
.fac-ord-arrows { display:inline-flex; flex-direction:column; gap:1px; }
.fac-grip { display:flex; align-items:center; color:#c9bede; cursor:grab; padding:2px 1px; border-radius:3px; }
.fac-grip:hover { color:var(--color-unergy-purple); background:#f1eaf9; }
.fac-grip:active { cursor:grabbing; }
.fac-grip svg { font-size:11px; }
.fac-ord-b { display:flex; align-items:center; justify-content:center; width:16px; height:11px;
  padding:0; border:none; background:none; color:#b9abcf; cursor:pointer; border-radius:3px; }
.fac-ord-b svg { font-size:9px; }
.fac-ord-b:hover:not(:disabled) { color:var(--color-unergy-purple); background:#f1eaf9; }
.fac-ord-b:disabled { opacity:.3; cursor:default; }

.fac-msg { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:6px;
  border:1px solid #e5e2ec; background:#fff; color:var(--color-unergy-purple-dark); font-size:11px; font-weight:700; cursor:pointer; }
.fac-msg:hover { background:#f4f1fa; }

/* Buscador de facturas */
.fac-buscar { display:flex; align-items:center; gap:10px; margin:2px 0 4px; flex-wrap:wrap; }

/* N° de factura como etiqueta no editable (clic = editar en ventana) */
.fac-numtag { display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:700;
  padding:1px 8px; border-radius:6px; background:#e6f6ef; color:#1f7a56; cursor:pointer; }
.fac-numtag:hover { background:#d6efe2; }

/* Acciones compactas (mensaje / imagen) como iconos, para descongestionar el header */
.fac-acts { display:inline-flex; align-items:center; gap:2px; }
.fac-icobtn { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px;
  border-radius:7px; border:1px solid #e5e2ec; background:#fff; color:var(--color-unergy-purple-dark); cursor:pointer; }
.fac-icobtn:hover { background:#f4f1fa; }
.fac-icobtn svg { font-size:12px; }

/* Despachos: filtro + día a día */
.fac-desp-filtro { display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:10px 12px; border-bottom:1px solid #f0ebf6; flex-wrap:wrap; }
.fac-desp-row { cursor:pointer; }
.fac-desp-dias td { background:#faf7ff; }
.fac-dias-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:6px; padding:8px 2px; }
.fac-dia { display:flex; flex-direction:column; background:#fff; border:1px solid #ece5f5; border-radius:7px; padding:5px 8px; }
.fac-dia-f { font-size:10px; color:#9b8fb0; font-weight:600; }
.fac-dia-k { font-size:12px; color:var(--color-unergy-deep); font-weight:600; font-variant-numeric:tabular-nums; }

/* Arrastre: la tarjeta que se mueve se atenúa y la de destino marca el borde por
   donde va a entrar, para no soltar a ciegas. */
.fac-drag { opacity:.45; }
.fac-drop-antes { box-shadow:inset 0 3px 0 0 var(--color-unergy-purple); }
.fac-drop-despues { box-shadow:inset 0 -3px 0 0 var(--color-unergy-purple); }

/* Facturada: se atenúa sin ocultarla, y una barra lateral la hace evidente al barrer la lista. */
.fac-emitida { border-left:3px solid #1f9d6b; }
.fac-emitida .proj { color:#6b5a8a; }
</style>
