<template>
	<footer
		class="flex h-6 items-center justify-end gap-1 bg-status-background px-2 py-1 text-xs
			text-header-text"
	>
		<KeymapInformation class="mr-auto" />
		<template v-if="store.monitor.memory">
			<div>RAM: {{ store.monitor.memory }} MB</div>
			<div class="divider h-full w-px bg-header-text"></div>
		</template>
		<div>Geometries: {{ store.monitor.geometries }}, Textures: {{ store.monitor.textures }}</div>
		<div class="divider h-full w-px bg-header-text"></div>
		<div class="version">{{ version }}</div>
	</footer>
</template>

<script lang="ts" setup>
import { version } from '@/../package.json'
import KeymapInformation from './KeymapInformation.vue'
import { useViewportStore } from '@/app/model/viewport'

const store = useViewportStore()
</script>
