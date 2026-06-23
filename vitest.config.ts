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
					// Three.js wrappers/addons are thin glue over heavy WebGL — not unit-testable.
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
