<template>
	<MxDialog
		v-model="isOpen"
		title="Render Image"
		class="w-5xl bg-window-bg block-border flex flex-col h-2/3"
		:root="{ modal: false }"
		resize
		outside-interaction
		icon="ui/render-image"
	>
		<!-- Horizontal Layout: Preview + Settings -->
		<div class="flex gap-3 p-3 grow overflow-hidden" data-testid="modal-render-image">
			<!-- Left Side: Render Preview -->
			<div class="flex flex-col flex-1">
				<div
					ref="imageWrapperRef"
					class="relative flex grow justify-center items-center border border-ui-box-outline rounded
						overflow-hidden"
				>
					<img
						ref="previewRef"
						class="max-w-full max-h-full m-auto block object-contain checkerboard"
						@load="() => (isRendering = false)"
						@error="() => (isRendering = false)"
					/>
					<MxSpinner v-if="isRendering">Rendering...</MxSpinner>
					<div class="absolute top-2 left-2 text-xs bg-black/50 px-2 py-1 rounded text-white">
						Preview
					</div>
					<button
						class="btn absolute top-2 right-2 text-xs px-2 py-1 rounded text-white"
						:disabled="isRendering"
						@click="renderImage()"
					>
						Render Image
					</button>

					<MxButton
						icon="misc/full-screen"
						class="absolute bottom-2 right-2 text-xl p-1"
						@click="imageFullscreenToggle"
					/>
				</div>

				<!-- Render Metadata -->
				<div class="flex gap-4 text-sm text-ui-menu-bg-text mt-1">
					<div><b>Resolution:</b> {{ renderedImageData.resolution }}</div>
					<div><b>Format:</b> {{ renderedImageData.format }}</div>
					<div><b>Render Time:</b> {{ renderedImageData.renderTime }}s</div>
				</div>
			</div>

			<!-- Right Side: Settings -->
			<div class="flex flex-col max-w-xs w-full -mr-2.5">
				<ScrollContainer>
					<MxAccordionRoot
						collapsible
						:default-value="['image']"
						type="multiple"
						class="space-y-1 pr-2.5"
					>
						<MxAccordionItem label="Image" :item="{ value: 'image' }">
							<RenderImageSettings v-model="renderSettings" />
						</MxAccordionItem>
						<MxAccordionItem
							v-if="cameraStore.renderCameraList.length > 0"
							label="Render Camera"
							:item="{ value: 'camera' }"
						>
							<CameraSettings />
						</MxAccordionItem>
						<p v-else class="text-ui-panel-title">
							No cameras found in scene. <br />
							Viewport camera will be used
						</p>
					</MxAccordionRoot>
				</ScrollContainer>

				<!-- Action Buttons -->
				<div class="flex gap-2 text-ui-text-text text-sm justify-end mt-1 pr-2.5">
					<button class="btn btn--highlight" :disabled="!canSaveImage" @click="saveImage">
						Save Image
					</button>
					<button class="btn" :disabled="isRendering" @click="close('renderImage')">Cancel</button>
				</div>
			</div>
		</div>
	</MxDialog>
</template>

<script lang="ts" setup>
import { useSceneStore } from '@/app/model/scene'
import { useShadingStore } from '@/app/model/shading'
import { useTemplateRef, ref, computed, reactive } from 'vue'
import THREE from '@/shared/three'
import { useModals } from '@/shared/lib/modals'
import { downloadFile } from '@/shared/lib/files'
import type { RenderSettings } from './RenderImageSettings.vue'
import { useToast } from '@/shared/lib/toast'
import { getUserData } from '@/shared/three/utils'
import { useCameraStore } from '@/app/model/camera'
import { useComposerStore } from '@/app/model/composer'

const isOpen = defineModel<boolean>({ default: false })

const sceneStore = useSceneStore()

const { close } = useModals()
const toast = useToast()

const shadingStore = useShadingStore()
const cameraStore = useCameraStore()

const renderSettings = ref<RenderSettings>({
	width: 1920,
	height: 1080,
	selectedFormat: 'webp',
	quality: 100,
	background: true
})

const renderedImageData = reactive({
	resolution: '',
	format: '',
	renderTime: 0
})

const isRendering = ref(false)
const actualWidth = ref(1920)
const actualHeight = ref(1080)

const previewRef = useTemplateRef('previewRef')

const canSaveImage = computed(() => {
	return !isRendering.value && previewRef.value?.src
})

/**
 * Creates a render scene from the source scene, excluding helper objects.
 */
