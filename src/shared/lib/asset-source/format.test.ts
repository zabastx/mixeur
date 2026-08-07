import { describe, expect, it } from 'vitest'
import { analyzeModelFile, detectMTL, isEXRFile, isEXRUrl, modelFormatFromUrl } from './format'

function textFile(name: string, text: string) {
	return new File([text], name)
}

function binaryFile(name: string, bytes: number[]) {
	return new File([new Uint8Array(bytes)], name)
}

function ascii(text: string) {
	return [...text].map((c) => c.charCodeAt(0))
}

/** Wraps `json` in the GLB container: 12-byte header, then a JSON chunk. */
function glbFile(name: string, json: object) {
	const jsonBytes = ascii(JSON.stringify(json))
	const header = [
		...ascii('glTF'),
		2,
		0,
		0,
		0, // version
		0,
		0,
		0,
		0 // total length, unread
	]
	const chunkLength = jsonBytes.length
	const chunkHeader = [
		chunkLength & 0xff,
		(chunkLength >> 8) & 0xff,
		(chunkLength >> 16) & 0xff,
		(chunkLength >> 24) & 0xff,
		...ascii('JSON')
	]
	return binaryFile(name, [...header, ...chunkHeader, ...jsonBytes])
}

/** Encodes a binary-FBX `RelativeFilename` property: key, 'S', LE length, value. */
function relativeFilenameProperty(value: string) {
	const valueBytes = ascii(value)
	const len = valueBytes.length
	return [
		...ascii('RelativeFilename'),
		0x53, // 'S'
		len & 0xff,
		(len >> 8) & 0xff,
		(len >> 16) & 0xff,
		(len >> 24) & 0xff,
		...valueBytes
	]
}

function binaryFbxFile(name: string, properties: number[][]) {
	const header = [...ascii('Kaydara FBX Binary  '), 0x00, 0x1a, 0x00]
	// The scan stops `key.length + 5` bytes short of the end, so pad the tail.
	return binaryFile(name, [...header, ...properties.flat(), ...new Array(32).fill(0)])
}

describe('analyzeModelFile', () => {
	describe('GLB', () => {
		it('detects the container by its magic number, not its extension', async () => {
			const file = glbFile('model.bin', { asset: { version: '2.0' } })

			await expect(analyzeModelFile(file)).resolves.toEqual({ format: 'glb', uris: [] })
		})

		it('lists the buffers and images the JSON chunk references', async () => {
			const file = glbFile('model.glb', {
				asset: { version: '2.0' },
				buffers: [{ uri: 'model.bin' }],
				images: [{ uri: 'textures/diffuse.png' }]
			})

			await expect(analyzeModelFile(file)).resolves.toEqual({
				format: 'glb',
				uris: ['model.bin', 'textures/diffuse.png']
			})
		})

		it('ignores embedded and absolute references', async () => {
			const file = glbFile('model.glb', {
				asset: { version: '2.0' },
				buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }],
				images: [{ uri: 'https://example.com/diffuse.png' }, { uri: 'local.png' }]
			})

			await expect(analyzeModelFile(file)).resolves.toEqual({
				format: 'glb',
				uris: ['local.png']
			})
		})

		it('reports the format even when the JSON chunk cannot be parsed', async () => {
			const truncated = binaryFile('broken.glb', [
				...ascii('glTF'),
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				4,
				0,
				0,
				0,
				...ascii('JSON'),
				...ascii('{{{{')
			])

			await expect(analyzeModelFile(truncated)).resolves.toEqual({ format: 'glb', uris: [] })
		})
	})

	describe('glTF', () => {
		it('detects JSON with an asset block', async () => {
			const file = textFile('scene.gltf', JSON.stringify({ asset: { version: '2.0' } }))

			await expect(analyzeModelFile(file)).resolves.toEqual({ format: 'gltf', uris: [] })
		})

		it('lists referenced buffers and images once each', async () => {
			const file = textFile(
				'scene.gltf',
				JSON.stringify({
					asset: { version: '2.0' },
					buffers: [{ uri: 'scene.bin' }, { uri: 'scene.bin' }],
					images: [{ uri: 'tex/wood.jpg' }, {}]
				})
			)

			await expect(analyzeModelFile(file)).resolves.toEqual({
				format: 'gltf',
				uris: ['scene.bin', 'tex/wood.jpg']
			})
		})

		it('falls through to "asset" for JSON that is not a glTF document', async () => {
			const file = textFile('data.json', JSON.stringify({ hello: 'world' }))

			await expect(analyzeModelFile(file)).resolves.toEqual({ format: 'asset', uris: [] })
		})
	})

	describe('OBJ', () => {
		it('detects geometry directives', async () => {
			const file = textFile('cube.obj', 'v 0 0 0\nv 1 0 0\nf 1 2 3\n')

			await expect(analyzeModelFile(file)).resolves.toEqual({ format: 'obj', uris: [] })
		})

		it('collects every mtllib name, including several on one line', async () => {
			const file = textFile('cube.obj', 'mtllib a.mtl b.mtl\nv 0 0 0\nmtllib c.mtl\nmtllib a.mtl\n')

			await expect(analyzeModelFile(file)).resolves.toEqual({
				format: 'obj',
				uris: ['a.mtl', 'b.mtl', 'c.mtl']
			})
		})

		it('finds directives that are not on the first line', async () => {
			const file = textFile('cube.obj', '# exported by something\n\no cube\nv 0 0 0\n')

			await expect(analyzeModelFile(file)).resolves.toMatchObject({ format: 'obj' })
		})
	})

	describe('FBX', () => {
		it('detects the ASCII variant by its comment header', async () => {
			const file = textFile('scene.fbx', '; FBX 7.3.0 project file\n')

			await expect(analyzeModelFile(file)).resolves.toEqual({ format: 'fbx', uris: [] })
		})

		it('reads RelativeFilename entries from ASCII FBX and normalises separators', async () => {
			const file = textFile(
				'scene.fbx',
				'; FBX 7.3.0 project file\n' +
					'RelativeFilename: "textures\\wood.png"\n' +
					'RelativeFilename: "textures/metal.png"\n'
			)

			await expect(analyzeModelFile(file)).resolves.toEqual({
				format: 'fbx',
				uris: ['textures/wood.png', 'textures/metal.png']
			})
		})

		it('detects the binary variant by its Kaydara magic', async () => {
			const file = binaryFbxFile('scene.fbx', [])

			await expect(analyzeModelFile(file)).resolves.toEqual({ format: 'fbx', uris: [] })
		})

		it('reads RelativeFilename properties out of binary FBX', async () => {
			const file = binaryFbxFile('scene.fbx', [
				relativeFilenameProperty('textures\\wood.png'),
				relativeFilenameProperty('textures/metal.png'),
				relativeFilenameProperty('textures/wood.png')
			])

			await expect(analyzeModelFile(file)).resolves.toEqual({
				format: 'fbx',
				uris: ['textures/wood.png', 'textures/metal.png']
			})
		})
	})

	describe('MTL', () => {
		it('classifies a material library as an asset and lists its maps', async () => {
			const file = textFile(
				'cube.mtl',
				'newmtl body\nKd 1 1 1\nmap_Kd textures/body.png\nmap_Bump -bm 1.0 textures/body_n.png\n'
			)

			await expect(analyzeModelFile(file)).resolves.toEqual({
				format: 'asset',
				uris: ['textures/body.png', 'textures/body_n.png']
			})
		})

		it('ignores absolute map references', async () => {
			const file = textFile('cube.mtl', 'newmtl body\nmap_Kd https://example.com/body.png\n')

			await expect(analyzeModelFile(file)).resolves.toEqual({ format: 'asset', uris: [] })
		})
	})

	it('classifies anything unrecognised as a plain asset', async () => {
		await expect(analyzeModelFile(textFile('notes.txt', 'hello'))).resolves.toEqual({
			format: 'asset',
			uris: []
		})
	})

	it('reports nothing for a file it cannot read', async () => {
		const unreadable = {
			name: 'broken.glb',
			size: 10,
			slice: () => ({
				arrayBuffer: () => Promise.reject(new Error('unreadable'))
			})
		} as unknown as File

		await expect(analyzeModelFile(unreadable)).resolves.toBeNull()
	})
})

