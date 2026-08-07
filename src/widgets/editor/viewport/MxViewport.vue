<template>
	<EditorWrapper>
		<ViewportHeader
			v-if="viewportStore.isMounted"
			class="absolute top-0 left-0 z-1 w-full bg-viewport-header-bg"
		/>

		<div :class="GIZMO_CONTAINER_CLASS" class="absolute top-10 right-0"></div>
		<ViewNavigationWidget v-if="viewportStore.isMounted" class="absolute top-40 right-2.5" />
		<div v-if="isError" ref="webglErrorRef" class="webgl-error"></div>
		<canvas
			v-else
			ref="canvasRef"
			class="block h-full w-full"
			data-testid="viewport-canvas"
		></canvas>

		<Transition name="slide-fade-left">
			<ViewportToolbar
				v-if="viewportStore.isMounted && appStore.showToolbar"
				class="absolute top-20 left-2.5"
			/>
		</Transition>
	</EditorWrapper>
</template>

<script lang="ts" setup>
import { useViewportStore, type Viewport } from '@/app/model/viewport'
import { onMounted, onUnmounted, ref, shallowRef, useTemplateRef } from 'vue'
import WebGL from 'three/addons/capabilities/WebGL.js'
import ViewNavigationWidget from './ViewNavigationWidget.vue'
import { useAppStore } from '@/app/model/app'
import { GIZMO_CONTAINER_CLASS } from '@/app/config/gizmo'
import { useSceneStore } from '@/app/model/scene'

const appStore = useAppStore()
const canvasRef = useTemplateRef('canvasRef')

const sceneStore = useSceneStore()
const viewportStore = useViewportStore()
const webglErrorRef = useTemplateRef('webglErrorRef')
const isError = ref(false)

const viewport = shallowRef<Viewport | null>(null)

onMounted(() => {
	if (!WebGL.isWebGL2Available()) {
		isError.value = true
		const $error = WebGL.getWebGL2ErrorMessage()
		$error.setAttribute('style', '')
		webglErrorRef.value?.appendChild($error)
		return
	}

	if (!canvasRef.value) return

	viewport.value = viewportStore.mount(canvasRef.value)
	// Scene seeding, not viewport lifecycle: these objects belong to the
	// project and outlive any one viewport.
	sceneStore.seedDefaultScene()
})

onUnmounted(() => {
	viewport.value?.dispose()
	viewport.value = null
})
</script>

<style>
@reference 'tailwindcss/theme';

.webgl-error {
	@apply flex h-full w-full items-center justify-center text-black;
	div {
		@apply bg-white p-2.5;
	}
	a {
		@apply text-blue-600! underline;
	}
}
</style>
