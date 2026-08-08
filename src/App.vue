<template>
	<ToastProvider>
		<TooltipProvider :delay-duration="300" disable-hoverable-content>
			<div class="flex h-full flex-col font-sans text-gray-200">
				<TopBar v-if="viewportStore.isMounted" />

				<!--
					The workspace decides what fills the editor area. The UV workspace
					gives its left half to the UV editor; the viewport is never
					unmounted between them, only resized, because rebuilding the
					renderer and post-processing chain on every tab switch is not free.
				-->
				<main class="grid min-h-0 flex-1 grid-cols-(--main-cols) bg-editor-border p-1 select-none">
					<template v-if="isUvWorkspace">
						<UvEditor />
						<div ref="uvDivider" class="divider w-1 cursor-col-resize"></div>
					</template>

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
			</div>
		</TooltipProvider>
	</ToastProvider>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, ref, useTemplateRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { ToastProvider, TooltipProvider } from 'reka-ui'
import { useAppStore } from '@/app/model/app'
import { useViewportStore } from '@/app/model/viewport'
import { usePreferencesStore } from '@/app/model/preferences'
import { useWorkspaceStore } from '@/app/model/workspace'

const ModalCollection = defineAsyncComponent(() => import('@/widgets/modals/ModalCollection.vue'))

const appStore = useAppStore()
const viewportStore = useViewportStore()
const workspaceStore = useWorkspaceStore()

const isUvWorkspace = computed(() => workspaceStore.current === 'uv')

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

const uvDivider = useTemplateRef('uvDivider')
// Wide enough that the tool rail and a square tile both fit without scrolling.
const uvWidth = ref(Math.round(Math.min(760, Math.max(520, window.innerWidth * 0.42))))

useEventListener(uvDivider, 'pointerdown', (e: PointerEvent) => {
	const startX = e.clientX
	const startWidth = uvWidth.value

	const move = (ev: PointerEvent) => {
		uvWidth.value = Math.max(320, startWidth + (ev.clientX - startX))
	}

	const cancel = useEventListener(window, 'pointermove', move)
	useEventListener(window, 'pointerup', cancel)
})

const mainCols = computed(() =>
	isUvWorkspace.value
		? `${uvWidth.value}px min-content 1fr min-content ${rightWidth.value}px`
		: `1fr min-content ${rightWidth.value}px`
)
</script>

<style scoped>
main {
	--main-cols: v-bind(mainCols);
}
</style>
