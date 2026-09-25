// Renombrado localmente de Tooltip/TooltipContent/TooltipProvider/TooltipTrigger
// a GTooltip*: los nombres sin prefijo chocaban con `ui/tooltip` en el
// auto-import de Nuxt. `gandalf/` es intocable, así que este fix hay que
// aplicarlo también en el repo de Gandalf o el próximo sync lo revierte
// (mismo caso que el import de `lucide-vue-next` en GAccordionTrigger/GSwitch).
export { default as GTooltip } from './GTooltip.vue'
export { default as GTooltipContent } from './GTooltipContent.vue'
export { default as GTooltipProvider } from './GTooltipProvider.vue'
export { default as GTooltipTrigger } from './GTooltipTrigger.vue'
