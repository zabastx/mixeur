import { mergeConfig, defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			environment: 'happy-dom',
			// three r185 swapped the vendored deps of LottieLoader/TTFLoader for
			// jsdelivr URLs. The bundler tree-shakes both away (they're unused), but
			// Node evaluates the whole `Addons.js` re-export chain and chokes on the
			// `https:` specifier. Point them back at the modules three still ships.
			alias: {
				'https://cdn.jsdelivr.net/npm/lottie-web@5.13.0/+esm':
					'three/examples/jsm/libs/lottie_canvas.module.js',
				'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm':
					'three/examples/jsm/libs/opentype.module.js'
			},
			server: {
				// Aliases only apply to transformed modules; three is externalized by default.
				deps: { inline: [/three[\\/]examples[\\/]jsm/] }
			},
			coverage: {
				// Opt-in via `bun run test:coverage` (or `--coverage`); off for the fast watch run.
				reporter: ['text', 'json', 'html'],
				include: ['src/**/*.{ts,vue}'],
				exclude: [
					'**/*.config.*',
					'**/*.d.ts',
					'src/main.ts',
					'src/app/test/**',
					'src/**/types.ts',
					'src/app/model/types/**',
					// Thin glue over heavy WebGL — not unit-testable. The pieces that are
					// (format detection, URI resolution, the load result) live in
					// `src/shared/lib/asset-source` so they fall outside this exclusion;
					// what stays here is loader orchestration, covered by the E2E import
					// tests instead.
					'src/shared/three/**',
					'**/assets/**'
				]
				// thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 }
			},
			setupFiles: ['src/app/test/setup.ts'],
			include: ['src/**/*.test.ts']
		}
	})
)
