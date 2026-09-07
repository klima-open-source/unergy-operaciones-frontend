<template>
  <div class="pc-wrap">
    <!-- Top -->
    <div class="pc-top">
      <div>
        <h1>Panel Contable</h1>
        <div class="sub">
          <span class="periodo-chip">{{ periodo ? periodoLabel : 'Sin período seleccionado' }}</span>
          · división por % del backend (inversionistas activos del período) · IVA automático sobre costos
        </div>
      </div>
      <div class="top-actions">
        <div class="fld">
          <label>Ver período</label>
          <div class="pc-period">
            <button class="pc-period-btn" @click="stepMes(-1)" v-tooltip.bottom="'Mes anterior'">
              <ChevronLeftIcon class="size-[1em]" />
            </button>
            <span class="pc-period-label">{{ periodoLabel || '—' }}</span>
            <button class="pc-period-btn" :disabled="esMesActual" @click="stepMes(1)" v-tooltip.bottom="'Mes siguiente'">
              <ChevronRightIcon class="size-[1em]" />
            </button>
          </div>
        </div>
        <button v-if="tab === 'preliquidacion' || tab === 'oficial'" class="btn-o" :disabled="loading || !paneles.length" @click="exportarExcel">
          <FileSpreadsheetIcon class="size-[1em]" /> Exportar Excel
        </button>
        <button v-if="tab !== 'diferencia' && tab !== 'clasificacion'" class="btn-o"
                :disabled="loading || contrastando" @click="verContraste"
                v-tooltip.bottom="'Compara lo que daría la API contra lo que hay hoy. No guarda nada.'">
          <LoaderCircleIcon v-if="contrastando" class="size-[1em] animate-spin" />
          <SearchIcon v-else class="size-[1em]" /> Contrastar
        </button>
        <button v-if="tab !== 'diferencia' && tab !== 'clasificacion'" class="btn"
                :disabled="loading || armando" @click="armarPeriodo"
                v-tooltip.bottom="'Arma los paneles del período desde la API. NEU y Nitro siguen con su Excel.'">
          <LoaderCircleIcon v-if="armando" class="size-[1em] animate-spin" />
          <ZapIcon v-else class="size-[1em]" /> Armar desde API
        </button>
        <!-- El Excel quedó SOLO para NEU y Nitro: su dato en la API está malo. -->
        <button v-if="tab !== 'diferencia' && tab !== 'clasificacion'" class="btn-o" :disabled="loading" @click="abrirDialogoPeriodo"
                v-tooltip.bottom="'Solo para NEU y Nitro. El resto se arma desde la API.'">
          <UploadIcon class="size-[1em]" /> Cargar ER <span class="solo-neu">NEU/Nitro</span>
        </button>
        <input ref="erInput" type="file" accept=".xlsx,.xls" multiple class="hidden" @change="onErSelected" />
      </div>
    </div>

    <!-- Resultado de armar el período. Los omitidos se muestran siempre: sin eso
         parecería que el período quedó completo. -->
    <div v-if="resultado" class="pc-aviso pc-aviso--ok">
      <div class="pc-aviso-cab">
        <CircleCheckIcon class="size-[1em]" />
        <b>{{ resultado.armados }}</b> paneles armados desde la API
        <button class="pc-aviso-x" @click="resultado = null"><XIcon class="size-[1em]" /></button>
      </div>
      <div v-if="resultado.omitidos.length" class="pc-aviso-linea">
        <b>{{ resultado.omitidos.length }} omitidos</b> — siguen cargando su Excel:
        <span v-for="(o, i) in resultado.omitidos" :key="i" class="pc-tag">
          {{ o.proyecto }} <em>{{ o.motivo }}</em>
        </span>
      </div>
      <div v-if="resultado.sin_cruce.length" class="pc-aviso-linea">
        <b>{{ resultado.sin_cruce.length }} sin cruce</b> — están en la API pero no en esta base:
        <span class="mono">{{ resultado.sin_cruce.join(', ') }}</span>
      </div>
      <div v-if="resultado.avisos.length" class="pc-aviso-linea pc-aviso-linea--warn">
        <b>{{ resultado.avisos.length }} con avisos</b> de la API (cifras incompletas):
        <div v-for="(a, i) in resultado.avisos" :key="i" class="pc-aviso-detalle">
          <b>{{ a.proyecto }}</b> — {{ a.avisos[0] }}
        </div>
      </div>
    </div>

    <!-- Contraste: qué se diferencia de lo que hay hoy. No guarda nada. -->
    <div v-if="contraste" class="pc-aviso">
      <div class="pc-aviso-cab">
        <SearchIcon class="size-[1em]" />
        Contraste de {{ contraste.periodo }}:
        <b>{{ contraste.cuadran_exacto }}</b> de {{ contraste.paneles }} cuadran exacto
        <button class="pc-aviso-x" @click="contraste = null"><XIcon class="size-[1em]" /></button>
      </div>
      <div v-for="(p, i) in contraste.proyectos.filter(x => x.diferencias && x.diferencias.length)"
           :key="i" class="pc-contraste-proy">
        <div class="pc-contraste-nombre">{{ p.proyecto }}</div>
        <table class="pc-contraste-tabla">
          <tr v-for="(d, j) in p.diferencias" :key="j">
            <td class="mono">{{ d.grupo }}</td>
            <td>{{ d.concepto }}</td>
            <td class="num">{{ d.excel === null ? '—' : fmt(d.excel) }}</td>
            <td class="num">{{ d.api === null ? '—' : fmt(d.api) }}</td>
            <td class="num" :class="d.diferencia < 0 ? 'neg' : 'pos'">{{ fmt(d.diferencia) }}</td>
          </tr>
        </table>
      </div>
      <div v-if="!contraste.proyectos.some(x => x.diferencias && x.diferencias.length)"
           class="pc-aviso-linea">
        Ninguna diferencia: la API produce lo mismo que hay hoy.
      </div>
    </div>

    <!-- Diálogo: confirmar período antes de elegir archivos -->
    <Dialog v-model:visible="showPeriodoDialog" modal :draggable="false" :closable="true"
            class="pc-dialog" :style="{ width: '420px' }">
      <template #header>
        <div class="dlg-title">¿A qué período y tipo pertenecen estos ER?</div>
      </template>
      <p class="dlg-hint">
        Confirma el mes, año y tipo de carga. Los ER se cargarán y dividirán según
        los inversionistas activos de ese período.
      </p>
      <div class="dlg-grid">
        <div class="fld">
          <label>Mes <span class="req">*</span></label>
          <select v-model="dlgMes" class="dlg-select">
            <option :value="null" disabled>Seleccionar mes</option>
            <option v-for="(nombre, i) in MESES" :key="i" :value="i + 1">{{ nombre }}</option>
          </select>
        </div>
        <div class="fld">
          <label>Año <span class="req">*</span></label>
          <select v-model="dlgAnio" class="dlg-select">
            <option :value="null" disabled>Seleccionar año</option>
            <option v-for="a in ANIOS" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
      </div>
      <div class="fld" style="margin-top:14px;">
        <label>Tipo de carga <span class="req">*</span></label>
        <div class="tipo-opts">
          <label class="tipo-opt" :class="{ on: dlgTipo === 'preliquidacion' }">
            <input type="radio" value="preliquidacion" v-model="dlgTipo" />
            <span><b>Preliquidación</b><small>estimado</small></span>
          </label>
          <label class="tipo-opt" :class="{ on: dlgTipo === 'oficial' }">
            <input type="radio" value="oficial" v-model="dlgTipo" />
            <span><b>Liquidación oficial</b><small>real</small></span>
          </label>
        </div>
      </div>
      <div class="fld" style="margin-top:14px;">
        <label>Tipo de liquidación <span class="req">*</span></label>
        <div class="tipo-opts tres">
          <label class="tipo-opt" :class="{ on: dlgTipoCarga === 'normal' }">
            <input type="radio" value="normal" v-model="dlgTipoCarga" />
            <span><b>Normal</b><small>ingreso bruto</small></span>
          </label>
          <label class="tipo-opt" :class="{ on: dlgTipoCarga === 'neu' }">
            <input type="radio" value="neu" v-model="dlgTipoCarga" />
            <span><b>NEU</b><small>despacho + bolsa</small></span>
          </label>
          <label class="tipo-opt" :class="{ on: dlgTipoCarga === 'nitro' }">
            <input type="radio" value="nitro" v-model="dlgTipoCarga" />
            <span><b>NITRO</b><small>bruto + comerc.</small></span>
          </label>
        </div>
        <div class="dlg-aviso">
          Solo se cargarán los proyectos clasificados como
          <b>{{ dlgTipoCarga.toUpperCase() }}</b> para este período. Los demás se
          reportarán como rechazados.
        </div>
      </div>
      <template #footer>
        <button class="mini" @click="showPeriodoDialog = false">Cancelar</button>
        <button class="btn" :disabled="!dlgMes || !dlgAnio || !dlgTipo || !dlgTipoCarga" @click="confirmarPeriodo">
          Continuar <ArrowRightIcon class="size-[1em]" style="font-size:11px;" />
        </button>
      </template>
    </Dialog>

    <!-- Tabs -->
    <div class="tabs">
      <div class="tab" :class="{ act: tab === 'preliquidacion' }" @click="setTab('preliquidacion')">Preliquidación</div>
      <div class="tab" :class="{ act: tab === 'oficial' }" @click="setTab('oficial')">Oficial</div>
      <div class="tab" :class="{ act: tab === 'seleccion' }" @click="setTab('seleccion')">Selección</div>
      <div class="tab" :class="{ act: tab === 'diferencia' }" @click="setTab('diferencia')">Diferencia</div>
      <div class="tab" :class="{ act: tab === 'clasificacion' }" @click="setTab('clasificacion')">Clasificación</div>
    </div>

    <div v-if="uploading" class="banner">
      <LoaderCircleIcon class="size-[1em] animate-spin" /> Procesando ER ({{ uploading }})…
    </div>
    <div v-if="uploadMsg" class="banner banner-info" v-html="uploadMsg" />

    <!-- ER rechazados por clasificación cruzada -->
    <div v-if="rechazados.length" class="banner banner-rechazo">
      <div class="rechazo-h">
        <TriangleAlertIcon class="size-[1em]" />
        <b>{{ rechazados.length }} ER no se cargaron</b> — clasificación distinta a la sección elegida
      </div>
      <ul class="rechazo-list">
        <li v-for="(r, i) in rechazados" :key="i">{{ r.mensaje }}</li>
      </ul>
    </div>

    <!-- ── PRELIQUIDACIÓN / OFICIAL / SELECCIÓN ── -->
    <template v-if="tab === 'preliquidacion' || tab === 'oficial' || tab === 'seleccion'">
      <div v-if="loading" class="empty"><LoaderCircleIcon class="size-[1em] animate-spin" /> Cargando…</div>

      <template v-else>
        <!-- Filtros de la lista de proyectos -->
        <div v-if="paneles.length" class="filtros">
          <span class="filtro-busca">
            <SearchIcon class="size-[1em]" />
            <input v-model="fProyecto" placeholder="Buscar proyecto…" />
          </span>
          <select v-model="fTipo" class="filtro-sel">
            <option value="">Tipo: todos</option>
            <option value="normal">Normal</option>
            <option value="neu">NEU</option>
            <option value="nitro">NITRO</option>
          </select>
          <select v-model="fEstado" class="filtro-sel">
            <option value="">Estado: todos</option>
            <option value="liquida">Liquida</option>
            <option value="no">No liquida</option>
            <option value="solo_ing">Solo ingresos</option>
            <option value="solo_cost">Solo costos</option>
            <option value="genera">Genera mandatos</option>
          </select>
          <select v-model="fMarcador" class="filtro-sel">
            <option value="">Marcador: todos</option>
            <option value="con_costos">Con costos</option>
            <option value="sin_costos">Sin costos</option>
            <option value="bolsa">Con bolsa</option>
          </select>
          <select v-model="fInv" class="filtro-sel">
            <option value="">Inversionista: todos</option>
            <option v-for="nom in inversionistasLista" :key="nom" :value="nom">{{ nom }}</option>
          </select>
          <select v-model="fBloque" class="filtro-sel">
            <option value="">Documento: todos</option>
            <option value="mandato">Mandato (ingresos)</option>
            <option value="costos">Costos</option>
            <option value="factura">Factura (Repr/CGM/Admin)</option>
          </select>
          <span class="filtro-count">{{ panelesFiltrados.length }} / {{ paneles.length }}</span>
          <button v-if="hayFiltro" class="mini" @click="limpiarFiltros">Limpiar</button>
        </div>

        <!-- Selección + consecutivos (solo pestaña Selección) -->
        <div v-if="tab === 'seleccion'" class="card">
          <div class="card-h">
            <h3>Selección de liquidación</h3>
            <div class="sel-tipo">
              <span>Tipo:</span>
              <label class="vt-opt" :class="{ on: selTipo === 'preliquidacion' }">
                <input type="radio" value="preliquidacion" v-model="selTipo" @change="cargarPaneles" /> Preliquidación
              </label>
              <label class="vt-opt" :class="{ on: selTipo === 'oficial' }">
                <input type="radio" value="oficial" v-model="selTipo" @change="cargarPaneles" /> Oficial
              </label>
            </div>
          </div>
          <div class="card-h" style="border-top:1px solid var(--line); padding-top:10px;">
            <span class="hint" style="padding:0">Marca qué liquidar; el detalle contable está en las pestañas Preliquidación / Oficial.</span>
            <div class="pool-actions">
              <button class="mini" @click="selAll('liquidar_ingresos', true)">Liq. ingresos todos</button>
              <button class="mini" @click="selAll('liquidar_costos', true)">Liq. costos todos</button>
              <button class="mini" @click="selNinguno">Ninguno</button>
              <button class="mini" @click="selAll('generar_mandatos', true)">Generar todos</button>
            </div>
          </div>

          <div v-if="cargaError" class="empty sm">
            No se pudieron cargar los paneles de {{ periodoLabel }} (error de conexión).
            <button class="mini" style="margin-left:8px" @click="cargarPaneles">Reintentar</button>
          </div>

          <div v-else-if="!paneles.length" class="empty sm">
            No hay paneles para {{ periodoLabel }}. Carga uno o varios archivos ER.
          </div>

          <div v-else class="tbl-wrap">
            <table class="ptbl">
              <thead><tr>
                <th class="l">Proyecto</th>
                <th>Inversionistas</th>
                <th>Ingreso bruto</th>
                <th>Liq. Ingresos</th>
                <th>Liq. Costos</th>
                <th>Generar mandatos</th>
              </tr></thead>
              <tbody>
                <tr v-for="p in panelesFiltrados" :key="p.id">
                  <td class="l">
                    <span class="pname">{{ p.proyecto }}</span>
                    <span v-if="!p.tiene_costos" class="pill pill-warn">sin costos</span>
                    <span v-if="p.tiene_bolsa" class="pill pill-bolsa">bolsa</span>
                  </td>
                  <td><span class="pmeta">{{ p.inversionistas.map(i => i.nombre).join(', ') }}</span></td>
                  <td style="text-align:right;">{{ fmtCOP(p.ingreso_bruto_cop) }}</td>
                  <td><input type="checkbox" class="chk" v-model="p.liquidar_ingresos" @change="onFlag(p)" /></td>
                  <td><input type="checkbox" class="chk" v-model="p.liquidar_costos"
                             :title="!p.tiene_costos ? 'Este mes el ER no trajo costos; puedes marcarlo igual (los costos pueden venir de la vista de costos)' : ''" @change="onFlag(p)" /></td>
                  <td><input type="checkbox" class="gen-chk" v-model="p.generar_mandatos" @change="onFlag(p)" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Consecutivos: SOLO en oficial (la preliquidación no lleva; el mandato
               oficial = la diferencia). Únicos globalmente por cadena. -->
          <div v-if="tipoDatos === 'oficial'" class="cons-pool">
            <div class="fld">
              <label>Consecutivo Ingresos inicial</label>
              <input type="number" v-model.number="consIngIni" @change="reasignarTodo" />
              <span v-if="consInfo && consInfo.ingresos.usados.includes(consIngIni)" class="cons-warn">
                ⚠ {{ consIngIni }} ya está usado —
                <button class="mini" @click="usarSiguiente('ing')">usar {{ consInfo.ingresos.siguiente }}</button>
              </span>
            </div>
            <div class="fld">
              <label>Consecutivo Costos inicial</label>
              <input type="number" v-model.number="consCosIni" @change="reasignarTodo" />
              <span v-if="consInfo && consInfo.costos.usados.includes(consCosIni)" class="cons-warn">
                ⚠ {{ consCosIni }} ya está usado —
                <button class="mini" @click="usarSiguiente('cos')">usar {{ consInfo.costos.siguiente }}</button>
              </span>
            </div>
            <div class="hint">
              Ingresos y costos numeran por separado y son únicos globalmente (no se
              repiten entre períodos).
              <template v-if="consInfo"> Siguiente libre: Ing <b>{{ consInfo.ingresos.siguiente }}</b> · Cost <b>{{ consInfo.costos.siguiente }}</b>.</template>
            </div>
            <div class="summary">
              <b>{{ nLiqIng }}</b> liq. ingresos · <b>{{ nLiqCost }}</b> liq. costos · <b>{{ nGeneran }}</b> generan mandatos
            </div>
          </div>
          <div v-else class="hint" style="padding:8px 12px">
            La preliquidación no lleva consecutivos — se asignan en el panel <b>oficial</b> (el mandato = la diferencia).
          </div>
        </div>

        <!-- Mapeo de celdas del ER: se movió aquí desde el detalle para no estorbar.
             Solo aplica a Ingresos / Comercialización (lo que aún viene del ER). -->
        <div v-if="tab === 'seleccion' && paneles.length" class="card" style="margin-top:14px">
          <div class="card-h">
            <h3>Mapeo de celdas del ER</h3>
            <span class="hint" style="padding:0">Corrige a qué celda del ER apunta un concepto de Ingresos / Comercialización.</span>
          </div>
          <div v-for="p in panelesFiltrados" :key="'m' + p.id" class="mapeo-proy">
            <div class="mapeo-h" @click="toggleMapeo(p.id)">
              <span class="chev" :class="{ op: mapeoOpen[p.id] }">▶</span>
              <b>{{ p.proyecto }}</b>
            </div>
            <div v-show="mapeoOpen[p.id]" class="tbl-wrap" style="padding:0 12px 10px">
              <table class="dt">
                <thead><tr><th class="l">Concepto</th><th class="l">Celda (hoja!celda)</th></tr></thead>
                <tbody>
                  <tr v-for="ln in lineasMapeables(p)" :key="ln.grupo + '|' + ln.concepto">
                    <td class="l">{{ ln.concepto }}</td>
                    <td class="l"><input class="celda-origen" :value="ln.origen" placeholder="hoja!celda"
                                         @change="cambiarCelda(p, ln, $event.target.value)" /></td>
                  </tr>
                  <tr v-if="!lineasMapeables(p).length"><td class="l muted" colspan="2">Sin conceptos mapeables.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Detalle por proyecto (solo Preliquidación / Oficial) -->
        <template v-if="tab === 'preliquidacion' || tab === 'oficial'">
        <div class="sec-title-row">
          <div class="sec-title">Detalle contable por proyecto</div>
          <span class="hint" style="padding:0">Muestra el 100% del proyecto; expande cada uno para el desglose por inversionista.</span>
        </div>
        <div v-if="!panelesFiltrados.length" class="empty sm">Ningún proyecto coincide con los filtros.</div>
        <div v-for="p in panelesFiltrados" :key="'d' + p.id" class="proj" :class="{ off: !esActivo(p), open: open[p.id] }">
          <div class="phead" @click="toggle(p.id)">
            <span class="chev">▶</span>
            <div class="pn">{{ p.proyecto }}</div>
            <span v-if="!p.tiene_costos" class="pill pill-warn">sin costos</span>
            <span v-if="p.tiene_bolsa" class="pill pill-bolsa">bolsa</span>
            <span v-if="p.generar_mandatos" class="pill pill-gen">genera mandatos</span>
            <span v-if="p.liquidar_ingresos && !p.liquidar_costos" class="pill pill-bolsa">solo ingresos</span>
            <span v-if="!p.liquidar_ingresos && p.liquidar_costos" class="pill pill-bolsa">solo costos</span>
            <span v-if="!esActivo(p)" class="pill pill-off">no liquida</span>
            <!-- Con qué se armó el panel. Los ingresos no tienen columna `fuente`,
                 así que sin esto no habría forma de saberlo. -->
            <span class="pill" :class="p.origen === 'api' ? 'pill-api' : 'pill-er'"
                  v-tooltip.top="p.origen === 'api'
                    ? 'Armado desde la API de Liquidaciones'
                    : 'Armado desde el Excel del Estado de Resultados'">
              {{ p.origen === 'api' ? 'API' : 'Excel' }}
            </span>
            <div class="pcons">
              <span>Ing: <b>{{ tab === 'oficial' ? (p.consecutivo_ingresos ?? '—') : '—' }}</b></span>
              <span>Cost: <b>{{ tab === 'oficial' ? (p.consecutivo_costos ?? '—') : '—' }}</b></span>
              <button class="btn-er" @click.stop="descargarEr(p)"
                      v-tooltip.left="'Descargar el Estado de Resultados de este proyecto'">
                <DownloadIcon class="size-[1em]" /> ER
              </button>
            </div>
          </div>

          <div class="body" v-show="open[p.id]">
            <!-- Tabla plana 100% (vista por defecto) -->
            <div class="tbl-wrap">
              <table class="dt flat">
                <thead><tr>
                  <th class="l">Concepto</th><th class="l">Fuente</th><th>Valor</th>
                  <th class="l">Comprobante</th><th class="l">Soporte</th>
                </tr></thead>
                <tbody>
                  <template v-for="blk in bloquesMostrados()" :key="blk.key">
                    <tr class="blk-h"><td colspan="5">{{ blk.label }}</td></tr>
                    <tr v-for="(ln, i) in lineas100Bloque(p, blk)" :key="blk.key + i" :class="{ derivada: ln.derivada }">
                      <td class="l">{{ ln.concepto }}<span v-if="ln.derivada" class="imp-tag">impuesto</span></td>
                      <td class="l">
                        <span v-if="ln.fuente" class="fuente-tag" :title="fuenteTitle(ln.fuente)">{{ fuenteLabel(ln.fuente) }}</span>
                        <span v-else-if="!ln.derivada" class="muted" style="font-size:11px">ER</span>
                      </td>
                      <td :class="{ neg: ln.valor_cop < 0 }">{{ fmt(ln.valor_cop) }}</td>
                      <td class="l muted">{{ ln.comprobante_contable || '' }}</td>
                      <td class="l">
                        <template v-if="ln.derivada"></template>
                        <template v-else-if="ln.soporte">
                          <a class="sop-link" :href="ln.soporte.archivo_url" target="_blank" rel="noopener"
                             :title="ln.soporte.archivo_nombre || 'Ver soporte'">📎 ver</a>
                          <button class="sop-x" title="Quitar soporte" @click="eliminarSoporte(p, ln)">✕</button>
                        </template>
                        <button v-else class="sop-up" :disabled="subiendoSoporte === sopKey(ln)"
                                title="Subir soporte" @click="pickSoporte(p, ln)">
                          {{ subiendoSoporte === sopKey(ln) ? '…' : '📎 subir' }}
                        </button>
                      </td>
                    </tr>
                    <tr class="blk-tot">
                      <td class="l" colspan="2">Valor a pagar</td>
                      <td :class="{ neg: total100Bloque(p, blk) < 0 }">{{ fmt(total100Bloque(p, blk)) }}</td>
                      <td colspan="2"></td>
                    </tr>
                  </template>
                  <tr class="blk-res">
                    <td class="l" colspan="2">RESULTADO · Valor a pagar (100%)</td>
                    <td :class="{ neg: utilidad100(p) < 0 }">{{ fmt(utilidad100(p)) }}</td>
                    <td colspan="2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Desglose por inversionista (expandible; aquí se editan valores/comprobante) -->
            <button class="expand-inv" @click="toggleInv(p.id)">
              <span class="chev" :class="{ op: invOpen[p.id] }">▶</span>
              {{ invOpen[p.id] ? 'Ocultar' : 'Ver' }} desglose por inversionista ({{ p.inversionistas.length }})
            </button>

            <template v-if="invOpen[p.id]">
              <div v-for="inv in p.inversionistas" :key="invKeyOf(inv)" class="inv-block">
                <div class="inv-head">
                  <div class="inv-name">{{ inv.nombre }} · {{ (inv.porcentaje ?? 0).toFixed(2) }}%</div>
                  <div class="inv-cons">
                    <span>Ing: <b>{{ tab === 'oficial' && p.liquidar_ingresos ? (p.consecutivo_ingresos ?? '—') : '—' }}</b></span>
                    <span>Cost: <b>{{ tab === 'oficial' && p.liquidar_costos ? (p.consecutivo_costos ?? '—') : '—' }}</b></span>
                  </div>
                </div>

                <!-- Acordeones por sección: colapsados → solo título + total -->
                <div class="secs">
                  <template v-for="sec in secciones" :key="sec.key">
                  <div v-show="lineasSec(inv, sec.key).length || sec.key === 'ingresos'"
                       class="sec-acc" :class="{ open: secOpen[secKey(p.id, invKeyOf(inv), sec.key)] }">
                    <div class="sec-bar" @click="toggleSec(p.id, invKeyOf(inv), sec.key)">
                      <span class="chev">▶</span>
                      <span class="sec-lbl">{{ sec.label }}</span>
                      <span class="sec-tot" :class="{ neg: totalSec(inv, sec.key) < 0 }">{{ fmt(totalSec(inv, sec.key)) }}</span>
                    </div>
                    <div class="sec-body" v-show="secOpen[secKey(p.id, invKeyOf(inv), sec.key)]">
                      <div class="tbl-wrap">
                        <table class="dt">
                          <thead><tr>
                            <th class="l">Concepto</th>
                            <th>Valor ({{ shortName(inv.nombre) }})</th>
                            <th class="l">Comprobante</th>
                            <th class="l">Soporte</th>
                          </tr></thead>
                          <tbody>
                            <tr v-for="ln in lineasSec(inv, sec.key)" :key="ln.id || (ln.grupo + '|' + ln.concepto)"
                                :class="{ derivada: ln.derivada }">
                              <td class="l">
                                <div v-if="sec.key === 'ingresos'" class="fuente-row">
                                  <input class="fuente-et" :value="ln.concepto"
                                         @change="renombrarFuente(p, ln, $event.target.value)" />
                                  <button class="fuente-x" title="Quitar fuente" @click="quitarFuente(p, ln)">✕</button>
                                </div>
                                <div v-else class="cpt">{{ ln.concepto }}<span v-if="ln.derivada" class="imp-tag">impuesto</span><span v-if="ln.fuente" class="fuente-tag" :title="fuenteTitle(ln.fuente)">{{ fuenteLabel(ln.fuente) }}</span></div>
                                <!-- Valor de módulo (O&M / Arriendos): no viene de una celda del ER, así que
                                     no se edita la celda de origen; se indica de dónde sale. -->
                                <div v-if="!ln.derivada && ln.fuente" class="origen-wrap">
                                  <span class="origen-mod">↳ {{ fuenteOrigen(ln.fuente) }}</span>
                                </div>
                              </td>
                              <td>
                                <input v-if="!ln.derivada" class="val-in" :class="{ neg: ln.valor_cop < 0 }"
                                       type="text" inputmode="decimal"
                                       :value="editandoMonto === ln.id ? montoPlano(ln.valor_cop) : fmt(ln.valor_cop)"
                                       @focus="editandoMonto = ln.id"
                                       @blur="commitMonto(ln, p, $event)"
                                       @keyup.enter="$event.target.blur()" />
                                <span v-else class="val-ro" :class="{ neg: ln.valor_cop < 0 }">{{ fmt(ln.valor_cop) }}</span>
                              </td>
                              <td class="l">
                                <input v-if="!ln.derivada" class="comp-in" placeholder="comprob." v-model="ln.comprobante_contable" @change="markDirty(p)" />
                              </td>
                              <td class="l">
                                <template v-if="ln.derivada"></template>
                                <template v-else-if="ln.soporte">
                                  <a class="sop-link" :href="ln.soporte.archivo_url" target="_blank" rel="noopener"
                                     :title="ln.soporte.archivo_nombre || 'Ver soporte'">📎 ver</a>
                                  <button class="sop-x" title="Quitar soporte" @click="eliminarSoporte(p, ln)">✕</button>
                                </template>
                                <button v-else class="sop-up" :disabled="subiendoSoporte === sopKey(ln)"
                                        title="Subir soporte" @click="pickSoporte(p, ln)">
                                  {{ subiendoSoporte === sopKey(ln) ? '…' : '📎 subir' }}
                                </button>
                              </td>
                            </tr>
                            <tr v-if="sec.key === 'ingresos'">
                              <td colspan="4">
                                <button class="fuente-add" @click="agregarFuente(p)">+ Agregar fuente de ingreso</button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <!-- Subtotales "Valor a pagar" por bloque contable (Mandato/Costos/Facturas) -->
                  <div v-if="sec.key === 'comercializacion'" class="sec-subtotal">
                    <span class="sec-lbl">Valor a pagar (Ingresos − Comercialización)</span>
                    <span class="sec-tot" :class="{ neg: (totalSec(inv, 'ingresos') + totalSec(inv, 'comercializacion')) < 0 }">{{ fmt(totalSec(inv, 'ingresos') + totalSec(inv, 'comercializacion')) }}</span>
                  </div>
                  <div v-else-if="sec.key === 'costos'" class="sec-subtotal">
                    <span class="sec-lbl">Valor a pagar (Costos Operativos)</span>
                    <span class="sec-tot" :class="{ neg: totalSec(inv, 'costos') < 0 }">{{ fmt(totalSec(inv, 'costos')) }}</span>
                  </div>
                  <div v-else-if="sec.key === 'facturas'" class="sec-subtotal">
                    <span class="sec-lbl">Valor a pagar (Facturas de Servicio)</span>
                    <span class="sec-tot" :class="{ neg: totalSec(inv, 'facturas') < 0 }">{{ fmt(totalSec(inv, 'facturas')) }}</span>
                  </div>
                  </template>

                  <!-- RESULTADO · valor a pagar: siempre visible -->
                  <div class="sec-resultado">
                    <span class="sec-lbl">RESULTADO · Valor a pagar</span>
                    <span class="sec-tot" :class="{ neg: utilidad(inv) < 0 }">{{ fmt(utilidad(inv)) }}</span>
                  </div>
                </div>
              </div>
            </template>

            <div class="proj-foot">
              <button class="btn" :disabled="!dirty[p.id]" @click="guardar(p)">
                <SaveIcon class="size-[1em]" /> Guardar cambios
              </button>
              <span v-if="savedAt[p.id]" class="saved">✓ guardado</span>
            </div>
          </div>
        </div>
        </template>
      </template>
    </template>

    <!-- ── CLASIFICACIÓN ── -->
    <template v-if="tab === 'clasificacion'">
      <div class="card">
        <div class="card-h">
          <h3>Clasificación de liquidación · {{ periodoLabel || 'sin período' }}</h3>
          <div class="pool-actions">
            <input v-model="clasSearch" class="search-in" placeholder="Buscar proyecto…" />
            <button class="btn" :disabled="!periodo || clasSaving || !clasDirty" @click="guardarClasificacion">
              <SaveIcon class="size-[1em]" /> Guardar clasificación
            </button>
          </div>
        </div>

        <div class="banner-aviso">
          <InfoIcon class="size-[1em]" />
          La clasificación es <b>por período</b> — un proyecto puede cambiar de
          tipo entre meses. El tipo define cómo se leen los ingresos del ER al cargarlo.
        </div>

        <div v-if="!periodo" class="empty sm">Selecciona un período arriba para clasificar.</div>
        <div v-else-if="clasLoading" class="empty"><LoaderCircleIcon class="size-[1em] animate-spin" /> Cargando…</div>
        <div v-else-if="!clasFiltrados.length" class="empty sm">Sin proyectos.</div>

        <div v-else class="tbl-wrap">
          <table class="ptbl">
            <thead><tr>
              <th class="l">Proyecto</th>
              <th>Tipo de liquidación</th>
            </tr></thead>
            <tbody>
              <tr v-for="c in clasFiltrados" :key="c.proyecto_id">
                <td class="l"><span class="pname">{{ c.proyecto }}</span></td>
                <td>
                  <div class="seg" :class="'seg-' + c.tipo">
                    <label :class="{ on: c.tipo === 'normal' }">
                      <input type="radio" :value="'normal'" v-model="c.tipo" @change="clasDirty = true" /> Normal
                    </label>
                    <label :class="{ on: c.tipo === 'neu' }">
                      <input type="radio" :value="'neu'" v-model="c.tipo" @change="clasDirty = true" /> NEU
                    </label>
                    <label :class="{ on: c.tipo === 'nitro' }">
                      <input type="radio" :value="'nitro'" v-model="c.tipo" @change="clasDirty = true" /> NITRO
                    </label>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ── DIFERENCIA ── -->
    <template v-else-if="tab === 'diferencia'">
      <div v-if="loading" class="empty"><LoaderCircleIcon class="size-[1em] animate-spin" /> Cargando…</div>

      <!-- Sin liquidación oficial todavía -->
      <div v-else-if="!diff.tiene_oficial" class="card">
        <div class="empty">
          <ClockIcon class="size-[1em]" style="font-size:22px; display:block; margin-bottom:8px; color:var(--p2);" />
          Aún no hay liquidación oficial para comparar.<br />
          Carga el ER oficial en la pestaña <b>Oficial</b>.
        </div>
      </div>

      <div v-else-if="!diff.proyectos?.length" class="card">
        <div class="empty sm">Sin datos para comparar en {{ periodoLabel }}.</div>
      </div>

      <template v-else>
        <div v-for="proy in diff.proyectos" :key="proy.proyecto_id" class="diff-proy">
          <div class="diff-proy-h">{{ proy.proyecto_nombre }}</div>

          <!-- KPIs por proyecto -->
          <div class="cards-resumen">
            <div class="rc">
              <div class="rc-lbl">Utilidad estimada</div>
              <div class="rc-val">{{ fmt(proy.utilidad_pre) }}</div>
            </div>
            <div class="rc">
              <div class="rc-lbl">Utilidad real</div>
              <div class="rc-val">{{ proy.tiene_oficial ? fmt(proy.utilidad_oficial) : 'pendiente' }}</div>
            </div>
            <div class="rc">
              <div class="rc-lbl">Diferencia</div>
              <div class="rc-val" :class="diffClass(proy.utilidad_dif)">
                <span v-if="proy.utilidad_dif != null" class="arrow">{{ arrow(proy.utilidad_dif) }}</span>{{ fmt(proy.utilidad_dif) }}
              </div>
            </div>
          </div>

          <!-- Tabla por inversionista -->
          <div v-for="inv in proy.inversionistas" :key="inv.proyecto_inversionista_id || inv.nombre" class="card">
            <div class="inv-head">
              <div class="inv-name">{{ inv.nombre }} · {{ (inv.porcentaje ?? 0).toFixed(2) }}%</div>
            </div>
            <div class="tbl-wrap">
              <table class="dt diff-dt">
                <thead><tr>
                  <th class="l">Concepto</th>
                  <th>Preliquidación</th>
                  <th>Oficial</th>
                  <th>Diferencia</th>
                  <th>%</th>
                </tr></thead>
                <tbody>
                  <template v-for="g in grupos" :key="g.key">
                    <template v-if="lineasGrupo(inv, g.key).length">
                      <tr class="grp"><td colspan="5">{{ g.label }}</td></tr>
                      <tr v-for="(ln, i) in lineasGrupo(inv, g.key)" :key="g.key + i">
                        <td class="l">{{ ln.concepto }}</td>
                        <td>{{ fmt(ln.preliquidacion) }}</td>
                        <td>{{ ln.oficial != null ? fmt(ln.oficial) : '—' }}</td>
                        <td :class="diffClass(ln.diferencia)">
                          <span v-if="ln.diferencia != null && ln.diferencia !== 0" class="arrow">{{ arrow(ln.diferencia) }}</span>{{ ln.diferencia != null ? fmt(ln.diferencia) : '—' }}
                        </td>
                        <td :class="diffClass(ln.diferencia)">{{ ln.pct_variacion != null ? ln.pct_variacion.toFixed(1) + '%' : '—' }}</td>
                      </tr>
                    </template>
                  </template>
                  <tr class="grp"><td colspan="5">RESULTADO</td></tr>
                  <tr class="tot">
                    <td class="l">Utilidad</td>
                    <td>{{ fmt(inv.utilidad_pre) }}</td>
                    <td>{{ inv.utilidad_oficial != null ? fmt(inv.utilidad_oficial) : '—' }}</td>
                    <td :class="diffClass(inv.utilidad_dif)">
                      <span v-if="inv.utilidad_dif != null && inv.utilidad_dif !== 0" class="arrow">{{ arrow(inv.utilidad_dif) }}</span>{{ inv.utilidad_dif != null ? fmt(inv.utilidad_dif) : '—' }}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { PanelContableService } from '~/features/panel-contable/services/panel-contable'
