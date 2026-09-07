<template>
  <section class="fa-section">
    <header class="fa-section-head">
      <PaperclipIcon class="fa-section-icon size-[1em]" />
      <h3 class="fa-section-title">Archivos adjuntos</h3>
      <span class="fa-section-count">{{ archivos.length }}</span>
    </header>

    <!-- Estado: backend no disponible -->
    <div v-if="noDisponible" class="fa-unavailable">
      <InfoIcon class="fa-unavailable-icon size-[1em]" />
      <span>Archivos no disponibles</span>
    </div>

    <template v-else>
      <!-- Zona de carga -->
      <div
        class="fa-dropzone"
        :class="{ 'fa-dropzone--over': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
        @click="triggerFileInput"
      >
        <UploadIcon class="fa-dropzone-icon size-[1em]" />
        <p class="fa-dropzone-text">Arrastra archivos aquí o <span class="fa-dropzone-link">haz clic para seleccionar</span></p>
        <p class="fa-dropzone-hint">Imágenes, PDF, Excel, Word, CSV</p>
        <input
          ref="fileInputRef"
          type="file"
          class="fa-hidden-input"
          accept="*"
          multiple
          @change="onFileInputChange"
        />
      </div>

      <!-- Barra de progreso durante carga -->
      <div v-if="uploading" class="fa-progress-wrap">
        <div class="fa-progress-bar" :style="{ width: uploadProgress + '%' }" />
      </div>

      <!-- Lista de archivos -->
      <div v-if="archivos.length" class="fa-list">
        <div
          v-for="archivo in archivos"
          :key="archivo.id"
          class="fa-row"
        >
          <!-- Thumbnail / Icono -->
          <div class="fa-thumb-wrap">
            <a v-if="estaImagen(archivo)" :href="archivo.url" target="_blank" rel="noopener noreferrer">
              <img :src="archivo.url" :alt="archivo.nombre" class="fa-thumb-img" />
            </a>
            <div v-else class="fa-thumb-icon-wrap">
              <component :is="iconoArchivo(archivo)" class="fa-thumb-icon size-[1em]" />
            </div>
          </div>

          <!-- Info -->
          <div class="fa-row-info">
            <p class="fa-row-name" :title="archivo.nombre">{{ archivo.nombre }}</p>
            <p class="fa-row-meta">
              <span>{{ formatSize(archivo.tamaño) }}</span>
              <span class="fa-meta-sep">·</span>
              <span>{{ formatDate(archivo.created_at) }}</span>
            </p>
          </div>

          <!-- Acciones -->
          <div class="fa-row-actions">
            <a :href="archivo.url" target="_blank" rel="noopener noreferrer" class="fa-action-btn fa-action-btn--download" title="Descargar">
              <DownloadIcon class="size-[1em]" />
            </a>
            <button class="fa-action-btn fa-action-btn--delete" title="Eliminar" @click="eliminarArchivo(archivo)">
              <Trash2Icon class="size-[1em]" />
            </button>
          </div>
        </div>
      </div>

      <p v-else class="fa-empty">Sin archivos adjuntos</p>
    </template>
  </section>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { FallasService } from '~/features/fallas/services/fallas'
import { DownloadIcon, FileIcon, FileSpreadsheetIcon, FileTextIcon, FileTypeIcon, InfoIcon, PaperclipIcon, Trash2Icon, UploadIcon } from '@lucide/vue'

const fallasService = new FallasService()

// ── Props ────────────────────────────────────────────────────────────────────
const props = defineProps({
  fallaId: {
    type: [Number, String],
    required: true,
  },
})

// ── State ────────────────────────────────────────────────────────────────────
const archivos      = ref([])
const noDisponible  = ref(false)
const isDragging    = ref(false)
const uploading     = ref(false)
const uploadProgress = ref(0)
const fileInputRef  = ref(null)

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes == null || isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function estaImagen(archivo) {
  return archivo.tipo_mime?.startsWith('image/')
}

function iconoArchivo(archivo) {
  const mime = archivo.tipo_mime || ''
  if (mime === 'application/pdf') return FileTextIcon
  if (mime.includes('excel') || mime.includes('spreadsheet') ||
      /\.(xls|xlsx|csv)$/i.test(archivo.nombre || '')) return FileSpreadsheetIcon
  if (mime.includes('word') || mime.includes('document') ||
      /\.(doc|docx)$/i.test(archivo.nombre || '')) return FileTypeIcon
  return FileIcon
}

// ── API ──────────────────────────────────────────────────────────────────────
async function cargarArchivos() {
  if (!props.fallaId) return
  noDisponible.value = false
  try {
    archivos.value = await fallasService.listarArchivos(props.fallaId)
  } catch (err) {
    const status = err.status
    if (!status || status === 404 || status === 0) {
      noDisponible.value = true
    } else {
      // Endpoint existe pero falló por otra razón — mostrar vacío, no bloquear
      archivos.value = []
    }
  }
}

function subirArchivo(file) {
  return fallasService.subirArchivo(props.fallaId, file, (porcentaje) => {
    uploadProgress.value = porcentaje
  })
}

