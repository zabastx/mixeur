<template>
	<MxPopover>
		<template #trigger>
			<button
				type="button"
				class="flex justify-center rounded border bg-ui-menu-inner border-ui-menu-outline
					hover:brightness-125 cursor-pointer w-full p-1"
				data-testid="world-preset"
			>
				<img :src="thumbnail(name)" :alt="`${name} environment`" width="64" height="64" />
			</button>
		</template>
		<template #content>
			<div class="flex gap-0.5">
				<MxTooltip
					v-for="preset in DEFAULT_STUDIO_LIGHTS"
					:key="preset"
					:tooltip="{ text: preset.slice(0, 1).toUpperCase() + preset.slice(1) }"
				>
					<button
						type="button"
						class="btn bg-ui-menu-inner border-ui-menu-outline"
						:class="{ 'bg-ui-menu-item-inner-selected': preset === name }"
						@click="emit('select', preset)"
					>
						<img width="64" height="64" :src="thumbnail(preset)" :alt="preset" />
					</button>
				</MxTooltip>
			</div>
		</template>
	</MxPopover>
</template>

<script lang="ts" setup>
import { DEFAULT_STUDIO_LIGHTS } from '@/shared/three/modules/loaders/studio-light'
import type { StudioLightName } from '@/app/model/types/world'

defineProps<{ name: StudioLightName }>()

const emit = defineEmits<{ select: [name: StudioLightName] }>()

// The same eight files back both roles, so the thumbnails are shared too. Only
// the meaning differs — see ADR-0002.
function thumbnail(preset: string) {
	return `/textures/studio/${preset}.png`
}
</script>
