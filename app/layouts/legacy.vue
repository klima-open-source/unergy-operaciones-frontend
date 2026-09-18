<script setup>
/**
 * Fase 3, ola 1: el shell real del template (`SidebarProvider` + `AppSidebar` +
 * `SiteHeader`), igual que `default.vue`.
 *
 * Antes envolvía `LegacyAppSidebar.vue`, con su propio overlay móvil y botón de
 * colapso hechos a mano. El `Sidebar` real ya trae eso resuelto (`SidebarTrigger`
 * en `SiteHeader`), así que desaparecieron con el swap.
 */
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
          class="flex min-h-full flex-1 flex-col px-4 pt-4 pb-8 md:px-8 md:pt-6"
        >
          <slot />
        </div>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
