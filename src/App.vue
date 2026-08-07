<template>
	<ToastProvider>
		<TooltipProvider :delay-duration="300" disable-hoverable-content>
			<div class="flex h-full flex-col font-sans text-gray-200">
				<TopBar v-if="viewportStore.isMounted" />

				<!-- PROTOTYPE: `?variant=` swaps the main area for a UV-editor layout.
				     Without the param this renders exactly as it always has. Remove
				     this block and src/widgets/editor/prototype-uv-editor/ together. -->
				<VariantASplit v-if="uvVariant === 'A'" />
				<VariantBWorkspace v-else-if="uvVariant === 'B'" />
				<VariantCDock v-else-if="uvVariant === 'C'" />
				<VariantDWorkspaceSplit v-else-if="uvVariant === 'D'" />

				<main
					v-else
					class="grid min-h-0 flex-1 grid-cols-(--main-cols) bg-editor-border p-1 select-none"
				>
					<MxViewport class="block-border" />
					<div ref="divider" class="divider w-1 cursor-col-resize"></div>
					<MxSidebar v-if="viewportStore.isMounted">
						<template #top>
							<DataOutliner />
						</template>
						<template #bottom>
							<DataProperties />
						</template>
					</MxSidebar>
				</main>

				<StatusBar v-show="appStore.showStatusBar" />

				<ModelLoadingProgress />
				<MxToast />
				<ModalCollection />
				<PrototypeSwitcher v-if="isDev" />
			</div>
		</TooltipProvider>
	</ToastProvider>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, ref, useTemplateRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { ToastProvider, TooltipProvider } from 'reka-ui'
import { useAppStore } from '@/app/model/app'
import { useViewportStore } from '@/app/model/viewport'
import { usePreferencesStore } from '@/app/model/preferences'
// PROTOTYPE — remove with src/widgets/editor/prototype-uv-editor/
import { useVariant } from '@/widgets/editor/prototype-uv-editor/variant'

const uvVariant = useVariant()
const isDev = import.meta.env.DEV

const ModalCollection = defineAsyncComponent(() => import('@/widgets/modals/ModalCollection.vue'))

const appStore = useAppStore()
const viewportStore = useViewportStore()

// Applied before the viewport mounts: the gizmo reads its colours from the
// theme's custom properties when it is built.
usePreferencesStore().initTheme()

const divider = useTemplateRef('divider')
const rightWidth = ref(window.innerWidth * 0.25)

useEventListener(divider, 'pointerdown', (e: PointerEvent) => {
	const startX = e.clientX
	const startWidth = rightWidth.value

	const move = (ev: PointerEvent) => {
		const delta = startX - ev.clientX
		rightWidth.value = Math.max(200, startWidth + delta)
	}

	const cancel = useEventListener(window, 'pointermove', move)
	useEventListener(window, 'pointerup', cancel)
})
</script>

<style scoped>
main {
	--col-width: v-bind(rightWidth + 'px');
	--main-cols: 1fr min-content var(--col-width);
}
</style>
