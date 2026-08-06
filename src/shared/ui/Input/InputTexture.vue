<template>
	<div class="group">
		<div
			class="rounded border border-ui-menu-outline bg-ui-menu-inner px-1 py-0.5 text-ui-menu-text
				grid grid-cols-[1fr_auto] gap-1"
			:tabindex="disabled ? undefined : 0"
		>
			<span class="truncate" :title="model?.name">
				{{ model?.name ?? 'None' }}
			</span>
			<button v-if="model" type="button" class="cursor-pointer px-1" @click="reset">
				<MxIcon name="ui/close" />
			</button>
		</div>
		<div class="hidden grid-cols-2 group-focus-within:grid">
			<button type="button" class="btn" @click="openLibrary">Library</button>
			<button type="button" class="btn" @click="open()">File</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { isPolyHavenFileInfo } from '@/widgets/modals/asset-browser/types/polyhaven'
import { useModals } from '@/shared/lib/modals'
import THREE from '@/shared/three'
import { loadTexture, type LoadResult } from '@/shared/three/modules/loaders'
import { useFileDialog } from '@vueuse/core'

const { isEnvMap = false } = defineProps<{
	disabled?: boolean
	isEnvMap?: boolean
}>()

const model = defineModel<THREE.Texture | null>()

const { open, onChange } = useFileDialog({
	multiple: false,
	accept: 'image/*, .exr'
})

onChange(async (files) => {
	const file = files?.[0]
	if (!file) return

	apply(await loadTexture(file, { isEnvMap }))
})

const { open: openModal } = useModals()

function openLibrary() {
	openModal('textureLibrary', async (file) => {
		if (!isPolyHavenFileInfo(file)) return

		apply(await loadTexture({ url: file.url, size: file.size }, { isEnvMap }))
	})
}

function apply(result: LoadResult<THREE.Texture>) {
	if (!result.ok) return

	const oldTexture = model.value
	model.value = result.value
	if (oldTexture) oldTexture.dispose()
}

function reset() {
	if (model.value) {
		const texture = model.value
		model.value = null
		texture.dispose()
	}
}
</script>
