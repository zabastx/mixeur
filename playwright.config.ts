import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Vue Mixeur E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.spec.ts',
	fullyParallel: !process.env.CI,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : 3,
	reporter: process.env.CI ? [['github'], ['html']] : 'html',
	timeout: 60 * 1000,

	use: {
		baseURL: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		actionTimeout: 15 * 1000,
		navigationTimeout: 30 * 1000
	},

	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					args: [
						'--use-gl=angle',
						'--disable-gpu-sandbox',
						...(process.env.CI ? ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox'] : [])
					]
				}
			}
		},
		...(!process.env.CI
			? [
					{
						name: 'firefox',
						use: devices['Desktop Firefox']
					},
					{
						name: 'webkit',
						use: devices['Desktop Safari']
					}
				]
			: [])
	],

	webServer: {
		command: process.env.CI ? 'bun run preview' : 'bun run dev',
		url: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 2 * 60 * 1000
	}
})
