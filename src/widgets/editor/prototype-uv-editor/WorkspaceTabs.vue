<template>
	<nav class="-my-1 flex items-stretch gap-px self-stretch" data-testid="workspace-tabs">
		<button
			v-for="tab in WORKSPACES"
			:key="tab.id"
			class="flex items-center gap-1.5 rounded-t px-3 text-xs"
			:class="
				workspace === tab.id
					? 'bg-window-bg text-gray-200'
					: 'text-header-text hover:bg-panel-background'
			"
			:data-testid="`workspace-tab-${tab.id}`"
			@click="workspace = tab.id"
		>
			<MxIcon :name="tab.icon" />
			{{ tab.label }}
		</button>
	</nav>
</template>

<script lang="ts" setup>
/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Workspace tabs in the top-level header, next to the menus, as Blender has
 * them. Sitting here rather than above the editor area is the point: a
 * workspace swaps the whole layout, so the control for it belongs to the
 * window, not to any panel inside it.
 */
import { WORKSPACES, workspace } from './workspace'
</script>
