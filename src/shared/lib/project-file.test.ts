import { describe, it, expect } from 'vitest'
import {
	encodeProject,
	decodeProject,
	getProjectInfo,
	PROJECT_MAGIC,
	PROJECT_VERSION,
	crc32
} from './project-file'

describe('crc32', () => {
	const bytes = (...values: number[]) => new Uint8Array(values).buffer as ArrayBuffer
	const ascii = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer

	it('matches the standard CRC-32 check value', () => {
		expect(crc32(ascii('123456789'))).toBe(0xcbf43926)
	})

	it('checksums an empty buffer to 0', () => {
		expect(crc32(bytes())).toBe(0)
	})

	it('matches the zlib checksum of bytes 1 to 5', () => {
		expect(crc32(bytes(1, 2, 3, 4, 5))).toBe(1191942644)
	})

	it('checksums a slice the same as the slice alone', () => {
		const buffer = ascii('xx123456789yy')

		expect(crc32(buffer, 2, 9)).toBe(0xcbf43926)
	})

	it('checksums from the offset to the end when no length is given', () => {
		const buffer = ascii('xx123456789')

		expect(crc32(buffer, 2)).toBe(0xcbf43926)
	})
})

describe('encodeProject', () => {
	it('creates valid binary output', () => {
		const data = {
			scene: { object: { uuid: 'test-uuid' } },
			renderCameraUUID: null
		}

		const result = encodeProject(data)

		expect(result.byteLength).toBeGreaterThan(0)
		// Verify 4-byte checksum is appended at end
		const checksumIndex = result.length - 4
		expect(result[checksumIndex]).toBeDefined()
	})

	it('includes scene data in encoded output', () => {
		const data = {
			scene: { geometries: [], materials: [] },
			renderCameraUUID: 'camera-uuid-123'
		}

		const result = encodeProject(data)

		expect(result.byteLength).toBeGreaterThan(4)
	})

	it('produces different output for different data', () => {
		const data1 = { scene: { geometries: [] }, renderCameraUUID: null }
		const data2 = { scene: { geometries: [{ uuid: 'test' }] }, renderCameraUUID: 'camera-123' }

		const result1 = encodeProject(data1)
		const result2 = encodeProject(data2)

		expect(result1).not.toEqual(result2)
	})

	it('produces binary with minimum size', () => {
		const data = { scene: { geometries: [] }, renderCameraUUID: null }

		const result = encodeProject(data)

		expect(result.byteLength).toBeGreaterThan(50)
	})

	it('produces output with checksum at end', () => {
		const data = { scene: {}, renderCameraUUID: null }

		const result = encodeProject(data)

		expect(result.byteLength).toBeGreaterThan(4)
		const checksumBytes = result.slice(-4)
		expect(checksumBytes.byteLength).toBe(4)
	})
})

