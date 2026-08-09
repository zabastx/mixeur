import { describe, expect, it } from 'vitest'
import { hdriOptions, isHDRISelection, type HDRISelection } from './hdri'
import type { HDRIFiles } from './types/polyhaven'

function file(url: string, size = 1024) {
	return { url, size, md5: 'd41d8cd98f00b204e9800998ecf8427e' }
}

/** A payload shaped like Poly Haven's `/files/{id}` answer for an HDRI. */
function files(overrides: Partial<HDRIFiles['hdri']> = {}): HDRIFiles {
	return {
		hdri: {
			'1k': {
				hdr: file('https://example.com/a_1k.hdr'),
				exr: file('https://example.com/a_1k.exr')
			},
			'2k': { hdr: file('https://example.com/a_2k.hdr', 2048) },
			'4k': { hdr: file('https://example.com/a_4k.hdr', 4096) },
			'8k': { hdr: file('https://example.com/a_8k.hdr', 8192) },
			...overrides
		}
	}
}

describe('hdriOptions', () => {
	it('offers 1k, 2k and 4k, in that order', () => {
		const options = hdriOptions(files())

		expect(options.map((option) => option.resolution)).toEqual(['1k', '2k', '4k'])
	})

	it('leaves out resolutions this browser does not offer', () => {
		// 8k and up are a 100 MB download for a backdrop; nothing in the app asks
		// for one, and offering it would be the easiest way to hang a session.
		const options = hdriOptions(files())

		expect(options.map((option) => String(option.resolution))).not.toContain('8k')
	})

	it('takes the .hdr of each resolution, never the .exr', () => {
		const options = hdriOptions(files())

		expect(options[0]?.url).toBe('https://example.com/a_1k.hdr')
	})

	it('reports the byte count, so the download can be shown before it starts', () => {
		const options = hdriOptions(files())

		expect(options[1]).toMatchObject({ resolution: '2k', size: 2048 })
	})

	it('skips a resolution offered in no format this app reads', () => {
		const options = hdriOptions(files({ '2k': { exr: file('https://example.com/a_2k.exr') } }))

		expect(options.map((option) => option.resolution)).toEqual(['1k', '4k'])
	})

	it('is empty for a payload carrying no HDRI files at all', () => {
		expect(hdriOptions({ hdri: {} })).toEqual([])
		expect(hdriOptions({} as HDRIFiles)).toEqual([])
	})
})

describe('isHDRISelection', () => {
	const selection: HDRISelection = {
		id: 'kloofendal_43d_clear',
		name: 'Kloofendal 43d Clear',
		resolution: '2k',
		url: 'https://example.com/a_2k.hdr',
		size: 2048
	}

	it('accepts what the browser hands back', () => {
		expect(isHDRISelection(selection)).toBe(true)
	})

	it('rejects anything missing a field the World needs to restore itself', () => {
		expect(isHDRISelection({ ...selection, url: undefined })).toBe(false)
		expect(isHDRISelection({ ...selection, id: 42 })).toBe(false)
		expect(isHDRISelection({ ...selection, size: '2048' })).toBe(false)
		expect(isHDRISelection(null)).toBe(false)
		expect(isHDRISelection('kloofendal')).toBe(false)
	})
})
