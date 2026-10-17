import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadFile, uploadFile } from './files'

const BLOB_URL = 'blob:http://test/blob-url'

describe('downloadFile', () => {
	let urlBlobs: Blob[]
	let revoked: string[]
	let clicked: HTMLAnchorElement[]

	beforeEach(() => {
		vi.useFakeTimers()
		urlBlobs = []
		revoked = []
		clicked = []

		vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
			urlBlobs.push(blob as Blob)
			return BLOB_URL
		})
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
			revoked.push(url)
		})
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
			this: HTMLAnchorElement
		) {
			clicked.push(this)
		})
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it('clicks a link that downloads the given Blob under the filename', () => {
		const blob = new Blob(['test content'], { type: 'text/plain' })

		const result = downloadFile(blob, 'test.txt')

		expect(result).toEqual({ success: true, error: null })
		expect(clicked).toHaveLength(1)
		expect(clicked[0]?.download).toBe('test.txt')
		expect(clicked[0]?.href).toBe(BLOB_URL)
		expect(urlBlobs).toEqual([blob])
	})

	it('wraps an ArrayBuffer in a Blob of the given mimeType', async () => {
		const bytes = new Uint8Array([1, 2, 3])

		downloadFile(bytes.buffer, 'model.glb', { mimeType: 'model/gltf-binary' })

		expect(urlBlobs).toHaveLength(1)
		expect(urlBlobs[0]?.type).toBe('model/gltf-binary')
		expect(new Uint8Array(await urlBlobs[0]!.arrayBuffer())).toEqual(bytes)
		expect(clicked[0]?.download).toBe('model.glb')
	})

	it('wraps an ArrayBuffer in an octet-stream Blob when no mimeType is given', () => {
		downloadFile(new ArrayBuffer(8), 'data.bin')

		expect(urlBlobs).toHaveLength(1)
		expect(urlBlobs[0]?.type).toBe('application/octet-stream')
	})

	it('revokes the URL and removes the link once the download has started', () => {
		downloadFile(new Blob(['test']), 'test.txt')
		const link = clicked[0]

		expect(revoked).toEqual([])
		expect(link?.isConnected).toBe(true)

		vi.advanceTimersByTime(100)

		expect(revoked).toEqual([BLOB_URL])
		expect(link?.isConnected).toBe(false)
	})

	it('reports the error when the URL cannot be created', () => {
		vi.mocked(URL.createObjectURL).mockImplementation(() => {
			throw new Error('URL creation failed')
		})

		const result = downloadFile(new Blob(['test']), 'test.txt')

		expect(result.success).toBe(false)
		expect(result.error?.message).toBe('URL creation failed')
		expect(clicked).toEqual([])
	})
})

describe('uploadFile', () => {
	// What the user does in the picker: the files they pick, or null to cancel it.
	let picked: File[] | null
	let opened: HTMLInputElement[]
	let onPageWhilePicking: boolean[]

	beforeEach(() => {
		picked = null
		opened = []
		onPageWhilePicking = []
		document.body.replaceChildren()

		vi.spyOn(URL, 'createObjectURL').mockReturnValue(BLOB_URL)
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
		// The click opens the file picker; the user answers it after click() returns.
		vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
			this: HTMLInputElement
		) {
			opened.push(this)
			setTimeout(() => {
				onPageWhilePicking.push(this.isConnected)
				if (picked === null) {
					this.dispatchEvent(new Event('cancel'))
					return
				}
				Object.defineProperty(this, 'files', { value: picked, configurable: true })
				this.dispatchEvent(new Event('change'))
			})
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('returns a URL and the name of the picked file', async () => {
		const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
		picked = [file]

		const result = await uploadFile()

		expect(result.error).toBeNull()
		expect(result.data?.filename).toBe('test.txt')
		expect(result.data?.url).toBe(BLOB_URL)
		expect(URL.createObjectURL).toHaveBeenCalledWith(file)
		expect(opened[0]?.type).toBe('file')
	})

	it('revokes the URL on cleanup', async () => {
		picked = [new File(['x'], 'x.txt')]

		const result = await uploadFile()
		expect(URL.revokeObjectURL).not.toHaveBeenCalled()
		result.data?.cleanup()

		expect(URL.revokeObjectURL).toHaveBeenCalledWith(BLOB_URL)
	})

	it('returns no data when no file is picked', async () => {
		picked = []

		const result = await uploadFile()

		expect(result).toEqual({ data: null, error: null })
	})

	it('returns no data when the picker is cancelled', async () => {
		picked = null

		const result = await uploadFile()

		expect(result).toEqual({ data: null, error: null })
		expect(opened[0]?.isConnected).toBe(false)
	})

	it('restricts the picker to the accepted types', async () => {
		picked = [new File([''], 'test.png', { type: 'image/png' })]

		await uploadFile('image/*')

		expect(opened[0]?.accept).toBe('image/*')
	})

	it('leaves the picker unrestricted when no types are given', async () => {
		picked = [new File([''], 'test.png', { type: 'image/png' })]

		await uploadFile()

		expect(opened[0]?.accept).toBe('')
	})

	it('keeps a hidden input on the page until the user answers, then removes it', async () => {
		picked = [new File([''], 'test.png')]

		await uploadFile()

		expect(onPageWhilePicking).toEqual([true])
		expect(opened[0]?.hidden).toBe(true)
		expect(opened[0]?.isConnected).toBe(false)
	})

	it('reports the error when the picker cannot be opened', async () => {
		vi.mocked(HTMLInputElement.prototype.click).mockImplementation(() => {
			throw new Error('Picker blocked')
		})

		const result = await uploadFile()

		expect(result.data).toBeNull()
		expect(result.error?.message).toBe('Picker blocked')
		expect(document.body.querySelector('input')).toBeNull()
	})

	it('reports the error when no URL can be made for the picked file', async () => {
		vi.mocked(URL.createObjectURL).mockImplementation(() => {
			throw new Error('URL creation failed')
		})
		picked = [new File(['test'], 'test.txt')]

		const result = await uploadFile()

		expect(result.data).toBeNull()
		expect(result.error?.message).toBe('URL creation failed')
	})
})
