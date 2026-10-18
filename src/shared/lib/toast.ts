import { ref } from 'vue'

export interface ToastOptions {
	title?: string
	message: string
	type?: 'info' | 'success' | 'warning' | 'error'
	duration?: number
}

export interface ToastItem extends ToastOptions {
	id: string
	open: boolean
}

// Global toast state
const toasts = ref<ToastItem[]>([])
let toastIdCounter = 0

export const useToast = () => {
	const add = (options: ToastOptions) => {
		const id = `toast-${++toastIdCounter}`
		const toast: ToastItem = {
			id,
			title: options.title,
			message: options.message,
			type: options.type || 'info',
			duration: options.duration ?? 5000,
			open: true
		}

		toasts.value.push(toast)
		return id
	}

	const remove = (id: string) => {
		const index = toasts.value.findIndex((toast) => toast.id === id)
		if (index > -1) {
			toasts.value.splice(index, 1)
		}
	}

	const clear = () => {
		toasts.value = []
	}

	return {
		toasts,
		add,
		remove,
		clear
	}
}
