import { describe, expect, it } from 'vitest'
import { decodeUri, uriExtension, uriFilename } from './uri'

describe('uriFilename', () => {
	it('keeps a bare filename', () => {
		expect(uriFilename('wood.png')).toBe('wood.png')
	})

	it('strips directories, query strings and fragments', () => {
		expect(uriFilename('textures/1k/wood.png?v=2#a')).toBe('wood.png')
	})

	it('decodes percent-escapes', () => {
		expect(uriFilename('textures/my%20wood.png')).toBe('my wood.png')
	})

	it('leaves an undecodable escape alone', () => {
		expect(uriFilename('100%.png')).toBe('100%.png')
	})

	it('is empty for a URI that ends in a separator', () => {
		expect(uriFilename('https://example.com/models/')).toBe('')
	})
})

describe('uriExtension', () => {
	it('lowercases the extension', () => {
		expect(uriExtension('CHAIR.GLTF')).toBe('gltf')
	})

	it('ignores a query string and fragment', () => {
		expect(uriExtension('https://example.com/sky.exr?token=1#a')).toBe('exr')
	})

	it('takes only the last extension', () => {
		expect(uriExtension('archive.tar.gz')).toBe('gz')
	})

	it('is empty when there is no extension', () => {
		expect(uriExtension('https://example.com/readme')).toBe('')
	})

	it('is not fooled by a dot in a parent directory', () => {
		expect(uriExtension('https://example.com/v1.2/readme')).toBe('')
	})
})

describe('decodeUri', () => {
	it('decodes what it can and passes through what it cannot', () => {
		expect(decodeUri('a%20b')).toBe('a b')
		expect(decodeUri('100%')).toBe('100%')
	})
})
