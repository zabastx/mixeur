import { mergeConfig, defineConfig } from 'vitest/config'
import vitestConfig from './vitest.config.ts'

// The Vitest config for `bun run test:mutation` (see `stryker.config.mjs`).
//
// Stryker's Vitest runner passes `pool: 'threads'` as an inline option, which
// beats any config file. The setup's native `gl` addon cannot load in a second
// worker thread ("Module did not self-register"), so every test file after the
// first would fail to load and every mutant would look like it survived.
// `configureVitest` runs after the inline options are applied, so it can put
// the pool back to `forks`, one process per file.
export default mergeConfig(
	vitestConfig,
	defineConfig({
		plugins: [
			{
				name: 'mixeur:stryker-forks',
				configureVitest({ project }) {
					project.config.pool = 'forks'
				}
			}
		]
	})
)
