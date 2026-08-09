import { reactive } from 'vue'

type DialogName =
	| 'modelsLibrary'
	| 'textureLibrary'
	| 'hdriLibrary'
	| 'about'
	| 'renderImage'
	| 'importScene'
	| 'preferences'

type DialogCallback = (...args: unknown[]) => unknown

export const openModals = reactive<Record<DialogName, boolean>>({
	about: false,
	modelsLibrary: false,
	textureLibrary: false,
	hdriLibrary: false,
	renderImage: false,
	importScene: false,
	preferences: false
})

export const dialogCallbacks = reactive<Record<DialogName, DialogCallback | null>>({
	about: null,
	modelsLibrary: null,
	textureLibrary: null,
	hdriLibrary: null,
	renderImage: null,
	importScene: null,
	preferences: null
})

export function useModals() {
	const isOpen = (name: DialogName) => openModals[name]

	function open(name: DialogName, cb?: DialogCallback) {
		openModals[name] = true
		dialogCallbacks[name] = cb ?? null
	}

	function close(name: DialogName) {
		openModals[name] = false
	}

	return {
		open,
		close,
		isOpen
	}
}
