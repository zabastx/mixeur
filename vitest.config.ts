import { mergeConfig, defineConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			environment: 'happy-dom',
			// Both defaults, stated so Vitest stops printing speed-up hints after
			// every run. Neither hint applies: the setup's native `gl` addon cannot
			// load twice in one process, so `vmThreads` fails every file but the
			// first, and `isolate: false` would share `vi.mock` state across files.
			// Stryker overrides this pool; `vitest.stryker.config.ts` sets it back.
			pool: 'forks',
			isolate: true,
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
