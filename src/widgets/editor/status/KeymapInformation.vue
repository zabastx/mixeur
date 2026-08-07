<template>
	<div
		v-show="inputStore.pointerOnCanvas || uvStore.pointerOnCanvas || uvStore.modalKind"
		class="flex items-center gap-2 text-xs select-none"
	>
		<div v-for="item in activeHints" :key="item.text" class="align-center flex gap-1">
			<MxIcon v-if="item.icon" class="text-xl" :name="item.icon" />
			<div v-if="item.textHint" class="space-x-0.5">
				<span v-for="hint in item.textHint" :key="item.key + hint" class="border rounded px-1">
					{{ hint }}
				</span>
			</div>
			<span>{{ item.text }}</span>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useInputStore } from '@/app/model/input'
import { useControlsStore } from '@/app/model/controls'
import { useUvStore } from '@/app/model/uv'

const inputStore = useInputStore()
const controlsStore = useControlsStore()
const uvStore = useUvStore()

const keymapList: KeymapOption[] = [
	{ icon: 'input/lmb', text: 'Select', key: null },
	{ icon: 'input/mmb', text: 'Rotate View', key: null },
	{ icon: 'input/mmb', text: 'Screen Space Pan View', key: 'shift' },
	{ icon: 'input/mmb', text: 'Pan View', key: 'ctrl' }
]

const transfromControlsHints: KeymapOption[] = [
	{
		textHint: ['X', 'Y', 'Z'],
		key: null,
		text: 'Axis'
	},
	{
		textHint: ['C'],
		key: null,
		text: 'Clear Constraints'
	},
	{
		textHint: ['Ctrl'],
		key: null,
		text: 'Snap'
	},
	{
		textHint: ['ESC'],
		key: null,
		text: 'Cancel'
	}
]

/**
 * The UV editor's keyboard, which is a different one — the same status bar
 * reports whichever editor the pointer is over, so the hints stay where the
 * user already looks for them instead of each editor growing its own legend.
 */
const uvHints: KeymapOption[] = [
	{ icon: 'input/lmb', text: 'Select' },
	{ icon: 'input/mmb', text: 'Pan View' },
	{ textHint: ['G', 'R', 'S'], text: 'Transform' },
	{ icon: 'input/lmb', textHint: ['Alt'], text: '2D Cursor' }
]

const uvModalHints = computed<KeymapOption[]>(() => [
	{ icon: 'input/lmb', text: 'Confirm' },
	// A rotation in a plane has no axis to lock to.
	...(uvStore.modalKind === 'rotate' ? [] : [{ textHint: ['X', 'Y'], text: 'Axis' }]),
	{ textHint: ['ESC'], text: 'Cancel' }
])

const activeHints = computed(() => {
	if (uvStore.pointerOnCanvas || uvStore.modalKind) {
		return uvStore.modalKind ? uvModalHints.value : uvHints
	}
	if (controlsStore.isTransformDrag) {
		return transfromControlsHints
	}
	if (inputStore.isCtrlDown) {
		return keymapList.filter((item) => item.key === 'ctrl')
	}
	if (inputStore.isShiftDown) {
		return keymapList.filter((item) => item.key === 'shift')
	}
	return keymapList.filter((item) => !item.key)
})

interface KeymapOption {
	icon?: MxIconName
	textHint?: string[]
	text: string
	/** Which modifier reveals this hint. Absent means it is not modifier-gated. */
	key?: 'ctrl' | 'shift' | null
}
</script>
