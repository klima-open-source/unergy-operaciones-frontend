<script setup lang="ts">
import { ConfigProvider } from 'reka-ui'
import { APP_BRANDING } from '~/config/app'

// Fallback title/description: a page with its own `useHead` overrides this.
useHead({
  title: APP_BRANDING.seo.title,
  link: [{ rel: 'icon', href: APP_BRANDING.favicon }],
  meta: [
    { name: 'description', content: APP_BRANDING.seo.description },
    { property: 'og:title', content: APP_BRANDING.seo.title },
    { property: 'og:description', content: APP_BRANDING.seo.description },
  ],
})
</script>

<template>
  <!-- Idioma de los componentes de Reka (NumberField, Calendar…) en toda la app.
       Sin esto usan inglés: los pesos salían "COP 48,000,000" y el decimal era el
       punto. Con es-CO se ven "$ 48.000.000" y el decimal se escribe con coma. -->
  <ConfigProvider locale="es-CO">
  <div>
    <NuxtRouteAnnouncer />

    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
    >
      Skip to main content
    </a>

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- `position` y `rich-colors` reproducen el Toast de PrimeVue que había aquí:
         arriba a la derecha y con color por severidad. -->
    <Toaster position="top-right" rich-colors close-button />

    <!-- Un solo diálogo para toda la app: `useConfirm()` lo abre desde
         cualquier componente. Ver ~/composables/useConfirm.ts. -->
    <ConfirmDialog />
  </div>
  </ConfigProvider>
</template>