describe('decodeProject', () => {
	it('decodes valid file correctly', () => {
		const originalData = {
			scene: { object: { uuid: 'test-uuid', name: 'Test Object' } },
			renderCameraUUID: 'camera-uuid-123'
		}

		const encoded = encodeProject(originalData)
		const decoded = decodeProject(encoded.buffer as ArrayBuffer)

		expect(decoded.magic).toBe(PROJECT_MAGIC)
		expect(decoded.version).toBe(PROJECT_VERSION)
		expect(decoded.data.scene).toEqual(originalData.scene)
		expect(decoded.data.renderCameraUUID).toBe(originalData.renderCameraUUID)
	})

	it('round-trip: encode → decode produces original data', () => {
		const originalData = {
			scene: {
				geometries: [{ uuid: 'geo-1', type: 'BoxGeometry' }],
				materials: [{ uuid: 'mat-1', type: 'MeshStandardMaterial' }]
			},
			renderCameraUUID: 'camera-123'
		}

		const encoded = encodeProject(originalData)
		const decoded = decodeProject(encoded.buffer as ArrayBuffer)

		expect(decoded.data).toEqual(originalData)
	})

	it('throws error on corrupted checksum', () => {
		const data = { scene: {}, renderCameraUUID: null }
		const encoded = encodeProject(data)

		const corrupted = new Uint8Array(encoded)
		corrupted[10] = corrupted[10] ^ 0xff

		expect(() => decodeProject(corrupted.buffer)).toThrow('corrupted')
	})

	it('throws error on invalid magic', () => {
		const data = { scene: {}, renderCameraUUID: null }
		const encoded = encodeProject(data)

		const decodedBeforeCorruption = decodeProject(encoded.buffer as ArrayBuffer)
		expect(decodedBeforeCorruption.magic).toBe(PROJECT_MAGIC)

		const corrupted = new Uint8Array(encoded)
		corrupted[1] = corrupted[1] ^ 0xff

		expect(() => decodeProject(corrupted.buffer)).toThrow()
	})

	it('includes version in output', () => {
		const data = { scene: {}, renderCameraUUID: null }
		const encoded = encodeProject(data)

		const decoded = decodeProject(encoded.buffer as ArrayBuffer)
		expect(decoded.version).toBe(PROJECT_VERSION)
		expect(typeof decoded.version).toBe('number')
	})

	it('handles null renderCameraUUID', () => {
		const data = { scene: { name: 'Scene' }, renderCameraUUID: null }

		const encoded = encodeProject(data)
		const decoded = decodeProject(encoded.buffer as ArrayBuffer)

		expect(decoded.data.renderCameraUUID).toBeNull()
	})

	it('handles empty scene', () => {
		const data = { scene: {}, renderCameraUUID: null }

		const encoded = encodeProject(data)
		const decoded = decodeProject(encoded.buffer as ArrayBuffer)

		expect(decoded.data.scene).toEqual({})
	})

	it('rejects invalid magic via decode', () => {
		const data = { scene: {}, renderCameraUUID: null }
		const encoded = encodeProject(data)

		const encodedArray = new Uint8Array(encoded)
		// Corrupt magic bytes (first 6 bytes) - indices vary due to MessagePack encoding
		const magicIndex = 0
		encodedArray[magicIndex] = 0
		encodedArray[magicIndex + 1] = 0
		encodedArray[magicIndex + 2] = 0
		encodedArray[magicIndex + 3] = 0
		encodedArray[magicIndex + 4] = 0
		encodedArray[magicIndex + 5] = 0

		// Recompute checksum after corruption
		const checksum = crc32(encodedArray.buffer, 0, encodedArray.byteLength - 4)
		const checksumView = new DataView(encodedArray.buffer, encodedArray.byteLength - 4, 4)
		checksumView.setUint32(0, checksum, true)

		expect(() => decodeProject(encodedArray.buffer)).toThrow()
	})
})

describe('getProjectInfo', () => {
	it('extracts metadata from valid file', () => {
		const data = { scene: {}, renderCameraUUID: null }
		const encoded = encodeProject(data)

		const info = getProjectInfo(encoded.buffer as ArrayBuffer)

		expect(info).not.toBeNull()
		expect(info?.version).toBe(PROJECT_VERSION)
		expect(info?.createdAt).toBeDefined()
		expect(info?.appVersion).toBeDefined()
	})

	it('returns null on corrupted file', () => {
		const data = { scene: {}, renderCameraUUID: null }
		const encoded = encodeProject(data)

		const corrupted = new Uint8Array(encoded)
		corrupted[10] = corrupted[10] ^ 0xff

		const info = getProjectInfo(corrupted.buffer)

		expect(info).toBeNull()
	})

	it('returns null on corrupted data', () => {
		const data = { scene: {}, renderCameraUUID: null }
		const encoded = encodeProject(data)

		const corrupted = new Uint8Array(encoded)
		corrupted[1] = corrupted[1] ^ 0xff

		const info = getProjectInfo(corrupted.buffer)

		expect(info).toBeNull()
	})

	it('returns null on truncated file', () => {
		const data = { scene: {}, renderCameraUUID: null }
		const encoded = encodeProject(data)

		const truncated = encoded.slice(0, encoded.length - 1)

		const info = getProjectInfo(truncated.buffer)

		expect(info).toBeNull()
	})

	it('returns null on too short buffer', () => {
		const shortBuffer = new ArrayBuffer(3)
		const info = getProjectInfo(shortBuffer)

		expect(info).toBeNull()
	})
})
