import { mergeConfig, defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			environment: 'happy-dom',
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
					// What is left under here is the Three.js calls themselves — thin glue
					// over heavy WebGL, not unit-testable. The logic that surrounds them
					// (format dispatch, URL resolution, progress) lives in
					// `src/shared/lib/asset-source` precisely so it can be covered.
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