import { toast } from 'vue-sonner'
import Dialog from 'primevue/dialog'
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon, ClockIcon, DownloadIcon, FileSpreadsheetIcon, InfoIcon, LoaderCircleIcon, SaveIcon, SearchIcon, TriangleAlertIcon, UploadIcon, XIcon, ZapIcon } from '@lucide/vue'


// Grupos de VISUALIZACIÓN. `keys` son las claves de `grupo` del backend que
// se renderizan juntas bajo un mismo encabezado. "COSTOS OPERATIVOS" combina
// las líneas de 'costos' y 'facturas' (Representación, CGM, Administración).
// No se altera el campo `grupo` de los datos, solo la presentación.
const grupos = [
  { key: 'ingresos', keys: ['ingresos'], label: 'INGRESOS', total: 'Total Ingresos' },
  { key: 'comercializacion', keys: ['comercializacion'], label: 'COMERCIALIZACIÓN XM', total: 'Total Comercialización' },
  { key: 'costos', keys: ['costos', 'facturas'], label: 'COSTOS OPERATIVOS', total: 'Total Costos Operativos' },
]

// Secciones del DETALLE por proyecto: cada una es un acordeón colapsado que
// muestra solo su título + total; al expandir revela los conceptos. A
// diferencia de `grupos` (usado en Diferencia), aquí FACTURAS DE SERVICIO se
// separa de COSTOS OPERATIVOS para aligerar la lectura.
const secciones = [
  { key: 'ingresos', keys: ['ingresos'], label: 'INGRESOS' },
  { key: 'comercializacion', keys: ['comercializacion'], label: 'COMERCIALIZACIÓN XM' },
  { key: 'costos', keys: ['costos'], label: 'COSTOS OPERATIVOS' },
  { key: 'facturas', keys: ['facturas'], label: 'FACTURAS DE SERVICIO' },
]

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const ANIOS = [2025, 2026]

