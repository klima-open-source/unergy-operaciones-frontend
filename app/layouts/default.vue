<script setup>
/**
 * Shell real del template, igual que `legacy.vue` — con las páginas
 * `definePageMeta({ fullBleed: true })` pintando a pantalla completa, sin el
 * padding que trae el contenido normal (ver `app/types/route-meta.d.ts`).
 */
const route = useRoute()
const fullBleed = computed(() => route.meta.fullBleed === true)
</script>

<template>
  <SidebarProvider
    class="h-screen"
    :style="{
      '--sidebar-width': 'calc(var(--spacing) * 64)',
      '--header-height': 'calc(var(--spacing) * 12)',
    }"
  >
    <AppSidebar variant="inset" />

    <SidebarInset class="flex h-[calc(100%-1rem)] min-h-0 flex-col overflow-hidden">
      <SiteHeader />

      <div class="@container/main flex min-h-0 flex-1 flex-col overflow-auto">
        <div
          id="main-content"
          :class="
            fullBleed
              ? 'flex min-h-full flex-1 flex-col'
              : 'flex min-h-full flex-1 flex-col px-4 pt-4 pb-8 md:px-8 md:pt-6'
          "
        >
          <slot />
        </div>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
