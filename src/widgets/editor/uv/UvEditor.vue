<template>
	<EditorWrapper class="grid min-w-0 grid-rows-[auto_1fr_auto]">
		<!-- A thin header for the settings that change constantly; everything
		     else lives in the rail. -->
		<div
			class="flex items-center gap-1 border-b border-editor-outline bg-viewport-header-bg px-1
				py-0.5"
		>
			<MxIcon name="ui/material-data" class="shrink-0" />
			<div class="flex gap-0.5">
				<button
					v-for="mode in MODES"
					:key="mode"
					class="btn px-1.5 text-xs capitalize"
					:class="{ 'btn--highlight': uvStore.selection.mode === mode }"
					:data-testid="`uv-mode-${mode}`"
					@click="uvStore.setMode(mode)"
				>
					{{ mode }}
				</button>
			</div>
			<div class="ml-auto flex gap-0.5">
				<button class="btn text-xs" @click="uvStore.selectAll()">All</button>
				<button class="btn text-xs" @click="uvStore.clearSelection()">None</button>
			</div>
		</div>

		<div class="grid min-h-0 grid-cols-[auto_1fr]">
			<UvToolRail />
			<UvCanvas />
		</div>

		<div
			class="truncate border-t border-editor-outline bg-panel-sub-background px-2 py-0.5 text-xs
				text-header-text"
		>
			{{ uvStore.lastAction || hint }}
		</div>
	</EditorWrapper>
</template>

<script lang="ts" setup>
/**
 * The UV editor pane: header, tool rail, canvas, status line.
 *
 * It edits the whole selected mesh — see `useUvStore` for why that scope, and
 * what sub-object selection would buy.
 */
import { computed } from 'vue'
import type { SelectMode } from '@/shared/lib/uv-layout'
import { useUvStore } from '@/app/model/uv'

const MODES: SelectMode[] = ['vertex', 'edge', 'face', 'island']

const uvStore = useUvStore()

const hint = computed(() =>
	uvStore.status === 'ready'
		? 'Drag to move · drag empty space to box-select · Shift extends · Alt+click sets the 2D cursor'
		: ''
)
</script>