async function procesarArchivos(files) {
  if (!files.length) return
  uploading.value = true
  uploadProgress.value = 0
  let exitosos = 0

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const nuevo = await subirArchivo(file)
      archivos.value.push(nuevo)
      exitosos++
    } catch {
      toast.warning('No se pudo subir', { description: file.name, duration: 3500 })
    }
    // Progreso global entre archivos múltiples
    uploadProgress.value = Math.round(((i + 1) / files.length) * 100)
  }

  uploading.value = false
  uploadProgress.value = 0

  if (exitosos > 0) {
    toast.success(exitosos === 1 ? 'Archivo subido' : `${exitosos} archivos subidos`, { duration: 2500 })
  }
}

async function eliminarArchivo(archivo) {
  if (!window.confirm(`¿Deseas eliminar "${archivo.nombre}"?`)) return
  try {
    await fallasService.eliminarArchivo(props.fallaId, archivo.id)
    archivos.value = archivos.value.filter((a) => a.id !== archivo.id)
    toast.success('Archivo eliminado', { duration: 2000 })
  } catch {
    toast.error('No se pudo eliminar el archivo', { duration: 3000 })
  }
}

// ── Interacción con la zona de carga ─────────────────────────────────────────
function triggerFileInput() {
  fileInputRef.value?.click()
}

function onFileInputChange(event) {
  const files = Array.from(event.target.files || [])
  procesarArchivos(files)
  event.target.value = ''
}

function onDrop(event) {
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  procesarArchivos(files)
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(cargarArchivos)

watch(() => props.fallaId, (nuevo) => {
  if (nuevo) {
    archivos.value = []
    cargarArchivos()
  }
})
</script>

<style scoped>
/* ── Sección principal ── */
.fa-section {
  background: #fafaf9;
  border: 1px solid #ece8f4;
  border-radius: 12px;
  padding: 16px;
}

.fa-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.fa-section-icon {
  color: var(--color-unergy-purple);
  font-size: 13px;
}

.fa-section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-unergy-deep);
  margin: 0;
}

.fa-section-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-unergy-purple);
  background: #f0eaf8;
  border-radius: 999px;
  padding: 1px 8px;
}

/* ── Estado no disponible ── */
.fa-unavailable {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  background: #f9f6fe;
  color: #9b89b5;
  font-size: 13px;
}

.fa-unavailable-icon {
  color: #c4b5e0;
  font-size: 15px;
}

/* ── Zona de arrastre ── */
.fa-dropzone {
  border: 2px dashed #d4c8e8;
  border-radius: 10px;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
  margin-bottom: 14px;
  text-align: center;
}

.fa-dropzone:hover,
.fa-dropzone--over {
  border-color: var(--color-unergy-purple);
  background: rgba(145, 91, 216, 0.05);
}

.fa-dropzone-icon {
  font-size: 22px;
  color: #c4b5e0;
  margin-bottom: 4px;
}

.fa-dropzone--over .fa-dropzone-icon {
  color: var(--color-unergy-purple);
}

.fa-dropzone-text {
  font-size: 13px;
  color: #6b5f82;
  margin: 0;
}

.fa-dropzone-link {
  color: var(--color-unergy-purple);
  font-weight: 600;
}

.fa-dropzone-hint {
  font-size: 11px;
  color: #b0a0c8;
  margin: 0;
}

.fa-hidden-input {
  display: none;
}

/* ── Barra de progreso ── */
.fa-progress-wrap {
  height: 3px;
  background: #ece8f4;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 14px;
}

.fa-progress-bar {
  height: 100%;
  background: var(--color-unergy-purple);
  border-radius: 999px;
  transition: width 0.2s ease;
}

/* ── Lista de archivos ── */
.fa-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fa-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  transition: background 0.15s ease;
}

.fa-row:hover {
  background: #f4f0fb;
}

/* Thumbnail */
.fa-thumb-wrap {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
}

.fa-thumb-img {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e8e0f0;
  display: block;
  transition: opacity 0.15s ease;
}

.fa-thumb-img:hover {
  opacity: 0.85;
}

.fa-thumb-icon-wrap {
  width: 40px;
  height: 40px;
  background: #f0eaf8;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fa-thumb-icon {
  font-size: 18px;
  color: var(--color-unergy-purple);
}

/* Info de fila */
.fa-row-info {
  flex: 1;
  min-width: 0;
}

.fa-row-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-unergy-deep);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0 0 2px;
}

.fa-row-meta {
  font-size: 11px;
  color: #9b89b5;
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
}

.fa-meta-sep {
  color: #d4c8e8;
}

/* Acciones de fila */
.fa-row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.fa-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s ease, color 0.15s ease;
  text-decoration: none;
}

.fa-action-btn--download {
  background: #f0eaf8;
  color: var(--color-unergy-purple);
}

.fa-action-btn--download:hover {
  background: #e4d8f5;
  color: #7a48c2;
}

.fa-action-btn--delete {
  background: #fef2f2;
  color: #ef4444;
}

.fa-action-btn--delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* ── Sin archivos ── */
.fa-empty {
  font-size: 12px;
  color: #9b89b5;
  text-align: center;
  padding: 16px 0 4px;
  margin: 0;
}
</style>
