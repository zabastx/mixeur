import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * A workspace is a whole-window layout, not a panel. Switching one swaps what
 * fills the editor area, which is why the tabs that drive it live in the top
 * bar next to the menus rather than inside any editor.
 */
export const WORKSPACES = [
	{ id: 'layout', label: 'Layout' },
	{ id: 'uv', label: 'UV Editing' }
] as const

export type WorkspaceId = (typeof WORKSPACES)[number]['id']

export const useWorkspaceStore = defineStore('workspace', () => {
	const current = ref<WorkspaceId>('layout')

	function setWorkspace(id: WorkspaceId) {
		current.value = id
	}

	return { current, setWorkspace }
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useWorkspaceStore, import.meta.hot))
}
