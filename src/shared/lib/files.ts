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
		input.hidden = true
		if (accept) {
			input.accept = accept
		}
		document.body.appendChild(input)

		// The picker answers after click() returns, so the input stays on the
		// page until then, and its errors need their own catch.
		const settle = (result: Parameters<typeof resolve>[0]) => {
			input.remove()
			resolve(result)
		}
		const fail = (err: unknown) => {
			const error = err as Error
			console.error('Error uploading a file\n', error)
			settle({ data: null, error })
		}

		input.addEventListener('cancel', () => settle({ data: null, error: null }))
		input.addEventListener('change', () => {
			try {
				const file = input.files?.[0]

				if (!file) {
					settle({ data: null, error: null })
					return
				}

				const fileUrl = URL.createObjectURL(file)

				settle({
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

		try {
			input.click()
		} catch (err) {
			fail(err)
		}
	})
}