const tab = ref('preliquidacion')
// En la pestaña "Selección" se gestionan los flags de un tipo (preliq/oficial) con
// este switch; en las pestañas de detalle el tipo es la propia pestaña.
const selTipo = ref('oficial')
const tipoDatos = computed(() => (tab.value === 'seleccion' ? selTipo.value : tab.value))
// Período visible en formato "YYYY-MM" (lo que esperan las llamadas del Panel).
// Arranca en el MES ANTERIOR: el panel es de mes vencido, el mes en curso suele
// estar vacío. Se navega con las flechas ‹ › (mismo patrón que Facturación).
function mesPanelISO (delta = 0) {
  const n = new Date()
  const d = new Date(n.getFullYear(), n.getMonth() + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const periodo = ref(mesPanelISO(-1))
const esMesActual = computed(() => periodo.value === mesPanelISO(0))
// Navega un mes; no deja pasar del mes actual. Recarga igual que el antiguo @change.
function stepMes (delta) {
  const [y, m] = (periodo.value || mesPanelISO(0)).split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (delta > 0 && next > mesPanelISO(0)) return
  periodo.value = next
  setTab(tab.value)
}

// Diálogo de período previo a la carga de ER.
const showPeriodoDialog = ref(false)
const dlgMes = ref(null)   // 1..12
const dlgAnio = ref(null)  // 2025 | 2026
const dlgTipo = ref('preliquidacion')  // 'preliquidacion' | 'oficial'
const dlgTipoCarga = ref('normal')     // 'normal' | 'neu' | 'nitro'
const tipoCarga = ref('preliquidacion')  // tipo confirmado para la carga en curso
const tipoCargaConfirm = ref('normal')   // tipo_carga confirmado para la carga en curso
const rechazados = ref([])               // ER rechazados por clasificación cruzada
const paneles = ref([])
const diff = ref({})
const open = reactive({})
const dirty = reactive({})
const savedAt = reactive({})
// Mapeo de celdas del ER (pestaña Selección): despliegue por proyecto + qué líneas
// son mapeables (las que aún vienen del ER: Ingresos / Comercialización).
const mapeoOpen = reactive({})
const toggleMapeo = (id) => { mapeoOpen[id] = !mapeoOpen[id] }
const lineasMapeables = (p) => (p.total_100 || []).filter(
  l => (l.grupo === 'ingresos' || l.grupo === 'comercializacion') && !l.derivada)

// Valores que vienen de un módulo/tarifa de la app (no del ER). Etiqueta, tooltip y
// texto de origen que se muestra debajo del concepto.
const FUENTES = {
  om:         { label: 'O&M',       title: 'O&M',                     origen: 'del módulo O&M' },
  arriendos:  { label: 'Arriendos', title: 'Arriendos',               origen: 'del módulo Arriendos' },
  internet:   { label: 'Internet',  title: 'Internet',                origen: 'tarifa mensual del contrato' },
  servicios:  { label: 'Tarifa app', title: 'Representación / CGM',   origen: 'tarifa de la app × kWh' },
  operacion:  { label: 'Operación',  title: 'Administración (operación)', origen: 'tarifa admin × ingresos' },
  starlink:   { label: 'Starlink',   title: 'Internet (Starlink)',     origen: 'de la factura de Starlink' },
  api:        { label: 'API',        title: 'API de Liquidaciones',    origen: 'de la API de Liquidaciones' },
}
const fuenteLabel = (f) => (FUENTES[f]?.label) || f
const fuenteTitle = (f) => (FUENTES[f]?.title) || f
const fuenteOrigen = (f) => (FUENTES[f]?.origen) || 'de un módulo'
const loading = ref(false)
const panelContableService = new PanelContableService()

// ── Armar desde la API y contrastar ──────────────────────────────────────────
// El Panel se arma desde `income_statement_data`; el Excel quedó solo para NEU y
// Nitro, cuyo dato en esa API está malo.
const armando = ref(false)
const contrastando = ref(false)
const resultado = ref(null)      // lo que devolvió "Armar desde API"
const contraste = ref(null)      // lo que devolvió "Contrastar"

async function armarPeriodo() {
  if (!periodo.value) return
  armando.value = true
  resultado.value = null
  try {
    const data = await panelContableService.armarPeriodo({ periodo: periodo.value, tipo: tipoDatos.value })
    resultado.value = data
    toast.success(`${data.armados} paneles armados`, {
      description: data.omitidos.length
        ? `${data.omitidos.length} omitidos (NEU/Nitro): siguen con su Excel.`
        : 'Todos los proyectos del período.',
      duration: 7000,
    })
    // Refrescar DESPUÉS de avisar y en su propio try: si falla el refresco, los
    // paneles ya quedaron escritos. Reportarlo como "no se pudo armar" haría
    // creer que no pasó nada y llevaría a ejecutarlo de nuevo.
    try {
      await cargarPaneles()
    } catch {
      toast.warning('Paneles armados, vista sin refrescar', {
        description: 'Recarga la página para verlos.', duration: 6000,
      })
    }
  } catch (e) {
    toast.error('No se pudo armar el período', {
      description: e?.data?.detail || e.message, duration: 8000,
    })
  } finally {
    armando.value = false
  }
}

async function verContraste() {
  if (!periodo.value) return
  contrastando.value = true
  try {
    const data = await panelContableService.obtenerContraste({ periodo: periodo.value, tipo: tipoDatos.value })
    contraste.value = data
  } catch (e) {
    toast.error('No se pudo contrastar', {
      description: e?.data?.detail || e.message, duration: 8000,
    })
  } finally {
    contrastando.value = false
  }
}

/** Descarga el ER que generamos nosotros, del proyecto o de un inversionista. */
async function descargarEr(panel, inversionista = null) {
  try {
    const data = await panelContableService.descargarEstadoResultados(panel.id, inversionista)
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    const sufijo = inversionista ? ` - ${inversionista}` : ''
    a.download = `Estado resultados ${panel.proyecto_nombre || panel.proyecto || ''} ${periodo.value}${sufijo}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    toast.error('No se pudo generar el ER', {
      description: e?.data?.detail || e.message, duration: 6000,
    })
  }
}
const cargaError = ref(false)   // distingue "falló la carga" de "no hay paneles"
const uploading = ref(0)
const uploadMsg = ref('')
const consIngIni = ref(793)
const consCosIni = ref(850)
const consInfo = ref(null)   // { ingresos:{usados,siguiente}, costos:{...} } de oficiales (global)

async function cargarConsInfo () {
  try {
    const data = await panelContableService.obtenerConsecutivosUsados()
    consInfo.value = data
  } catch { consInfo.value = null }
}
function usarSiguiente (cadena) {
  if (!consInfo.value) return
  if (cadena === 'ing') consIngIni.value = consInfo.value.ingresos.siguiente
  else consCosIni.value = consInfo.value.costos.siguiente
  reasignarTodo()
}
const erInput = ref(null)

// Clasificación de liquidación por período.
const clasProyectos = ref([])
const clasSearch = ref('')
const clasLoading = ref(false)
const clasSaving = ref(false)
const clasDirty = ref(false)
const clasFiltrados = computed(() => {
  const q = clasSearch.value.trim().toLowerCase()
  if (!q) return clasProyectos.value
  return clasProyectos.value.filter(c => (c.proyecto || '').toLowerCase().includes(q))
})

const periodoLabel = computed(() => {
  if (!periodo.value) return ''
  const [y, m] = periodo.value.split('-')
  return `${MESES[Number(m) - 1] || ''} ${y}`
})
const nLiqIng = computed(() => paneles.value.filter(p => p.liquidar_ingresos).length)
const nLiqCost = computed(() => paneles.value.filter(p => p.liquidar_costos).length)
const nGeneran = computed(() => paneles.value.filter(p => p.generar_mandatos).length)
const esActivo = (p) => p.liquidar_ingresos || p.liquidar_costos

// ── Filtros de la lista de proyectos ──────────────────────────────────────────
const fProyecto = ref('')     // texto
const fTipo = ref('')         // '' | normal | neu | nitro
const fEstado = ref('')       // '' | liquida | no | solo_ing | solo_cost | genera
const fMarcador = ref('')     // '' | con_costos | sin_costos | bolsa
const fInv = ref('')          // nombre de inversionista
const fBloque = ref('')       // '' | mandato | costos | factura (documento contable)
const clasMap = reactive({})  // proyecto_id → tipo de liquidación del período
const hayFiltro = computed(() => !!(fProyecto.value || fTipo.value || fEstado.value || fMarcador.value || fInv.value || fBloque.value))
function limpiarFiltros () { fProyecto.value = ''; fTipo.value = ''; fEstado.value = ''; fMarcador.value = ''; fInv.value = ''; fBloque.value = '' }

// Lista de inversionistas para el filtro (únicos entre todos los paneles).
const inversionistasLista = computed(() => {
  const s = new Set()
  for (const p of paneles.value) for (const inv of (p.inversionistas || [])) if (inv.nombre) s.add(inv.nombre)
  return [...s].sort((a, b) => a.localeCompare(b))
})
// Bloques a mostrar en la tabla plana según el filtro de documento contable.
const bloquesMostrados = () => (fBloque.value ? bloquesPlano.filter(b => b.key === fBloque.value) : bloquesPlano)

const panelesFiltrados = computed(() => {
  const q = fProyecto.value.trim().toLowerCase()
  return paneles.value.filter(p => {
    if (q && !(p.proyecto || '').toLowerCase().includes(q)) return false
    if (fInv.value && !(p.inversionistas || []).some(i => (i.nombre || '') === fInv.value)) return false
    if (fTipo.value && (clasMap[p.proyecto_id] || 'normal') !== fTipo.value) return false
    if (fEstado.value) {
      const liq = p.liquidar_ingresos || p.liquidar_costos
      if (fEstado.value === 'liquida' && !liq) return false
      if (fEstado.value === 'no' && liq) return false
      if (fEstado.value === 'solo_ing' && !(p.liquidar_ingresos && !p.liquidar_costos)) return false
      if (fEstado.value === 'solo_cost' && !(!p.liquidar_ingresos && p.liquidar_costos)) return false
      if (fEstado.value === 'genera' && !p.generar_mandatos) return false
    }
    if (fMarcador.value === 'con_costos' && !p.tiene_costos) return false
    if (fMarcador.value === 'sin_costos' && p.tiene_costos) return false
    if (fMarcador.value === 'bolsa' && !p.tiene_bolsa) return false
    return true
  })
})

const fmt = (n) => {
  const r = Math.round(Number(n) || 0)
  if (r === 0) return '–'
  return (r < 0 ? '-$ ' : '$ ') + Math.abs(r).toLocaleString('es-CO')
}
// Formato de presentación para la tabla de selección: $ es-CO, redondeado,
// sin decimales. Solo afecta cómo se muestra; no altera el dato.
const fmtCOP = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const shortName = (n) => (n || '').split(' ').slice(0, 2).join(' ')

// Monto editable: se ve formateado ($ es-CO, mismo fmt que los totales) en reposo
// y como número plano al enfocar, para no romper la edición. editandoMonto guarda
// el id de la línea enfocada (solo un campo a la vez).
const editandoMonto = ref(null)
const montoPlano = (n) => (n === null || n === undefined || n === '') ? '' : String(n)
const parseMonto = (s) => {
  const v = parseFloat(String(s).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(v) ? v : 0
}
function commitMonto (ln, p, ev) {
  const v = parseMonto(ev.target.value)
  if (v !== Number(ln.valor_cop)) { ln.valor_cop = v; markDirty(p) }
  editandoMonto.value = null
}
const diffClass = (v) => (v == null ? '' : (v > 0 ? 'pos' : (v < 0 ? 'neg' : '')))
const arrow = (v) => (v == null || v === 0 ? '' : (v > 0 ? '▲ ' : '▼ '))

// Resuelve las claves de backend que corresponden a un grupo de visualización.
const _keysDe = (grupo) => {
  const g = grupos.find(x => x.key === grupo)
  return g ? g.keys : [grupo]
}

// Diferencia: líneas de un inversionista por grupo (ya cruzadas en el backend).
const lineasGrupo = (inv, grupo) => {
  const keys = _keysDe(grupo)
  return (inv.lineas || []).filter(l => keys.includes(l.grupo))
}

const lineasDe = (inv, grupo) => {
  const keys = _keysDe(grupo)
  return inv.lineas.filter(l => keys.includes(l.grupo))
}
const totalGrupo = (inv, grupo) => lineasDe(inv, grupo).reduce((s, l) => s + (Number(l.valor_cop) || 0), 0)
const utilidad = (inv) => inv.lineas.reduce((s, l) => s + (Number(l.valor_cop) || 0), 0)

// ── Vista 100% (total proyecto, antes de dividir por inversionista) ──
const vista100 = ref(false)
const lineas100 = (p, grupo) => {
  const keys = _keysDe(grupo)
  return (p.total_100 || []).filter(l => keys.includes(l.grupo))
}
const total100Grupo = (p, grupo) => lineas100(p, grupo).reduce((s, l) => s + (Number(l.valor_cop) || 0), 0)
const utilidad100 = (p) => (p.total_100 || []).reduce((s, l) => s + (Number(l.valor_cop) || 0), 0)

// ── Tabla plana 100% (vista por defecto del detalle) ──
// Bloques contables: Mandato (ingresos+comercialización), Costos, Factura (Repr/CGM/Admin).
const bloquesPlano = [
  { key: 'mandato', keys: ['ingresos', 'comercializacion'], label: 'MANDATO' },
  { key: 'costos', keys: ['costos'], label: 'COSTOS' },
  { key: 'factura', keys: ['facturas'], label: 'FACTURA' },
]
const lineas100Bloque = (p, blk) => (p.total_100 || []).filter(l => blk.keys.includes(l.grupo))
const total100Bloque = (p, blk) => lineas100Bloque(p, blk).reduce((s, l) => s + (Number(l.valor_cop) || 0), 0)
// Desglose por inversionista, expandible por proyecto (colapsado por defecto).
const invOpen = reactive({})
const toggleInv = (id) => { invOpen[id] = !invOpen[id] }

// ── Acordeones del detalle por proyecto (un nivel más de colapso) ──
// Resolución de claves específica de `secciones` (FACTURAS separado de COSTOS).
const _keysDeSec = (sk) => {
  const s = secciones.find(x => x.key === sk)
  return s ? s.keys : [sk]
}
const lineasSec = (inv, sk) => inv.lineas.filter(l => _keysDeSec(sk).includes(l.grupo))
const totalSec = (inv, sk) => lineasSec(inv, sk).reduce((s, l) => s + (Number(l.valor_cop) || 0), 0)
const lineas100Sec = (p, sk) => (p.total_100 || []).filter(l => _keysDeSec(sk).includes(l.grupo))
const total100Sec = (p, sk) => lineas100Sec(p, sk).reduce((s, l) => s + (Number(l.valor_cop) || 0), 0)

// ── Soportes/comprobantes por transacción (archivo en Drive) ──────────────────
const subiendoSoporte = ref(null)   // "grupo|concepto" en curso
const sopKey = (ln) => `${ln.grupo}|${ln.concepto}`
function aplicarSoporte (p, grupo, concepto, soporte) {
  for (const inv of (p.inversionistas || [])) {
    for (const l of (inv.lineas || [])) {
      if (l.grupo === grupo && l.concepto === concepto) l.soporte = soporte
    }
  }
  for (const l of (p.total_100 || [])) {
    if (l.grupo === grupo && l.concepto === concepto) l.soporte = soporte
  }
}
function pickSoporte (p, ln) {
  const input = document.createElement('input')
  input.type = 'file'
  input.onchange = () => { const f = input.files && input.files[0]; if (f) subirSoporte(p, ln, f) }
  input.click()
}
async function subirSoporte (p, ln, file) {
  subiendoSoporte.value = sopKey(ln)
  try {
    const data = await panelContableService.subirSoporte(p.id, { archivo: file, grupo: ln.grupo, concepto: ln.concepto })
    aplicarSoporte(p, ln.grupo, ln.concepto, { archivo_url: data.archivo_url, archivo_nombre: data.archivo_nombre })
  } catch (e) {
    alert('No se pudo subir el soporte: ' + (e?.data?.detail || e.message || e))
  } finally { subiendoSoporte.value = null }
}
async function eliminarSoporte (p, ln) {
  if (!confirm(`¿Quitar el soporte de "${ln.concepto}"? (el archivo queda en Drive)`)) return
  try {
    await panelContableService.eliminarSoporte(p.id, ln.grupo, ln.concepto)
    aplicarSoporte(p, ln.grupo, ln.concepto, null)
  } catch (e) {
    alert('No se pudo quitar el soporte: ' + (e?.data?.detail || e.message || e))
  }
}

// Estado de despliegue por (proyecto, inversionista, sección). Colapsado por defecto.
const invKeyOf = (inv) => inv.proyecto_inversionista_id || inv.nombre
const secOpen = reactive({})
const secKey = (pid, invKey, sk) => `${pid}:${invKey}:${sk}`
const toggleSec = (pid, invKey, sk) => {
  const k = secKey(pid, invKey, sk)
  secOpen[k] = !secOpen[k]
}

function setTab (t) {
  tab.value = t
  if (t === 'diferencia') cargarDiferencia()
  else if (t === 'clasificacion') cargarClasificacion()
  else cargarPaneles()
}
function toggle (id) { open[id] = !open[id] }
function markDirty (p) { dirty[p.id] = true; savedAt[p.id] = false }

async function cargarPaneles () {
  if (tab.value === 'diferencia') return cargarDiferencia()
  if (!periodo.value) { paneles.value = []; return }
  loading.value = true
  cargaError.value = false
  try {
    const data = await panelContableService.listar({ periodo: periodo.value, tipo: tipoDatos.value })
    paneles.value = data.paneles || []
    paneles.value.forEach((p, i) => { if (open[p.id] === undefined) open[p.id] = (i === 0 && esActivo(p)) })
    cargarClasMap()   // para el filtro por tipo de liquidación (no bloquea el render)
    // Consecutivos SOLO en oficial (la preliquidación no lleva). Al cargar el oficial:
    // traer los usados globalmente (para avisar/sugerir) y numerar solo los faltantes.
    if (tipoDatos.value === 'oficial') {
      await cargarConsInfo()
      if (paneles.value.some(p => p.liquidar_ingresos || p.liquidar_costos)) {
        await reasignar(true)
      }
    }
  } catch (e) {
    cargaError.value = true
    paneles.value = []
    toast.error('Error', { description: 'No se pudieron cargar los paneles', duration: 4000 })
  } finally {
    loading.value = false
  }
}

async function cargarClasMap () {
  if (!periodo.value) return
  try {
    const data = await panelContableService.obtenerClasificacion(periodo.value)
    for (const k in clasMap) delete clasMap[k]
    for (const c of (data.proyectos || [])) clasMap[c.proyecto_id] = c.tipo
  } catch { /* el filtro por tipo queda inactivo si falla */ }
}

async function cargarDiferencia () {
  if (!periodo.value) { diff.value = {}; return }
  loading.value = true
  try {
    const data = await panelContableService.obtenerDiferencia(periodo.value)
    diff.value = data
  } catch (e) {
    toast.error('Error', { description: 'No se pudo cargar la diferencia', duration: 4000 })
  } finally {
    loading.value = false
  }
}

async function cargarClasificacion () {
  if (!periodo.value) { clasProyectos.value = []; return }
  clasLoading.value = true
  clasDirty.value = false
  try {
    const data = await panelContableService.obtenerClasificacion(periodo.value)
    clasProyectos.value = (data.proyectos || []).map(p => ({ ...p }))
  } catch (e) {
    toast.error('Error', { description: 'No se pudo cargar la clasificación', duration: 4000 })
  } finally {
    clasLoading.value = false
  }
}

async function guardarClasificacion () {
  if (!periodo.value) return
  clasSaving.value = true
  try {
    await panelContableService.guardarClasificacion({
      periodo: periodo.value,
      asignaciones: clasProyectos.value.map(c => ({ proyecto_id: c.proyecto_id, tipo: c.tipo })),
    })
    clasDirty.value = false
    toast.success('Clasificación guardada', { description: periodoLabel.value, duration: 3000 })
  } catch (e) {
    toast.error('Error', { description: 'No se pudo guardar la clasificación', duration: 4000 })
  } finally {
    clasSaving.value = false
  }
}

// ── Flujo de carga: confirmar período en diálogo → abrir selector de archivos ──
function abrirDialogoPeriodo () {
  // Preseleccionar el período activo si ya hay uno.
  if (periodo.value) {
    const [y, m] = periodo.value.split('-')
    dlgAnio.value = Number(y)
    dlgMes.value = Number(m)
  } else {
    dlgMes.value = null
    dlgAnio.value = null
  }
  // Tipo por defecto = pestaña activa (preliquidacion/oficial), si aplica.
  dlgTipo.value = tab.value === 'oficial' ? 'oficial' : 'preliquidacion'
  showPeriodoDialog.value = true
}

async function confirmarPeriodo () {
  if (!dlgMes.value || !dlgAnio.value || !dlgTipo.value) return
  periodo.value = `${dlgAnio.value}-${String(dlgMes.value).padStart(2, '0')}`
  tipoCarga.value = dlgTipo.value
  tipoCargaConfirm.value = dlgTipoCarga.value
  // Posicionar la pestaña según el tipo elegido para ver lo que se cargará.
  tab.value = dlgTipo.value
  showPeriodoDialog.value = false
  await cargarPaneles()          // refresca la vista al período confirmado
  await nextTick()
  erInput.value?.click()         // recién ahora abre el selector de archivos
}

async function onErSelected (e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  if (!periodo.value) {
    toast.warning('Período requerido', {
      description: 'Selecciona el mes/año antes de cargar ER',
      duration: 4000,
    })
    if (erInput.value) erInput.value.value = ''
    return
  }
  const tipoSubida = tipoCarga.value  // tipo confirmado en el diálogo
  uploading.value = files.length
  uploadMsg.value = ''
  rechazados.value = []
  const fd = new FormData()
  files.forEach(f => fd.append('files', f))
  fd.append('periodo', periodo.value)
  fd.append('tipo', tipoSubida)
  fd.append('tipo_carga', tipoCargaConfirm.value)
  try {
    const data = await panelContableService.cargarEr(fd)
    rechazados.value = data.rechazados || []
    const partes = []
    if (data.cargados?.length) partes.push(`<b>${data.cargados.length}</b> cargados`)
    if (data.sin_match?.length) partes.push(`<span style="color:#c0392b">${data.sin_match.length} sin match: ${data.sin_match.join(', ')}</span>`)
    if (data.rechazados?.length) partes.push(`<span style="color:#d35400">${data.rechazados.length} rechazados por clasificación</span>`)
    if (data.errores?.length) partes.push(`<span style="color:#c0392b">${data.errores.length} con error</span>`)
    uploadMsg.value = partes.join(' · ')
    toast.success('ER procesados', {
      description: `${data.cargados?.length || 0} proyecto(s)`,
      duration: 3500,
    })
    // Tras cargar la OFICIAL, ir a Diferencia y mostrar la comparación al instante.
    if (tipoSubida === 'oficial') {
      tab.value = 'diferencia'
      await cargarDiferencia()
    } else {
      await cargarPaneles()
    }
  } catch (err) {
    toast.error('Error', {
      description: err.data?.detail || 'Fallo al procesar ER',
      duration: 5000,
    })
  } finally {
    uploading.value = 0
    if (erInput.value) erInput.value.value = ''
  }
}

// Aplica un cambio de flags en lote con rollback: si algún PATCH falla, revierte
// SOLO esos paneles a su valor previo y avisa (antes se tragaba el error y la UI
// quedaba desincronizada del backend).
function _aplicarLoteFlags (campos, val, trasReasignar = true) {
  const prev = paneles.value.map(p => ({ p, old: Object.fromEntries(campos.map(c => [c, p[c]])) }))
  paneles.value.forEach(p => campos.forEach(c => { p[c] = val }))
  Promise.all(paneles.value.map(p => {
    const payload = Object.fromEntries(campos.map(c => [c, p[c]]))
    return panelContableService.actualizarPanel(p.id, payload).then(() => null).catch(() => p.id)
  })).then(res => {
    const fallidos = new Set(res.filter(Boolean))
    if (fallidos.size) {
      prev.forEach(({ p, old }) => { if (fallidos.has(p.id)) Object.assign(p, old) })
      toast.warning('Algunos no se guardaron', {
        description: `${fallidos.size} panel(es) revertido(s)`,
        duration: 3500,
      })
    }
    if (trasReasignar) reasignar()
  })
}

function selAll (campo, val) {
  // El usuario decide qué liquidar; 'liquidar_costos' ya no se ata a si el ER trajo
  // costos (pueden faltar este mes o venir luego de la vista de costos).
  _aplicarLoteFlags([campo], val, campo !== 'generar_mandatos')
}

function selNinguno () {
  _aplicarLoteFlags(['liquidar_ingresos', 'liquidar_costos'], false, true)
}

async function onFlag (p) {
  // v-model ya aplicó el cambio en p antes de este handler, así que no tenemos el
  // valor previo para revertir localmente: si el PATCH falla, resincronizamos desde
  // el backend (autoritativo) para que el checkbox refleje lo realmente guardado.
  try {
    await panelContableService.actualizarPanel(p.id, {
      liquidar_ingresos: p.liquidar_ingresos,
      liquidar_costos: p.liquidar_costos,
      generar_mandatos: p.generar_mandatos,
    })
    reasignar()
  } catch (e) {
    toast.error('No se guardó', { description: 'Recargando estado…', duration: 3000 })
    cargarPaneles()
  }
}

// Renumeración completa (desde el valor inicial) — al cambiar el consecutivo inicial.
const reasignarTodo = () => reasignar(false)

// soloFaltantes=true (default): rellena los consecutivos en None preservando los ya
// asignados/editados. false: renumera todo desde el valor inicial.
async function reasignar (soloFaltantes = true) {
  try {
    // La respuesta trae 'asignados' con los consecutivos de cada panel, así que
    // actualizamos en memoria SIN un segundo GET completo (antes: POST + GET =
    // triple round-trip al entrar/cambiar de pestaña).
    const data = await panelContableService.reasignarConsecutivos({
      periodo: periodo.value,
      tipo: tipoDatos.value,
      consecutivo_ingresos_inicial: Number(consIngIni.value) || 0,
      consecutivo_costos_inicial: Number(consCosIni.value) || 0,
      solo_faltantes: soloFaltantes,
    })
    const map = Object.fromEntries((data.asignados || []).map(a => [a.panel_id, a]))
    paneles.value.forEach(p => {
      const fresh = map[p.id]
      if (fresh) { p.consecutivo_ingresos = fresh.consecutivo_ingresos; p.consecutivo_costos = fresh.consecutivo_costos }
    })
  } catch (e) {
    toast.warning('Consecutivos', {
      description: 'No se pudieron reasignar los consecutivos',
      duration: 3500,
    })
  }
}

// Reemplaza un panel en paneles.value con la respuesta del backend,
// preservando el estado de despliegue (open).
function _reemplazarPanel (p, data) {
  const i = paneles.value.findIndex(x => x.id === p.id)
  if (i !== -1) {
    open[data.id] = open[p.id]
    paneles.value[i] = data
  }
}

async function cambiarCelda (p, ln, texto) {
  const m = String(texto).trim().match(/^([^!]+)!\s*([A-Za-z]+\d+)\s*$/)
  if (!m) {
    toast.warning('Formato inválido', { description: 'Usa hoja!celda, ej. Sheet1!H35', duration: 3500 })
    return
  }
  const [, hoja, celda] = m
  try {
    const data = await panelContableService.mapearCelda({
      proyecto_id: p.proyecto_id,
      periodo: periodo.value,
      tipo: tipoDatos.value,
      concepto: ln.concepto,
      hoja: hoja.trim(),
      celda: celda.trim().toUpperCase(),
    })
    _reemplazarPanel(p, data)
    toast.success('Celda actualizada', {
      description: ln.concepto + ' ← ' + hoja + '!' + celda,
      duration: 2500,
    })
  } catch (err) {
    toast.error('Error', {
      description: err.data?.detail || 'No se pudo remapear la celda',
      duration: 4500,
    })
  }
}

// ── Fase 2: gestión de fuentes de ingreso (solo grupo INGRESOS) ──
async function renombrarFuente (p, ln, nuevaEtiqueta) {
  if (!ln.hoja || !ln.celda) {
    toast.warning('Sin celda de origen', {
      description: 'Esta fuente no tiene celda de origen; primero asígnale una',
      duration: 4000,
    })
    return
  }
  nuevaEtiqueta = String(nuevaEtiqueta).trim()
  if (!nuevaEtiqueta || nuevaEtiqueta === ln.concepto) return
  try {
    const data = await panelContableService.renombrarFuente({
      proyecto_id: p.proyecto_id,
      periodo: periodo.value,
      tipo: tab.value,
      columna_origen: ln.origen || (ln.hoja + '!' + ln.celda),
      etiqueta: nuevaEtiqueta,
    })
    _reemplazarPanel(p, data)
    toast.success('Fuente renombrada', { description: nuevaEtiqueta, duration: 2500 })
  } catch (err) {
    toast.error('Error', {
      description: err.data?.detail || 'No se pudo renombrar la fuente',
      duration: 4500,
    })
  }
}

async function agregarFuente (p) {
  const etiqueta = window.prompt('Nombre de la fuente de ingreso (ej. Ingreso Bruto PPA):')
  if (!etiqueta) return
  const cel = window.prompt('Celda de origen (hoja!celda, ej. Sheet1!H35):')
  if (!cel) return
  const m = String(cel).match(/^([^!]+)!\s*([A-Za-z]+\d+)\s*$/)
  if (!m) {
    toast.warning('Formato inválido', { description: 'Usa hoja!celda, ej. Sheet1!H35', duration: 3500 })
    return
  }
  const [, hoja, celda] = m
  try {
    const data = await panelContableService.agregarFuenteIngreso({
      proyecto_id: p.proyecto_id,
      periodo: periodo.value,
      tipo: tab.value,
      etiqueta: String(etiqueta).trim(),
      hoja: hoja.trim(),
      celda: celda.trim().toUpperCase(),
    })
    _reemplazarPanel(p, data)
    toast.success('Fuente agregada', { description: String(etiqueta).trim(), duration: 2500 })
  } catch (err) {
    toast.error('Error', {
      description: err.data?.detail || 'No se pudo agregar la fuente',
      duration: 4500,
    })
  }
}

async function quitarFuente (p, ln) {
  if (!window.confirm('¿Quitar la fuente "' + ln.concepto + '"?')) return
  try {
    const data = await panelContableService.quitarFuenteIngreso({
      proyecto_id: p.proyecto_id,
      periodo: periodo.value,
      tipo: tab.value,
      columna_origen: ln.origen || (ln.hoja + '!' + ln.celda),
    })
    _reemplazarPanel(p, data)
    toast.success('Fuente quitada', { description: ln.concepto, duration: 2500 })
  } catch (err) {
    toast.error('Error', {
      description: err.data?.detail || 'No se pudo quitar la fuente',
      duration: 4500,
    })
  }
}

async function guardar (p) {
  const lineas = []
  p.inversionistas.forEach(inv => inv.lineas.forEach(l => {
    lineas.push({ id: l.id, valor_cop: Number(l.valor_cop) || 0, comprobante_contable: l.comprobante_contable })
  }))
  try {
    await panelContableService.actualizarPanel(p.id, { lineas })
    dirty[p.id] = false
    savedAt[p.id] = true
    toast.success('Guardado', { description: p.proyecto, duration: 2500 })
  } catch (e) {
    toast.error('Error', { description: 'No se pudo guardar', duration: 4000 })
  }
}

// ── Exportar a Excel (tabla plana, formato del Excel maestro "Ajustes") ──────────
// Una fila por (proyecto, inversionista, documento contable, concepto). Referencia
// Factura y Contrato van vacías por ahora (no existen en el modelo aún).
const _DOC_CONTABLE = { ingresos: 'Mandato', comercializacion: 'Mandato', costos: 'Costos', facturas: 'Factura' }
// Documento contable → grupo (para el filtro fBloque) y color de la celda en el Excel.
const _DOC_DE_BLOQUE = { mandato: ['ingresos', 'comercializacion'], costos: ['costos'], factura: ['facturas'] }
const _TINTE_DOC = {
  Mandato: { fill: 'E6F1FB', text: '0C447C' },
  Costos:  { fill: 'FAEEDA', text: '854F0B' },
  Factura: { fill: 'EEEDFE', text: '3C3489' },
}
async function exportarExcel () {
  const XLSX = await import('xlsx-js-style')
  const gruposBloque = fBloque.value ? _DOC_DE_BLOQUE[fBloque.value] : null
  const rows = []
  for (const p of panelesFiltrados.value) {
    for (const inv of (p.inversionistas || [])) {
      if (fInv.value && inv.nombre !== fInv.value) continue
      for (const l of (inv.lineas || [])) {
        if (gruposBloque && !gruposBloque.includes(l.grupo)) continue
        const esMandato = l.grupo === 'ingresos' || l.grupo === 'comercializacion'
        rows.push({
          'Proyecto': p.proyecto,
          'Inversionista': inv.nombre,
          'Documento contable': _DOC_CONTABLE[l.grupo] || l.grupo,
          'Contrato': '',
          'Concepto': l.concepto,
          'Total': Math.round(Number(l.valor_cop) || 0),
          'Referencia Factura': '',
          'Consecutivo': esMandato ? (p.consecutivo_ingresos ?? '')
                       : (l.grupo === 'costos' ? (p.consecutivo_costos ?? '') : ''),
          'Comprobante': l.comprobante_contable || '',
        })
      }
    }
  }
  if (!rows.length) {
    toast.warning('Nada que exportar', {
      description: 'No hay filas con los filtros actuales',
      duration: 3000,
    })
    return
  }
  const headers = ['Proyecto', 'Inversionista', 'Documento contable', 'Contrato', 'Concepto',
                   'Total', 'Referencia Factura', 'Consecutivo', 'Comprobante']
  const aoa = [headers, ...rows.map(r => headers.map(h => r[h]))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  const borde = { style: 'thin', color: { rgb: 'E5E2EC' } }
  const bordes = { top: borde, bottom: borde, left: borde, right: borde }
  headers.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c })
    ws[ref].s = {
      fill: { fgColor: { rgb: '915BD8' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' }, border: bordes,
    }
  })
  rows.forEach((r, i) => {
    const rr = i + 1
    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: rr, c })
      if (!ws[ref]) continue
      ws[ref].s = { border: bordes, alignment: { vertical: 'center' } }
    }
    const tinte = _TINTE_DOC[r['Documento contable']]
    if (tinte) {
      const ref = XLSX.utils.encode_cell({ r: rr, c: 2 })
      ws[ref].s = { ...ws[ref].s, fill: { fgColor: { rgb: tinte.fill } }, font: { color: { rgb: tinte.text }, bold: true } }
    }
    const tref = XLSX.utils.encode_cell({ r: rr, c: 5 })
    ws[tref].s = { ...ws[tref].s, alignment: { horizontal: 'right' }, font: { color: { rgb: r.Total < 0 ? 'C0392B' : '2C2039' } } }
    ws[tref].z = '#,##0'
  })
  ws['!cols'] = [{ wch: 26 }, { wch: 26 }, { wch: 18 }, { wch: 12 }, { wch: 24 },
                 { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 22 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Panel')
  const mes = (periodoLabel.value || periodo.value || 'periodo').replace(/\s+/g, '_')
  XLSX.writeFile(wb, `Panel_${mes}_${tipoDatos.value}.xlsx`)
  toast.success('Excel exportado', { description: `${rows.length} filas`, duration: 2500 })
}

onMounted(cargarPaneles)
</script>

<style scoped>
.pc-wrap {
  --p1:var(--color-unergy-deep); --p2:var(--color-unergy-purple); --yl:var(--color-unergy-yellow); --bg:var(--color-unergy-avena);
  --txt:var(--color-unergy-deep); --txt2:#6b6478; --txt3:#9a93a8; --line:#ece7f2; --line2:#ddd6e8;
  --red:#c0392b; --green:#1e8449; --sec:#f5f2fa; --info:#eee7fb;
  background: var(--bg); color: var(--txt); padding: 24px; font-size: 13px; line-height: 1.4;
  min-height: 100%;
}
.hidden { display: none; }
.pc-top { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:18px; }
.pc-top h1 { font-size:20px; font-weight:600; color:var(--p1); }
.pc-top .sub { font-size:13px; color:var(--txt2); margin-top:2px; }
.periodo-chip { display:inline-block; background:var(--info); color:var(--p2); font-weight:600; padding:2px 9px; border-radius:7px; }
.top-actions { display:flex; gap:10px; align-items:flex-end; }
.req { color:var(--p2); }
.pc-period { display:inline-flex; align-items:center; gap:6px; }
.pc-period-btn { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; border:1px solid #ddd6e8; background:#fff; color:var(--color-unergy-purple); cursor:pointer; transition:background .12s; }
.pc-period-btn:hover:not(:disabled) { background:#f5f2fa; }
.pc-period-btn:disabled { opacity:.4; cursor:not-allowed; }
.pc-period-label { font-size:13px; font-weight:700; color:var(--p1); min-width:104px; text-align:center; }
/* Colores de marca en hex literal: estos botones también se usan dentro del
   Dialog de PrimeVue, que se teletransporta a <body> fuera de .pc-wrap donde
   las variables --p2/--line2/--sec no existen (por eso salían en blanco). */
.btn { background:var(--color-unergy-purple); color:#fff; border:none; padding:9px 16px; border-radius:9px; font-size:13px; cursor:pointer; font-weight:500; }
.btn:hover:not(:disabled) { filter:brightness(1.07); }
.btn:disabled { opacity:.5; cursor:default; background:var(--color-unergy-purple); color:#fff; }
.btn-o { background:#fff; color:var(--color-unergy-purple); border:1px solid #ddd6e8; padding:9px 16px; border-radius:9px; font-size:13px; cursor:pointer; font-weight:500; }
.btn-o:hover:not(:disabled) { background:#f5f2fa; }
.btn-o:disabled { opacity:.5; cursor:default; background:#fff; color:var(--color-unergy-purple); }

.tabs { display:flex; gap:4px; margin-bottom:18px; border-bottom:1px solid var(--line2); }
.tab { padding:9px 18px; font-size:13px; cursor:pointer; color:var(--txt2); border-bottom:2px solid transparent; margin-bottom:-1px; }
.tab.act { color:var(--p1); border-bottom-color:var(--p2); font-weight:600; }

.banner { background:var(--info); color:var(--p1); padding:10px 14px; border-radius:9px; margin-bottom:14px; font-size:12.5px; }
.banner-info { background:#faf8fd; border:1px solid var(--line); }
.banner-rechazo { background:#fff4e8; border:1px solid #f5cda0; color:#8a4b00; }
.rechazo-h { display:flex; align-items:center; gap:8px; }
.rechazo-h svg { color:#d35400; }
.rechazo-list { margin:8px 0 0 26px; padding:0; list-style:disc; }
.rechazo-list li { margin:2px 0; }
.banner-aviso { display:flex; align-items:flex-start; gap:8px; background:#faf8fd; border-bottom:1px solid var(--line);
  padding:10px 18px; font-size:12px; color:var(--txt2); }
.banner-aviso svg { color:var(--p2); margin-top:1px; }

.card { background:#fff; border:1px solid var(--line); border-radius:12px; margin-bottom:16px; overflow:hidden; }
.card-h { padding:13px 18px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
.card-h h3 { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--p2); font-weight:600; }
.pool-actions { display:flex; gap:8px; flex-wrap:wrap; }
.mini { font-size:12px; padding:5px 11px; border-radius:7px; border:1px solid #ddd6e8; background:#fff; color:#6b6478; cursor:pointer; }
.mini:hover { background:#f5f2fa; }

.empty { padding:30px; text-align:center; color:var(--txt3); font-size:13px; }
.empty.sm { padding:18px; }

.ptbl { width:100%; border-collapse:collapse; font-size:13px; }
.ptbl th { font-weight:500; color:var(--txt2); padding:8px 14px; text-align:center; border-bottom:1px solid var(--line); background:#faf8fd; }
.ptbl th.l { text-align:left; }
.ptbl td { padding:7px 14px; text-align:center; border-bottom:1px solid var(--line); }
.ptbl td.l { text-align:left; }
.ptbl tr:hover { background:var(--sec); }
.ptbl tr:last-child td { border-bottom:none; }
.pname { font-weight:500; color:var(--p1); }
.pmeta { font-size:11px; color:var(--txt3); }
.pill { font-size:10px; padding:2px 7px; border-radius:6px; font-weight:500; margin-left:6px; white-space:nowrap; }
.pill-warn { background:#fdf6d8; color:#8a6d00; }
.pill-bolsa { background:var(--info); color:var(--p2); }
.pill-gen { background:#e3f5e9; color:var(--green); }
.pill-off { background:var(--line); color:var(--txt3); }
.chk { width:17px; height:17px; accent-color:var(--p2); cursor:pointer; }
.gen-chk { width:17px; height:17px; accent-color:var(--green); cursor:pointer; }

.cons-pool { display:flex; gap:18px; align-items:flex-end; flex-wrap:wrap; padding:13px 18px; background:#faf8fd; border-top:1px solid var(--line); }
.fld label { font-size:11px; color:var(--txt2); display:block; margin-bottom:4px; }
.fld input { font-size:13px; padding:6px 9px; border:1px solid var(--line2); border-radius:7px; width:130px; }
.cons-warn { display:block; font-size:11px; color:#D64455; margin-top:4px; }
.cons-warn .mini { padding:2px 7px; font-size:11px; margin-left:4px; }
.hint { font-size:12px; color:var(--txt3); max-width:320px; align-self:center; }
.summary { font-size:12px; color:var(--txt2); align-self:center; margin-left:auto; }
.summary b { color:var(--p1); }

.sec-title { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--txt2); font-weight:600; margin:18px 0 10px; }
.sec-title-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin:18px 0 10px; }
.sec-title-row .sec-title { margin:0; }
.vista-toggle { display:inline-flex; align-items:center; gap:8px; font-size:12px; color:var(--txt2); }
.vista-toggle > span { font-weight:500; }
.vista-toggle .vt-opt { display:inline-flex; align-items:center; gap:5px; font-size:12px; padding:5px 12px;
  border:1px solid var(--line2); border-radius:8px; cursor:pointer; color:var(--txt2); background:#fff; transition:all .12s; }
.vista-toggle .vt-opt.on { border-color:var(--color-unergy-purple); background:#eee7fb; color:var(--color-unergy-deep); font-weight:600; }
.vista-toggle .vt-opt input { accent-color:var(--color-unergy-purple); cursor:pointer; }

/* Tabla plana del detalle (vista por defecto) */
.dt.flat { width:100%; border-collapse:collapse; font-size:13px; }
.dt.flat th { text-align:right; padding:8px 14px; font-weight:500; color:var(--txt2); border-bottom:0.5px solid var(--line); background:var(--sec); }
.dt.flat th.l { text-align:left; }
.dt.flat td { padding:8px 14px; text-align:right; border-bottom:0.5px solid var(--line); font-variant-numeric:tabular-nums; }
.dt.flat td.l { text-align:left; }
.dt.flat tr.derivada td { color:var(--txt2); font-size:12px; }
.dt.flat td.neg, .dt.flat .neg { color:var(--red); }
.blk-h td { background:var(--info); color:var(--p2); font-weight:600; font-size:11px; letter-spacing:.04em;
  text-transform:uppercase; padding:6px 14px !important; text-align:left !important; }
.blk-tot td { background:#fbfaff; font-weight:500; }
.blk-res td { background:var(--sec); font-weight:600; color:var(--p1); border-top:2px solid var(--p2); }
.expand-inv { display:inline-flex; align-items:center; gap:7px; margin:12px 0 4px; background:none; border:none;
  color:var(--p2); font-size:12px; font-weight:500; cursor:pointer; padding:4px 0; }
.expand-inv .chev { font-size:9px; color:var(--txt3); transition:transform .12s; }
.expand-inv .chev.op { transform:rotate(90deg); }

/* Barra de filtros de la lista de proyectos */
.filtros { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
.filtro-busca { position:relative; flex:1; min-width:220px; display:inline-flex; align-items:center; }
.filtro-busca svg { position:absolute; left:11px; color:var(--txt3); font-size:13px; }
.filtro-busca input { width:100%; padding:8px 10px 8px 32px; border:1px solid var(--line2); border-radius:9px;
  font-size:13px; color:var(--p1); background:#fff; }
.filtro-sel { padding:8px 10px; border:1px solid var(--line2); border-radius:9px; font-size:13px; color:var(--p1);
  background:#fff; cursor:pointer; }
.filtro-busca input:focus, .filtro-sel:focus { outline:none; border-color:var(--color-unergy-purple); }
.filtro-count { font-size:12px; color:var(--txt3); }

/* Switch preliq/oficial dentro de la pestaña Selección (reusa el look de vt-opt). */
.sel-tipo { display:inline-flex; align-items:center; gap:8px; font-size:12px; color:var(--txt2); }
.sel-tipo .vt-opt { display:inline-flex; align-items:center; gap:5px; font-size:12px; padding:5px 12px;
  border:1px solid var(--line2); border-radius:8px; cursor:pointer; color:var(--txt2); background:#fff; }
.sel-tipo .vt-opt.on { border-color:var(--color-unergy-purple); background:#eee7fb; color:var(--color-unergy-deep); font-weight:600; }
.sel-tipo .vt-opt input { accent-color:var(--color-unergy-purple); cursor:pointer; }

/* Mapeo de celdas por proyecto (pestaña Selección) */
.mapeo-proy { border-top:1px solid var(--line); }
.mapeo-h { display:flex; align-items:center; gap:8px; padding:10px 18px; cursor:pointer; user-select:none; }
.mapeo-h:hover { background:var(--sec); }
.mapeo-h .chev { font-size:9px; color:var(--txt3); transition:transform .12s; }
.mapeo-h .chev.op { transform:rotate(90deg); }

.origen-wrap { margin-top:3px; }
.origen-link { display:inline-block; background:none; border:none; padding:0; font-size:10px; color:#9a93a8;
  cursor:pointer; text-align:left; font-variant-numeric:tabular-nums; }
.origen-link:hover { color:var(--color-unergy-purple); }
.proj { background:#fff; border:1px solid var(--line); border-radius:12px; margin-bottom:10px; overflow:hidden; transition:opacity .2s; }
.proj.off { opacity:.45; }
.phead { display:flex; align-items:center; gap:12px; padding:12px 16px; cursor:pointer; flex-wrap:wrap; }
.phead:hover { background:var(--sec); }
.chev { color:var(--txt3); transition:transform .2s; font-size:12px; }
.proj.open .chev { transform:rotate(90deg); }
.pn { font-size:14px; font-weight:600; color:var(--p1); flex:1; min-width:150px; }
.pcons { font-size:11px; color:var(--txt2); font-variant-numeric:tabular-nums; display:flex; gap:12px; }
.pcons b { color:var(--p1); font-weight:600; }
.body { border-top:1px solid var(--line); }
.inv-block { border-bottom:1px solid var(--line); }
.inv-head { display:flex; align-items:center; gap:10px; padding:8px 16px; background:var(--sec); }
.inv-name { font-size:12px; font-weight:600; flex:1; color:var(--p1); }
.inv-cons { font-size:11px; color:var(--txt2); font-variant-numeric:tabular-nums; display:flex; gap:10px; }
.inv-cons b { color:var(--p1); }
/* Acordeones de sección dentro del detalle por proyecto */
.secs { padding:4px 0; }
.sec-acc { border-bottom:1px solid var(--line); }
.sec-acc:last-of-type { border-bottom:1px solid var(--line); }
.sec-bar { display:flex; align-items:center; gap:10px; padding:10px 16px; cursor:pointer; transition:background .15s ease; }
.sec-bar:hover { background:var(--sec); }
.sec-acc.open .sec-bar { background:var(--sec); }
.sec-acc .chev { color:var(--txt3); transition:transform .2s ease; font-size:11px; }
.sec-acc.open .chev { transform:rotate(90deg); }
.sec-lbl { flex:1; font-size:11.5px; font-weight:600; letter-spacing:.03em; color:var(--p1); text-transform:uppercase; }
.sec-tot { font-weight:700; font-size:13px; color:var(--p1); font-variant-numeric:tabular-nums; }
.sec-tot.neg { color:var(--red); }
.sec-body { background:#fff; border-top:1px solid var(--line); animation:secReveal .18s ease; }
@keyframes secReveal { from { opacity:0; transform:translateY(-3px); } to { opacity:1; transform:none; } }
.sec-resultado { display:flex; align-items:center; gap:10px; padding:12px 16px;
  background:#eee7fb; border-top:1px solid var(--line2); }
.sec-resultado .sec-lbl { color:var(--p2); }
.sec-resultado .sec-tot { color:var(--p2); font-size:14px; }
.sec-resultado .sec-tot.neg { color:var(--red); }
.sec-subtotal { display:flex; align-items:center; gap:10px; padding:6px 16px;
  background:var(--sec); border-bottom:1px dashed var(--line2); }
.sec-subtotal .sec-lbl { flex:1; font-size:11px; font-weight:600; color:var(--txt2); text-transform:none; letter-spacing:normal; font-style:italic; }
.sec-subtotal .sec-tot { font-size:12.5px; color:var(--txt2); font-weight:700; font-variant-numeric:tabular-nums; }
.sec-subtotal .sec-tot.neg { color:var(--red); }
.tbl-wrap { overflow-x:auto; }
table.dt { width:100%; border-collapse:collapse; font-size:12.5px; min-width:640px; }
table.dt th { font-weight:500; color:var(--txt2); padding:6px 12px; text-align:right; border-bottom:1px solid var(--line); white-space:nowrap; }
table.dt th:first-child, table.dt th.l { text-align:left; }
table.dt td { padding:5px 12px; text-align:right; font-variant-numeric:tabular-nums; border-bottom:1px solid var(--line); }
table.dt td:first-child, table.dt td.l { text-align:left; color:var(--txt2); }
tr.grp td { font-weight:600; font-size:11px; letter-spacing:.03em; color:var(--p1); padding-top:9px; background:#faf8fd; border-top:1px solid var(--line2); }
tr.tot td { background:var(--sec); font-weight:600; }
.neg { color:var(--red); }
.pos { color:var(--green); }
.val-in { width:130px; font-size:12.5px; padding:3px 6px; border:1px solid transparent; border-radius:5px; text-align:right; font-variant-numeric:tabular-nums; background:transparent; }
.val-in:hover { border-color:var(--line2); }
.val-in:focus { outline:none; background:var(--info); border-color:var(--p2); }
.comp-in { width:100px; font-size:11px; padding:3px 6px; border:1px solid var(--line2); border-radius:5px; text-align:left; }
.sop-up { background:transparent; border:1px dashed #ddd6e8; color:var(--color-unergy-purple); font-size:11px;
  padding:3px 8px; border-radius:6px; cursor:pointer; white-space:nowrap; }
.sop-up:hover { background:#f5f2fa; }
.sop-up:disabled { opacity:.5; cursor:default; }
.sop-link { color:#2C7a3f; font-size:11px; font-weight:600; text-decoration:none; white-space:nowrap; }
.sop-link:hover { text-decoration:underline; }
.sop-x { background:none; border:none; color:#9a93a8; font-size:11px; cursor:pointer; margin-left:4px; }
.sop-x:hover { color:#c0392b; }
tr.derivada { background:#faf8fe; }
tr.derivada .cpt, tr.derivada td { color:#8a7fa6; font-style:italic; }
.val-ro { font-size:11px; font-variant-numeric:tabular-nums; color:#8a7fa6; }
.val-ro.neg { color:#c0392b; }
.imp-tag { margin-left:6px; font-size:9px; font-style:normal; text-transform:uppercase; letter-spacing:.03em;
  background:#efe7fb; color:#7a5bbf; padding:1px 5px; border-radius:4px; vertical-align:middle; }
/* Costo que viene de un módulo (O&M / Arriendos), no del ER. */
.fuente-tag { margin-left:6px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.03em;
  background:#e6f6ef; color:#1f7a56; padding:1px 5px; border-radius:4px; vertical-align:middle; }
.origen-mod { display:inline-block; margin-top:3px; font-size:10px; color:#1f9d6b; }
.celda-origen { display:block; width:95px; margin-top:3px; font-size:10.5px; color:#9a93a8;
  padding:2px 5px; border:1px solid #ddd6e8; border-radius:5px; text-align:left;
  font-variant-numeric:tabular-nums; background:transparent; }
.celda-origen::placeholder { color:#bcb5c9; }
.celda-origen:focus { outline:none; border-color:var(--color-unergy-purple); color:var(--color-unergy-deep); }

/* Fase 2: edición de fuentes de ingreso */
.fuente-row { display:flex; align-items:center; gap:2px; }
.fuente-et { font-size:12.5px; color:var(--color-unergy-deep); width:200px; max-width:100%;
  padding:2px 5px; border:1px solid transparent; border-radius:5px; background:transparent; }
.fuente-et:hover { border-color:#ddd6e8; }
.fuente-et:focus { outline:none; border-color:var(--color-unergy-purple); background:#fff; }
.fuente-x { background:none; border:none; color:#9a93a8; font-size:11px; cursor:pointer;
  margin-left:6px; padding:0 4px; line-height:1; }
.fuente-x:hover { color:#c0392b; }
.fuente-add { background:transparent; border:1px dashed #ddd6e8; color:var(--color-unergy-purple); font-size:12px;
  padding:4px 10px; border-radius:6px; cursor:pointer; }
.fuente-add:hover { background:#f5f2fa; }
.proj-foot { display:flex; align-items:center; gap:12px; padding:12px 16px; }
.saved { font-size:12px; color:var(--green); }

.cards-resumen { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px; }
.rc { background:#fff; border:1px solid var(--line); border-radius:12px; padding:16px 18px; }
.rc-lbl { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--txt2); margin-bottom:6px; }
.rc-val { font-size:20px; font-weight:600; color:var(--p1); font-variant-numeric:tabular-nums; }

.diff-proy { margin-bottom:26px; }
.diff-proy-h { font-size:15px; font-weight:600; color:var(--p1); margin-bottom:10px; }
.diff-dt th { text-align:right; }
.diff-dt th.l { text-align:left; }
.arrow { font-size:10px; }

/* Diálogo de período */
.dlg-title { font-size:15px; font-weight:600; color:var(--p1); }
.dlg-hint { font-size:12.5px; color:var(--txt2); margin-bottom:14px; line-height:1.45; }
.dlg-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.dlg-select { width:100%; font-size:13px; padding:8px 10px; border:1px solid var(--line2);
  border-radius:8px; color:var(--p1); background:#fff; cursor:pointer; }
.dlg-select:focus { outline:none; border-color:var(--p2); }
.tipo-opts { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.tipo-opts.tres { grid-template-columns:1fr 1fr 1fr; }
.dlg-aviso { font-size:11.5px; color:var(--txt2); margin-top:10px; line-height:1.4;
  background:#faf8fd; border:1px solid var(--line); border-radius:8px; padding:8px 10px; }
.dlg-aviso b { color:var(--p2); }
.search-in { font-size:13px; padding:7px 11px; border:1px solid #ddd6e8; border-radius:8px; color:var(--color-unergy-deep); min-width:200px; }
.search-in:focus { outline:none; border-color:var(--color-unergy-purple); }
/* Selector segmentado de tipo de liquidación */
.seg { display:inline-flex; border:1px solid var(--line2); border-radius:8px; overflow:hidden; }
.seg label { display:flex; align-items:center; gap:5px; font-size:12px; padding:5px 12px; cursor:pointer;
  color:var(--txt2); border-right:1px solid var(--line2); transition:all .12s; }
.seg label:last-child { border-right:none; }
.seg label.on { background:var(--p2); color:#fff; font-weight:600; }
.seg label input { display:none; }
.tipo-opt { display:flex; align-items:center; gap:8px; padding:9px 11px; border:1px solid #ddd6e8;
  border-radius:8px; background:#fff; cursor:pointer; transition:all .15s; }
.tipo-opt.on { border-color:var(--color-unergy-purple); background:#eee7fb; }
.tipo-opt input { accent-color:var(--color-unergy-purple); cursor:pointer; }
.tipo-opt span { display:flex; flex-direction:column; line-height:1.2; }
.tipo-opt b { font-size:12.5px; color:var(--color-unergy-deep); font-weight:600; }
.tipo-opt small { font-size:10.5px; color:#6b6478; }
:deep(.pc-dialog) { border:1px solid var(--line); border-radius:14px; overflow:hidden; }
:deep(.pc-dialog .p-dialog-header) { background:#faf8fd; border-bottom:1px solid var(--line); padding:14px 18px; }
:deep(.pc-dialog .p-dialog-content) { padding:18px; background:var(--bg); }
:deep(.pc-dialog .p-dialog-footer) { display:flex; justify-content:flex-end; gap:8px;
  padding:14px 18px; border-top:1px solid var(--line); background:#faf8fd; }
.pill-api { background: #EAF7EF; color: #1D6F42; }
.pill-er  { background: #F3F0F8; color: #6B6280; }
.btn-er { background: none; border: 1px solid #E4DCF2; border-radius: 7px; cursor: pointer;
  color: #6E3FB8; font-size: 10.5px; font-weight: 700; padding: 2px 8px; margin-left: 8px; }
.btn-er:hover { background: #F6F1FC; }

/* ── Armar desde API y contrastar ─────────────────────────────────────────── */
.solo-neu { font-size: 9px; background: #EEE9F6; color: #6E3FB8; padding: 1px 5px;
  border-radius: 6px; margin-left: 5px; font-weight: 700; letter-spacing: .02em; }

.pc-aviso { border: 1px solid #E4DCF2; background: #FBF9FE; border-radius: 12px;
  padding: 12px 14px; margin: 0 0 14px; font-size: 12.5px; color: #3B3050; }
.pc-aviso--ok { border-color: #CDEBD8; background: #F5FCF8; }
.pc-aviso-cab { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.pc-aviso-x { margin-left: auto; background: none; border: none; cursor: pointer;
  color: #9B8FB0; padding: 2px 4px; }
.pc-aviso-x:hover { color: #3B3050; }
.pc-aviso-linea { margin-top: 8px; line-height: 1.7; }
.pc-aviso-linea--warn { color: #7A5C00; }
.pc-aviso-detalle { font-size: 11.5px; margin-left: 10px; opacity: .9; }
.pc-tag { background: #fff; border: 1px solid #E4DCF2; border-radius: 7px;
  padding: 1px 7px; margin-right: 5px; white-space: nowrap; }
.pc-tag em { font-style: normal; color: #6E3FB8; font-weight: 700; text-transform: uppercase;
  font-size: 10px; margin-left: 3px; }

.pc-contraste-proy { margin-top: 10px; }
.pc-contraste-nombre { font-weight: 600; margin-bottom: 3px; }
.pc-contraste-tabla { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.pc-contraste-tabla td { padding: 3px 8px; border-top: 1px solid #EFEAF7; }
.pc-contraste-tabla .num { text-align: right; font-variant-numeric: tabular-nums; }
.pc-contraste-tabla .neg { color: #C0392B; }
.pc-contraste-tabla .pos { color: #1D6F42; }
</style>
