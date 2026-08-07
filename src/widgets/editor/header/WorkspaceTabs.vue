<template>
	<nav class="flex items-center gap-0.5" data-testid="workspace-tabs">
		<button
			v-for="tab in WORKSPACES"
			:key="tab.id"
			class="cursor-pointer rounded px-3 py-1 text-sm leading-none"
			:class="
				workspaceStore.current === tab.id
					? 'bg-workspace-tab-active text-gray-100'
					: 'text-header-text hover:bg-workspace-tab-hover'
			"
			:data-testid="`workspace-tab-${tab.id}`"
			:aria-current="workspaceStore.current === tab.id ? 'page' : undefined"
			@click="workspaceStore.setWorkspace(tab.id)"
		>
			{{ tab.label }}
		</button>
	</nav>
</template>

<script lang="ts" setup>
/**
 * Workspace tabs, in the top bar beside the menus, as Blender has them. A
 * workspace swaps the whole editor area, so its control belongs to the window
 * rather than to any panel inside it.
 *
 * Text only, no icons: the labels are the affordance, and an icon per workspace
 * is a naming problem with no good answer ("Layout" is not a picture).
 */
import { WORKSPACES, useWorkspaceStore } from '@/app/model/workspace'

const workspaceStore = useWorkspaceStore()
</script>
