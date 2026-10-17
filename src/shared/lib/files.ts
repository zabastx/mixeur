export function downloadFile(
	data: Blob | ArrayBuffer,
	filename: string,
	options?: { mimeType?: string }
) {
	try {
		let blob: Blob
		if (data instanceof ArrayBuffer) {
			const mimeType = options?.mimeType ?? 'application/octet-stream'
			blob = new Blob([data], { type: mimeType })
		} else {
			blob = data
		}

		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		a.style.display = 'none'

		document.body.appendChild(a)
		a.click()

		setTimeout(() => {
			document.body.removeChild(a)
			URL.revokeObjectURL(url)
		}, 100)

		return { success: true, error: null }
	} catch (err) {
		const error = err as Error
		console.error('Error downloading a file\n', error)
		return { success: false, error }
	}
}
