import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUrlModifier, lookupUri, sourceName, TempUrls } from './resolve'

let created = 0

beforeEach(() => {
	vi.spyOn(URL, 'createObjectURL').mockImplementation(
		() => `blob:http://localhost/object-${++created}`
	)
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('sourceName', () => {
	it('uses a file name', () => {
		expect(sourceName(new File([''], 'chair.obj'))).toBe('chair.obj')
	})

	it('prefers an explicit filename over the URL', () => {
		expect(sourceName({ url: 'https://example.com/x.gltf', filename: 'Coffee Cart' })).toBe(
			'Coffee Cart'
		)
	})

	it('falls back to the last segment of the URL', () => {
		expect(sourceName({ url: 'https://example.com/models/1k/chair.gltf' })).toBe('chair.gltf')
	})

	it('drops the query string and decodes escapes', () => {
		expect(sourceName({ url: 'https://example.com/my%20chair.gltf?token=abc' })).toBe(
			'my chair.gltf'
		)
	})

	it('falls back to the whole URL when there is no last segment', () => {
		expect(sourceName({ url: 'https://example.com/' })).toBe('https://example.com/')
	})
})

describe('TempUrls', () => {
	it('revokes every URL it minted, once', () => {
		const temp = new TempUrls()
		const first = temp.create(new Blob(['a']))
		const second = temp.create(new Blob(['b']))

		temp.revokeAll()

		expect(URL.revokeObjectURL).toHaveBeenCalledWith(first)
		expect(URL.revokeObjectURL).toHaveBeenCalledWith(second)
		expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)

		temp.revokeAll()

		expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
	})
})

describe('createUrlModifier', () => {
	const baseUrl = 'blob:http://localhost/1a2b3c'

	function modifierFor(resolve: Parameters<typeof createUrlModifier>[0]['resolve']) {
		const temp = new TempUrls()
		return { modify: createUrlModifier({ baseUrl, resolve, temp }), temp }
	}

	it("never rewrites the asset's own URL", () => {
		const resolve = vi.fn()
		const { modify } = modifierFor(resolve)

		expect(modify(baseUrl)).toBe(baseUrl)
		expect(resolve).not.toHaveBeenCalled()
	})

	it('recovers the relative URI Three.js resolved against the blob base', () => {
		const resolve = vi.fn(() => 'https://cdn.example.com/wood.png')
		const { modify } = modifierFor(resolve)

		expect(modify('blob:http://localhost/textures/1k/wood.png')).toBe(
			'https://cdn.example.com/wood.png'
		)
		expect(resolve).toHaveBeenCalledWith('textures/1k/wood.png')
	})

	it('decodes percent-escapes before asking the resolver', () => {
		const resolve = vi.fn(() => null)
		const { modify } = modifierFor(resolve)

		modify('blob:http://localhost/my%20texture.png')

		expect(resolve).toHaveBeenCalledWith('my texture.png')
	})

	it('passes a URL through unchanged when it shares no base with the asset', () => {
		const resolve = vi.fn(() => null)
		const { modify } = modifierFor(resolve)

		expect(modify('https://elsewhere.example.com/wood.png')).toBe(
			'https://elsewhere.example.com/wood.png'
		)
		expect(resolve).toHaveBeenCalledWith('https://elsewhere.example.com/wood.png')
	})

	it('serves a resolved file from a temporary URL it owns', () => {
		const file = new File(['bytes'], 'wood.png')
		const { modify, temp } = modifierFor(() => file)

		const served = modify('blob:http://localhost/wood.png')

		expect(URL.createObjectURL).toHaveBeenCalledWith(file)
		expect(served).toMatch(/^blob:/)

		temp.revokeAll()

		expect(URL.revokeObjectURL).toHaveBeenCalledWith(served)
	})

	it('leaves a URI the resolver does not recognise untouched', () => {
		const { modify } = modifierFor(() => undefined)

		expect(modify('blob:http://localhost/missing.png')).toBe('blob:http://localhost/missing.png')
		expect(URL.createObjectURL).not.toHaveBeenCalled()
	})

	it('works against an http base as well as a blob one', () => {
		const temp = new TempUrls()
		const resolve = vi.fn(() => 'https://cdn.example.com/wood.png')
		const modify = createUrlModifier({
			baseUrl: 'https://example.com/models/1k/chair.gltf',
			resolve,
			temp
		})

		modify('https://example.com/models/1k/textures/wood.png')

		expect(resolve).toHaveBeenCalledWith('textures/wood.png')
	})
})

describe('lookupUri', () => {
	const map = new Map([
		['textures/wood.png', 'asset-1'],
		['model.bin', 'asset-2']
	])

	it('finds an exact match', () => {
		expect(lookupUri(map, 'textures/wood.png')).toBe('asset-1')
	})

	it('falls back to matching on the filename alone', () => {
		expect(lookupUri(map, 'wood.png')).toBe('asset-1')
		expect(lookupUri(map, 'other/dir/wood.png')).toBe('asset-1')
	})

	it('reports nothing when no entry matches', () => {
		expect(lookupUri(map, 'metal.png')).toBeUndefined()
	})

	it('does not confuse an empty map for a match', () => {
		expect(lookupUri(new Map<string, string>(), 'wood.png')).toBeUndefined()
	})
})
