import { test, expect } from '@playwright/test'

/**
 * The Draco and Basis decoders are fetched at runtime from `public/`, not
 * bundled, so nothing at build time notices if they go missing — the failure
 * shows up only when someone imports a compressed model, and it shows up as a
 * load that never finishes. These check they are still being served.
 */
const DECODERS = [
	'/draco/draco_decoder.js',
	'/draco/draco_decoder.wasm',
	'/draco/draco_wasm_wrapper.js',
	'/basis/basis_transcoder.js',
	'/basis/basis_transcoder.wasm'
]

test.describe('Runtime decoder assets', () => {
	for (const path of DECODERS) {
		test(`serves ${path}`, async ({ request, baseURL }) => {
			const response = await request.get(new URL(path, baseURL).toString())

			expect(response.status()).toBe(200)
			// Body rather than content-length: the dev server gzips and drops the header.
			expect((await response.body()).byteLength).toBeGreaterThan(0)
		})
	}
})