function createRenderScene(sourceScene: THREE.Scene): THREE.Scene {
	const renderScene = new THREE.Scene()

	renderScene.background = sourceScene.background?.clone() ?? null
	renderScene.fog = sourceScene.fog?.clone() ?? null
	// The World's map can be shared straight across now that the render draws with
	// the viewport's own renderer: `scene.environment` in export mode already holds
	// `world.environment`, and it is that renderer's PMREM output (ADR-0002).
	renderScene.environment = sourceScene.environment

	// The World's strength and orientation live in these fields, not in the
	// textures above. Left at their defaults the render would come out lit at
	// strength 1 whatever the World says.
	renderScene.environmentIntensity = sourceScene.environmentIntensity
	renderScene.backgroundIntensity = sourceScene.backgroundIntensity
	renderScene.backgroundBlurriness = sourceScene.backgroundBlurriness
	renderScene.environmentRotation.copy(sourceScene.environmentRotation)
	renderScene.backgroundRotation.copy(sourceScene.backgroundRotation)

	// Clone non-helper objects
	sourceScene.children.forEach((child) => {
		if (!getUserData(child).isHelper) {
			const cloned = child.clone(true)
			renderScene.add(cloned)
		}
	})

	return renderScene
}

const displayCanvas = document.createElement('canvas')

/**
 * Renders the scene to the canvas.
 */
async function renderImage() {
	const originalMode = shadingStore.shadingMode
	isRendering.value = true

	const {
		background,
		quality,
		selectedFormat,
		width: requestedWidth,
		height: requestedHeight
	} = renderSettings.value

	setTimeout(() => {
		try {
			shadingStore.setMode('export')

			const renderScene = createRenderScene(sceneStore.scene as THREE.Scene)
			// `createRenderScene` has already copied the World's backdrop across.
			// The toggle only decides whether it is drawn at all — choosing a
			// different colour for one render is the World tab's job, and having
			// two places to set a background is how they drift apart.
			if (!background) renderScene.background = null

			const startTime = performance.now()
			const { image, width, height } = useComposerStore().renderImage({
				scene: renderScene,
				camera: cameraStore.renderCamera ?? cameraStore.activeCamera,
				width: requestedWidth,
				height: requestedHeight
			})
			const endTime = performance.now()

			// What came back may be smaller than what was asked for: the GPU caps how
			// large a target can be. Everything downstream — the metadata, the saved
			// filename — follows these, not the request.
			if (width !== requestedWidth || height !== requestedHeight) {
				toast.add({
					type: 'warning',
					title: 'Render size reduced',
					message: `This GPU could not render ${requestedWidth}x${requestedHeight}; rendered at ${width}x${height}.`
				})
			}
			actualWidth.value = width
			actualHeight.value = height

			// The 2D canvas is what `saveImage` and the preview both encode from.
			displayCanvas.width = width
			displayCanvas.height = height
			const context = displayCanvas.getContext('2d')
			if (!context) throw new Error('2D context unavailable')
			context.putImageData(image, 0, 0)

			renderedImageData.resolution = `${width}x${height}`
			renderedImageData.format = selectedFormat
			renderedImageData.renderTime = Number(((endTime - startTime) / 1000).toFixed(2))

			if (previewRef.value?.src) {
				URL.revokeObjectURL(previewRef.value.src)
			}

			displayCanvas.toBlob(
				(blob) => {
					if (!blob || !previewRef.value) return
					previewRef.value.src = URL.createObjectURL(blob)
				},
				`image/${selectedFormat}`,
				quality / 100
			)
		} catch (error) {
			console.error('Render failed:\n', error)
			const err = error as Error
			toast.add({
				type: 'error',
				title: 'Image render error',
				message: err.message
			})
			isRendering.value = false
		} finally {
			shadingStore.setMode(originalMode)
		}
	}, 10)
}

/**
 * Saves the rendered image to a file.
 */
async function saveImage() {
	try {
		const { selectedFormat, quality } = renderSettings.value
		// The size on the canvas, not the one in the settings: a request the GPU
		// could not meet was rendered smaller, and a file named for the request
		// would say 10000x5000 over 8192x4096 pixels.
		const width = actualWidth.value
		const height = actualHeight.value

		const blob = await new Promise<Blob | null>((resolve) => {
			displayCanvas.toBlob(
				(blob: Blob | null) => {
					resolve(blob)
				},
				`image/${selectedFormat}`,
				quality / 100
			)
		})

		if (!blob) return

		const resolution = `${width}x${height}`
		const filename = `render_${resolution}.${selectedFormat}`

		downloadFile(blob, filename, {
			mimeType: `image/${selectedFormat}`
		})
	} catch (e) {
		const error = e as Error
		toast.add({
			type: 'error',
			title: 'Error saving an image',
			message: error.message
		})
		if (import.meta.env.DEV) console.error('saveImage:\n', error)
	}
}

const imageWrapperRef = useTemplateRef('imageWrapperRef')

function imageFullscreenToggle() {
	if (document.fullscreenElement) {
		document.exitFullscreen()
	} else {
		imageWrapperRef.value?.requestFullscreen()
	}
}
</script>
