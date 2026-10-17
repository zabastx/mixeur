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

export async function uploadFile(accept?: string) {
	return new Promise<{
		data: {
			url: string
			filename: string
			cleanup: () => void
		} | null
		error: Error | null
	}>((resolve) => {
		const input = document.createElement('input')
		input.type = 'file'
		if (accept) {
			input.accept = accept
		}
		document.body.appendChild(input)

		const fail = (err: unknown) => {
			const error = err as Error
			console.error('Error uploading a file\n', error)
			resolve({ data: null, error })
		}

		try {
			// The picker reports the choice after click() returns, so its errors
			// need their own catch.
			input.addEventListener('change', (e: Event) => {
				try {
					const $input = e.target as HTMLInputElement
					const file = $input.files?.[0]

					if (!file) {
						resolve({ data: null, error: null })
						return
					}

					const fileUrl = URL.createObjectURL(file)

					resolve({
						data: {
							url: fileUrl,
							filename: file.name,
							cleanup: () => URL.revokeObjectURL(fileUrl)
						},
						error: null
					})
				} catch (err) {
					fail(err)
				}
			})

			input.click()
		} catch (err) {
			fail(err)
		} finally {
			input.remove()
		}
	})
}
