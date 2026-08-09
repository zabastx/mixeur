/**
 * @fileoverview Project file encoding/decoding utilities for Mixeur's .mixeur format.
 * Uses MessagePack for binary serialization with CRC32 checksum for corruption detection.
 * @module shared/lib/project-file
 */

import { encode, decode } from '@msgpack/msgpack'
import { version } from '@/../package.json'
import type { WorldSnapshot } from '@/app/model/types/world'

/**
 * Magic bytes identifying a valid .mixeur project file.
 * Stored at the start of the encoded data.
 */
export const PROJECT_MAGIC = 'MIXEUR'

const MAGIC_BYTES = 6
const VERSION_BYTES = 1
const META_LENGTH_BYTES = 4
const CRC_BYTES = 4
const HEADER_SIZE = MAGIC_BYTES + VERSION_BYTES + META_LENGTH_BYTES

/**
 * Current version of the project file format.
 * Increment when breaking changes are introduced to ensure backward compatibility.
 */
export const PROJECT_VERSION = 1

/**
 * Metadata stored in project file header.
 */
interface ProjectMetadata {
	/** ISO timestamp when the project was created */
	createdAt: string
	/** Version of the Mixeur application that created the file */
	appVersion: string
}

/**
 * Scene data stored in project file.
 */
interface ProjectData {
	/** Serialized Three.js scene (from THREE.Scene.toJSON()) */
	scene: object
	/** UUID of the currently active render camera, or null if none */
	renderCameraUUID: string | null
	/**
	 * The scene's World. Carried separately because `Scene.toJSON()` serializes
	 * neither `background` nor `environment`.
	 *
	 * Optional: files written before the World existed have no block, and load
	 * with the default World rather than failing.
	 */
	world?: WorldSnapshot
}

/**
 * Complete structure of a .mixeur project file after decoding.
 */
export interface MxProjectFile {
	/** Magic bytes identifying file format */
	magic: string
	/** File format version */
	version: number
	/** Metadata about the project file */
	metadata: ProjectMetadata
	/** The actual scene data */
	data: ProjectData
}

const _crc32Table: number[] = (() => {
	const table: number[] = []
	for (let i = 0; i < 256; i++) {
		let c = i
		for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
		table.push(c >>> 0)
	}
	return table
})()

/**
 * Computes CRC32 checksum for a buffer.
 * Used for corruption detection in project files.
 *
 * @param buffer - The ArrayBuffer to compute checksum for
 * @param offset - Starting byte offset (default: 0)
 * @param length - Number of bytes to process, or undefined for entire buffer from offset
 * @returns 32-bit unsigned CRC value
 */
export function crc32(buffer: ArrayBuffer, offset = 0, length?: number): number {
	const view = new Uint8Array(buffer)
	const len = length ?? view.length
	let crc = 0xffffffff
	for (let i = offset; i < offset + len; i++) {
		crc = (crc >>> 8) ^ _crc32Table[(crc ^ view[i]) & 0xff]
	}
	return (crc ^ 0xffffffff) >>> 0
}

/**
 * Encodes project data into a binary .mixeur file format.
 *
 * The output format is:
 * [MAGIC(6)][VERSION(1)][META_LEN(4)][META_MSGPACK][DATA_MSGPACK][CRC32(4)]
 *
 * @param data - Project data to encode (scene + renderCameraUUID)
 * @returns Binary Uint8Array ready for file download
 * @example
 * ```typescript
 * const data = { scene: scene.toJSON(), renderCameraUUID: camera.uuid };
 * const binary = encodeProject(data);
 * // Save to file...
 * ```
 */
