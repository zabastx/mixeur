/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Which workspace variant D is showing. It lives outside the variant component
 * because the tabs that drive it sit in the top-level header, the way Blender's
 * do — the header and the layout are in different parts of the tree and have to
 * agree.
 */
import { ref } from 'vue'

export const WORKSPACES = [
	{ id: 'layout', label: 'Layout', icon: 'ui/viewport' },
	{ id: 'uv', label: 'UV Editing', icon: 'ui/material-data' }
] as const

export type WorkspaceId = (typeof WORKSPACES)[number]['id']

export const workspace = ref<WorkspaceId>('uv')
