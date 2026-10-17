import { describe, it, expect, vi, afterEach } from 'vitest'
import { version as appVersion } from '@/../package.json'
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
	it('lays out magic, version, and a trailing little-endian CRC-32 of the preceding bytes', () => {
		const result = encodeProject({ scene: {}, renderCameraUUID: null })

		const magic = new TextDecoder().decode(result.subarray(0, PROJECT_MAGIC.length))
		const storedChecksum = new DataView(result.buffer, result.byteLength - 4).getUint32(0, true)

		expect(magic).toBe(PROJECT_MAGIC)
		expect(result[PROJECT_MAGIC.length]).toBe(PROJECT_VERSION)
		expect(storedChecksum).toBe(crc32(result.buffer as ArrayBuffer, 0, result.byteLength - 4))
	})

	it('produces different output for different data', () => {
		const data1 = { scene: { geometries: [] }, renderCameraUUID: null }
		const data2 = { scene: { geometries: [{ uuid: 'test' }] }, renderCameraUUID: 'camera-123' }

		const result1 = encodeProject(data1)
		const result2 = encodeProject(data2)

		expect(result1).not.toEqual(result2)
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

		expect(() => decodeProject(corrupted.buffer)).toThrow(
			/^Project file is corrupted: checksum mismatch/
		)
	})

	it('rejects a bad magic number even when the checksum is valid', () => {
		const encoded = encodeProject({ scene: {}, renderCameraUUID: null })

		const corrupted = new Uint8Array(encoded)
		corrupted[1] = corrupted[1] ^ 0xff
		const checksum = crc32(corrupted.buffer, 0, corrupted.byteLength - 4)
		new DataView(corrupted.buffer, corrupted.byteLength - 4).setUint32(0, checksum, true)

		expect(() => decodeProject(corrupted.buffer)).toThrow(
			'Invalid project file: not a .mixeur file'
		)
	})

	it('includes version in output', () => {
		const data = { scene: {}, renderCameraUUID: null }
		const encoded = encodeProject(data)

		const decoded = decodeProject(encoded.buffer as ArrayBuffer)
		expect(decoded.version).toBe(PROJECT_VERSION)
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
})

describe('getProjectInfo', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it('extracts metadata from valid file', () => {
		vi.useFakeTimers({ now: new Date('2026-01-02T03:04:05.000Z') })
		const encoded = encodeProject({ scene: {}, renderCameraUUID: null })

		const info = getProjectInfo(encoded.buffer as ArrayBuffer)

		expect(info).toEqual({
			version: PROJECT_VERSION,
			createdAt: '2026-01-02T03:04:05.000Z',
			appVersion
		})
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
