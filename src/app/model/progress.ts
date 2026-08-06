import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

export interface ProgressItem {
	id: string
	title: string
	percentage?: number
	loaded: number
	total?: number
	startTime: number
	estimatedTimeRemaining?: number
}

export const useProgressStore = defineStore('progress', () => {
	const progressItems = ref<ProgressItem[]>([])

	function initProgress(title: string) {
		const id = crypto.randomUUID()

		const start = (total?: number) => {
			if (progressItems.value.some((p) => p.id === id)) return

			progressItems.value.push({
				id,
				title,
				percentage: 0,
				loaded: 0,
				total,
				startTime: Date.now()
			})
		}

		const update = (id: string, loaded: number, total?: number) => {
			const item = progressItems.value.find((p) => p.id === id)
			if (!item) return

			// A transfer that started before its length was known can learn it from
			// the first computable event.
			if (item.total === undefined && total !== undefined) item.total = total
			if (!item.total) return

			item.loaded = loaded
			item.percentage = (loaded / item.total) * 100

			// Calculate ETA
			const elapsed = Date.now() - item.startTime
			if (elapsed > 0 && loaded > 0) {
				const rate = loaded / elapsed // bytes per millisecond
				const remaining = item.total - loaded
				item.estimatedTimeRemaining = remaining / rate
			}
		}

		// Removal is by id, not by the index this item had when it started:
		// concurrent loads (an OBJ and its MTL, say) shift each other's positions,
		// and a stale index removes somebody else's bar.
		const stop = () => {
			const idx = progressItems.value.findIndex((p) => p.id === id)
			if (idx === -1) return
			progressItems.value.splice(idx, 1)
		}

		const onProgress = (e: ProgressEvent) => {
			if (e.lengthComputable) {
				const item = progressItems.value.find((p: ProgressItem) => p.id === id)

				if (!item) return start(e.total)

				update(item.id, e.loaded, e.total)
			}
		}

		return {
			id,
			start,
			update,
			stop,
			onProgress
		}
	}

	return {
		progressItems,
		initProgress
	}
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useProgressStore, import.meta.hot))
}
