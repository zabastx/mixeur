/**
 * Format detection by content rather than by file extension, plus extraction of
 * the relative URIs an asset references. Pure byte inspection — no Three.js, no
 * DOM beyond `File`.
 */

import { uriExtension } from './uri'

export type ModelFormat = 'glb' | 'gltf' | 'obj' | 'fbx'

export interface ModelAssets {
	format: ModelFormat | 'asset'
	uris: string[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface FileHead {
	bytes: Uint8Array
	text: string
	buffer: ArrayBuffer
}

async function readFile(file: File, size = 512): Promise<FileHead> {
	const buffer = await file.slice(0, size).arrayBuffer()
	const bytes = new Uint8Array(buffer)
	const text = new TextDecoder().decode(buffer)
	return { bytes, text, buffer }
}

function isRelativeUri(uri: string): boolean {
	return !uri.startsWith('data:') && !uri.startsWith('http://') && !uri.startsWith('https://')
}

// ── Format detection ───────────────────────────────────

function detectGLB({ buffer }: FileHead): boolean {
	const view = new DataView(buffer)
	return view.getUint32(0, false) === 0x676c5446 // glTF
}

function detectGLTF({ text }: FileHead): boolean {
	const trimmed = text.trimStart()
	return trimmed.startsWith('{') && trimmed.includes('"asset"')
}

function detectOBJ({ text }: FileHead): boolean {
	const prefixes = ['v ', 'vt ', 'vn ', 'f ', 'mtllib ', 'usemtl ', 'o ', 'g ']
	const lines = text.split('\n').map((l) => l.trimStart())
	return lines.some((line) => prefixes.some((p) => line.startsWith(p)))
}

function detectFBX(head: FileHead): boolean {
	if (head.text.trimStart().startsWith('; FBX')) return true
	return isBinaryFBX(head)
}

export function detectMTL({ text }: Pick<FileHead, 'text'>): boolean {
	const prefixes = [
		'newmtl ',
		'Ka ',
		'Kd ',
		'Ks ',
		'Ke ',
		'Ns ',
		'Ni ',
		'd ',
		'illum ',
		'map_Kd ',
		'map_Ks ',
		'map_Bump ',
		'bump ',
		'norm '
	]
	const lines = text.split('\n').map((l) => l.trimStart())
	return lines.some((line) => prefixes.some((p) => line.startsWith(p)))
}

// ── URI extraction ─────────────────────────────────────────────────────────────
interface GLTFBuffer {
	uri?: string
}

interface GLTFImage {
	uri?: string
}

interface GLTFJson {
	asset: {
		version: string
	}
	buffers?: GLTFBuffer[]
	images?: GLTFImage[]
}

function isGLTFJson(json: unknown): json is GLTFJson {
	return (
		typeof json === 'object' &&
		json !== null &&
		'asset' in json &&
		typeof (json as GLTFJson).asset?.version === 'string'
	)
}

function extractGLBJson(bytes: Uint8Array): unknown {
	// GLB header: magic(4) + version(4) + length(4) = 12 bytes
	// Chunk 0 header: chunkLength(4) + chunkType(4) = 8 bytes, then JSON data
	const chunkLength = bytes[12] | (bytes[13] << 8) | (bytes[14] << 16) | (bytes[15] << 24)

	const jsonBytes = bytes.slice(20, 20 + chunkLength)
	try {
		return JSON.parse(new TextDecoder().decode(jsonBytes))
	} catch {
		return null
	}
}

/** glTF names its dependencies the same way whether the JSON was embedded or standalone. */
function collectGLTFUris(json: unknown): string[] {
	if (!isGLTFJson(json)) return []

	const uris: string[] = []
	json.buffers?.forEach((b) => b.uri && uris.push(b.uri))
	json.images?.forEach((i) => i.uri && uris.push(i.uri))

	return [...new Set(uris)].filter(isRelativeUri)
}

async function extractGLBUris(file: File): Promise<string[]> {
	const { bytes } = await readFile(file, file.size)
	return collectGLTFUris(extractGLBJson(bytes))
}

async function extractGLTFUris(file: File): Promise<string[]> {
	try {
		return collectGLTFUris(JSON.parse(await file.text()))
	} catch {
		return []
	}
}

function extractOBJUris({ text }: FileHead): string[] {
	// mtllib can appear multiple times and list multiple files per line:
	// "mtllib a.mtl b.mtl"
	const uris: string[] = []
	for (const line of text.split('\n')) {
		const trimmed = line.trim()
		if (trimmed.startsWith('mtllib ')) {
			const names = trimmed.slice(7).trim().split(/\s+/)
			uris.push(...names)
		}
	}
	return [...new Set(uris)]
}

function isBinaryFBX({ bytes }: FileHead): boolean {
	const magic = 'Kaydara FBX Binary  '
	return [...magic].every((c, i) => bytes[i] === c.charCodeAt(0)) && bytes[20] === 0x00
}

function extractBinaryFBXUris({ bytes }: FileHead): string[] {
	const key = 'RelativeFilename'
	const keyBytes = [...key].map((c) => c.charCodeAt(0))
	const uris: string[] = []

	for (let i = 0; i < bytes.length - key.length - 5; i++) {
		// Match "RelativeFilename" followed by "S" (string type marker)
		const matchesKey = keyBytes.every((b, j) => bytes[i + j] === b)
		if (!matchesKey) continue
		if (bytes[i + key.length] !== 0x53) continue // 'S'

		// Read 4-byte LE length
		const lenOffset = i + key.length + 1
		const len =
			bytes[lenOffset] |
			(bytes[lenOffset + 1] << 8) |
			(bytes[lenOffset + 2] << 16) |
			(bytes[lenOffset + 3] << 24)

		// Read string and normalise Windows separators
		const strOffset = lenOffset + 4
		if (strOffset + len > bytes.length) continue
		const value = new TextDecoder().decode(bytes.slice(strOffset, strOffset + len))
		uris.push(value.replace(/\\/g, '/'))
	}

	return [...new Set(uris)].filter(isRelativeUri)
}

function extractFBXUris(head: FileHead): string[] {
	if (isBinaryFBX(head)) return extractBinaryFBXUris(head)

	// Text FBX
	const uris: string[] = []
	const re = /RelativeFilename:\s*"([^"]+)"/g
	let match: RegExpExecArray | null
	while ((match = re.exec(head.text)) !== null) {
		uris.push(match[1].replace(/\\/g, '/'))
	}
	return [...new Set(uris)].filter(isRelativeUri)
}