export function encodeProject(data: ProjectData): Uint8Array {
	const metadata: ProjectMetadata = {
		createdAt: new Date().toISOString(),
		appVersion: version
	}

	const encodedMetadata = encode(metadata)
	const metaBytes =
		encodedMetadata instanceof Uint8Array ? encodedMetadata : new Uint8Array(encodedMetadata)
	const encodedData = encode(data)
	const dataBytes = encodedData instanceof Uint8Array ? encodedData : new Uint8Array(encodedData)

	const magicBytes = new TextEncoder().encode(PROJECT_MAGIC)
	const versionByte = new Uint8Array([PROJECT_VERSION])

	const metaLenBuffer = new ArrayBuffer(META_LENGTH_BYTES)
	const metaLenView = new DataView(metaLenBuffer)
	metaLenView.setUint32(0, metaBytes.length, true)

	const metaLenBytes = new Uint8Array(metaLenBuffer)

	const headerPart = new Uint8Array(HEADER_SIZE)
	headerPart.set(magicBytes, 0)
	headerPart.set(versionByte, MAGIC_BYTES)
	headerPart.set(metaLenBytes, MAGIC_BYTES + VERSION_BYTES)

	const crcInput = new Uint8Array(headerPart.length + metaBytes.length + dataBytes.length)
	crcInput.set(headerPart, 0)
	crcInput.set(metaBytes, headerPart.length)
	crcInput.set(dataBytes, headerPart.length + metaBytes.length)

	const checksum = crc32(crcInput.buffer)
	const checksumBytes = new Uint8Array(4)
	new DataView(checksumBytes.buffer).setUint32(0, checksum, true)

	const result = new Uint8Array(crcInput.length + 4)
	result.set(crcInput, 0)
	result.set(checksumBytes, crcInput.length)

	return result
}

/**
 * Decodes a binary .mixeur file back into project data.
 * Validates checksum, magic bytes, and data integrity before returning.
 *
 * @param buffer - Binary data from a .mixeur file
 * @returns Decoded project file structure
 * @throws Error if file is corrupted, invalid, or truncated
 * @example
 * ```typescript
 * try {
 *   const project = decodeProject(fileBuffer);
 *   // Load scene...
 * } catch (e) {
 *   // Handle invalid file
 * }
 * ```
 */
export function decodeProject(buffer: ArrayBuffer): MxProjectFile {
	const storedChecksum = new DataView(buffer, buffer.byteLength - 4, 4).getUint32(0, true)
	const computedChecksum = crc32(buffer, 0, buffer.byteLength - 4)

	if (storedChecksum !== computedChecksum) {
		throw new Error(
			`Project file is corrupted: checksum mismatch (stored: ${storedChecksum}, computed: ${computedChecksum})`
		)
	}

	if (readMagic(buffer) !== PROJECT_MAGIC) {
		throw new Error('Invalid project file: not a .mixeur file')
	}

	const metaLength = new DataView(buffer, MAGIC_BYTES + VERSION_BYTES, META_LENGTH_BYTES).getUint32(
		0,
		true
	)
	const metaStart = HEADER_SIZE
	const dataStart = HEADER_SIZE + metaLength

	if (dataStart > buffer.byteLength - 4) {
		throw new Error('Invalid project file: truncated data')
	}

	const metadata = decode(buffer.slice(metaStart, dataStart)) as ProjectMetadata
	const data = decode(buffer.slice(dataStart, buffer.byteLength - 4)) as ProjectData

	return {
		magic: PROJECT_MAGIC,
		version: PROJECT_VERSION,
		metadata,
		data
	}
}

/**
 * Extracts project metadata from a .mixeur file without full decoding.
 * Validates header structure and attempts to decode metadata/data slices.
 *
 * @param buffer - Binary data from a .mixeur file
 * @returns Object with version, createdAt, and appVersion, or null if invalid
 */
export function getProjectInfo(
	buffer: ArrayBuffer
): { version: number; createdAt: string; appVersion: string } | null {
	try {
		if (buffer.byteLength < HEADER_SIZE + CRC_BYTES) return null

		if (readMagic(buffer) !== PROJECT_MAGIC) return null

		const fileVersion = new Uint8Array(buffer)[MAGIC_BYTES]
		const metaLength = new DataView(
			buffer,
			MAGIC_BYTES + VERSION_BYTES,
			META_LENGTH_BYTES
		).getUint32(0, true)

		if (metaLength === 0) return null

		const dataStart = HEADER_SIZE + metaLength
		const dataEnd = buffer.byteLength - CRC_BYTES
		if (dataStart >= dataEnd) return null

		const metadata = decode(buffer.slice(HEADER_SIZE, dataStart)) as ProjectMetadata
		decode(buffer.slice(dataStart, dataEnd))

		if (typeof metadata?.createdAt !== 'string' || typeof metadata?.appVersion !== 'string')
			return null

		return {
			version: fileVersion,
			createdAt: metadata.createdAt,
			appVersion: metadata.appVersion
		}
	} catch {
		return null
	}
}

function readMagic(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer, 0, MAGIC_BYTES))
		.map((b) => String.fromCharCode(b))
		.join('')
}

// function migrateProject(project: MxProjectFile): MxProjectFile {
// 	if (project.version === PROJECT_VERSION) return project
// 	return { ...project, version: PROJECT_VERSION }
// }
