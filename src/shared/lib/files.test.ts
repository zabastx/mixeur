import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadFile } from './files'

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
