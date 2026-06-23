<template>
	<MxDialog v-model="isOpen" class="max-w-xl bg-editor-border">
		<div class="flex max-w-xl flex-col text-ui-menu-bg-text" data-testid="modal-about">
			<!-- Header -->
			<div class="flex items-center gap-4 p-4">
				<img
					class="inline-block max-h-[1em] scale-125 text-5xl"
					src="/logo.webp"
					loading="lazy"
					alt="mixeur logo"
					aria-hidden
				/>
				<div>
					<h1 class="text-2xl font-bold text-white">Mixeur</h1>
					<p class="text-sm">Version {{ version }}</p>
				</div>
			</div>

			<!-- Content -->
			<div class="flex flex-1 justify-between gap-2.5 p-4">
				<div class="w-full max-w-xs space-y-4">
					<p class="text-sm">A Blender-like web-based 3D editor built with Vue.js and Three.js</p>

					<div>
						<h3 class="mb-2 text-sm font-semibold">Credits</h3>
						<div class="space-y-1 text-xs">
							<div><b>Inspired by:</b> Blender</div>
							<div><b>Built with:</b> Vue.js, Three.js</div>
						</div>
					</div>

					<p class="text-xs">Licensed under MIT License</p>
				</div>
				<div
					class="flex w-[200px] flex-col justify-end gap-1 text-sm *:rounded *:p-0.5 *:leading-none
						**:inline-block *:hover:bg-gray-500/50"
				>
					<a href="https://www.blender.org/" target="_blank">
						<MxIcon name="misc/url" />
						Blender
					</a>
					<a href="https://threejs.org/" target="_blank">
						<MxIcon name="misc/url" />
						Three.js
					</a>
					<a href="https://vuejs.org/" target="_blank">
						<MxIcon name="misc/url" />
						Vue.js
					</a>
					<a href="https://github.com/zabastx/mixeur" target="_blank">
						<MxIcon name="misc/url" />
						GitHub repository
					</a>
				</div>
			</div>
		</div>
	</MxDialog>
</template>

<script lang="ts" setup>
const version = '0.21.0'

const isOpen = defineModel<boolean>({ default: false })

defineExpose({
	open: () => (isOpen.value = true),
	close: () => (isOpen.value = false)
})
</script>