describe('detectMTL', () => {
	it('accepts a material library', () => {
		expect(detectMTL({ text: 'newmtl body\nKd 1 1 1\n' })).toBe(true)
	})

	it('rejects a file the user mapped into an mtllib slot by mistake', () => {
		expect(detectMTL({ text: 'v 0 0 0\nf 1 2 3\n' })).toBe(false)
	})
})

describe('modelFormatFromUrl', () => {
	it.each([
		['https://example.com/a/model.glb', 'glb'],
		['https://example.com/a/model.gltf', 'gltf'],
		['/models/chair.OBJ', 'obj'],
		['chair.fbx', 'fbx']
	])('reads %s as %s', (url, format) => {
		expect(modelFormatFromUrl(url)).toBe(format)
	})

	it('ignores a query string and fragment', () => {
		expect(modelFormatFromUrl('https://example.com/model.glb?v=2#frag')).toBe('glb')
	})

	it('returns null when the extension names no model format', () => {
		expect(modelFormatFromUrl('https://example.com/readme')).toBeNull()
		expect(modelFormatFromUrl('https://example.com/texture.png')).toBeNull()
	})
})

describe('EXR detection', () => {
	it('recognises the magic number regardless of filename', async () => {
		const file = binaryFile('sunset.bin', [0x76, 0x2f, 0x31, 0x01, 0x02, 0x00, 0x00, 0x00])

		await expect(isEXRFile(file)).resolves.toBe(true)
	})

	it('rejects a file whose bytes are not EXR even when named .exr', async () => {
		const file = binaryFile('fake.exr', [0x89, 0x50, 0x4e, 0x47, 0x00, 0x00])

		await expect(isEXRFile(file)).resolves.toBe(false)
	})

	it('falls back to the name for a file too short to hold the magic number', async () => {
		await expect(isEXRFile(binaryFile('tiny.exr', [0x76]))).resolves.toBe(true)
		await expect(isEXRFile(binaryFile('tiny.png', [0x76]))).resolves.toBe(false)
	})

	it('reads a URL by extension', () => {
		expect(isEXRUrl('https://example.com/sky_1k.exr')).toBe(true)
		expect(isEXRUrl('https://example.com/sky_1k.EXR?token=1')).toBe(true)
		expect(isEXRUrl('https://example.com/sky_1k.png')).toBe(false)
	})
})
