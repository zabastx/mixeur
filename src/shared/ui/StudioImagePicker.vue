<!--
	Picks one of the eight bundled images by thumbnail.

	Shared because the same eight files fill two unrelated roles — Studio Light in
	the viewport shading popover, World Preset in the World tab — and only the
	*meaning* differs (ADR-0002). The markup, the thumbnail path and the
	capitalised label had been written twice and had to keep agreeing.

	Callers supply their own wording via `tooltipFooter`, which is where the two
	roles are actually distinguished for the reader.
-->
<template>
	<MxPopover>
		<template #trigger>
			<button
				type="button"
				class="flex justify-center rounded border bg-ui-menu-inner border-ui-menu-outline
					hover:brightness-125 cursor-pointer w-full p-1"
			>
				<!-- Undefined until the first image finishes loading. The old markup
					 asked for `undefined.png` and showed a broken image in that gap. -->
				<img v-if="name" :src="thumbnail(name)" :alt="alt" width="64" height="64" />
				<span v-else class="block size-16" />
			</button>
		</template>
		<template #content>
			<div class="flex gap-0.5">
				<MxTooltip
					v-for="image in STUDIO_LIGHTS"
					:key="image"
					:tooltip="{ text: label(image), footer: tooltipFooter }"
				>
					<button
						type="button"
						class="btn bg-ui-menu-inner border-ui-menu-outline"
						:class="{ 'bg-ui-menu-item-inner-selected': image === name }"
						@click="emit('select', image)"
					>
						<img width="64" height="64" :src="thumbnail(image)" :alt="label(image)" />
					</button>
				</MxTooltip>
			</div>
		</template>
	</MxPopover>
</template>

<script lang="ts" setup>
import { STUDIO_LIGHTS, type StudioLightName } from '@/shared/three/modules/loaders/studio-light'

defineProps<{
	/** Which image is currently chosen. */
	name: StudioLightName | undefined
	/** Alt text for the trigger, in the caller's own vocabulary. */
	alt: string
	/** Shown under each thumbnail's tooltip, naming the role the caller is in. */
	tooltipFooter?: string
}>()

const emit = defineEmits<{ select: [name: StudioLightName] }>()

function thumbnail(image: string) {
	return `/textures/studio/${image}.png`
}

function label(image: string) {
	return image.slice(0, 1).toUpperCase() + image.slice(1)
}
</script>