async function extractMTLUris({ text }: FileHead): Promise<string[]> {
	const directives = [
		'map_Kd',
		'map_Ks',
		'map_Ns',
		'map_Ka',
		'map_d',
		'map_bump',
		'bump',
		'norm',
		'disp',
		'decal',
		'refl',
		'map_Pr',
		'map_Pm',
		'map_Ke',
		'map_RMA'
	]
	const uris: string[] = []

	for (const line of text.split('\n')) {
		const trimmed = line.trim()
		const directive = directives.find((d) =>
			trimmed.toLowerCase().startsWith(d.toLowerCase() + ' ')
		)
		if (directive) {
			// map directives can have options like "-bm 1.0 texture.png" — filename is always last
			const parts = trimmed.slice(directive.length).trim().split(/\s+/)
			uris.push(parts[parts.length - 1])
		}
	}

	return [...new Set(uris)].filter(isRelativeUri)
}

export async function analyzeModelFile(file: File): Promise<ModelAssets | null> {
	try {
		const head = await readFile(file)

		if (detectGLB(head)) {
			return { format: 'glb', uris: await extractGLBUris(file) }
		}

		if (detectGLTF(head)) {
			return { format: 'gltf', uris: await extractGLTFUris(file) }
		}

		if (detectOBJ(head)) {
			const full = await readFile(file, file.size)
			return { format: 'obj', uris: extractOBJUris(full) }
		}

		if (detectFBX(head)) {
			const full = await readFile(file, file.size)
			return { format: 'fbx', uris: extractFBXUris(full) }
		}

		if (detectMTL(head)) {
			const full = await readFile(file, file.size)
			return { format: 'asset', uris: await extractMTLUris(full) }
		}

		return { format: 'asset', uris: [] }
	} catch {
		return null
	}
}

// ── Detection for sources that are only a URL ──────────────────────────────────

const MODEL_EXTENSIONS = new Map<string, ModelFormat>([
	['glb', 'glb'],
	['gltf', 'gltf'],
	['obj', 'obj'],
	['fbx', 'fbx']
])

/**
 * A URL's bytes are not available before the transfer, so its format has to
 * come from the extension. Returns `null` when the extension names no model
 * format we can load.
 */
export function modelFormatFromUrl(url: string): ModelFormat | null {
	return MODEL_EXTENSIONS.get(uriExtension(url)) ?? null
}

export function isEXRUrl(url: string): boolean {
	return uriExtension(url) === 'exr'
}

/** Whether `file` is an OpenEXR image, by its magic number. */
export async function isEXRFile(file: File): Promise<boolean> {
	if (file.size < EXR_MAGIC.length) return isEXRUrl(file.name)
	const { bytes } = await readFile(file, EXR_MAGIC.length)
	return EXR_MAGIC.every((byte, i) => bytes[i] === byte)
}

const EXR_MAGIC = [0x76, 0x2f, 0x31, 0x01]
