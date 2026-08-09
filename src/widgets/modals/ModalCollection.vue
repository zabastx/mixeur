<template>
	<ModalAbout v-model="openModals.about" />
	<AssetBrowserModels v-model="openModals.modelsLibrary" />
	<AssetBrowserTextures
		v-model="openModals.textureLibrary"
		:callback="dialogCallbacks.textureLibrary"
	/>
	<AssetBrowserHDRIs v-model="openModals.hdriLibrary" :callback="dialogCallbacks.hdriLibrary" />
	<RenderImageModal v-model="openModals.renderImage" />
	<ImportSceneModal v-model="openModals.importScene" />
	<PreferencesModal v-model="openModals.preferences" />
</template>

<script lang="ts" setup>
import { openModals, dialogCallbacks } from '@/shared/lib/modals'
</script>
