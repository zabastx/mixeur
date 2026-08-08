import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Components from 'unplugin-vue-components/vite'
import RekaResolver from 'reka-ui/resolver'
import { iconTypesPlugin } from './plugins/vite-plugin-icon-types.ts'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		tailwindcss(),
		Components({
			dirs: 'src',
			dts: 'src/components.d.ts',
			resolvers: [RekaResolver()]
		}),
		iconTypesPlugin(),
		VitePWA({
			registerType: 'prompt',
			includeAssets: ['favicon.ico', 'favicon-96x96.png', 'apple-touch-icon.png'],
			manifest: {
				name: 'Mixeur',
				short_name: 'Mixeur',
				description: 'Blender-like web-based 3D editor built with Vue.js and Three.js',
				theme_color: '#303030',
				background_color: '#303030',
				display: 'standalone',
				orientation: 'landscape',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'web-app-manifest-192x192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any maskable'
					},
					{
						src: 'web-app-manifest-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,exr}'],
				runtimeCaching: [
					{
						urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|exr)$/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'image-cache',
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 60 * 24 * 30
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					},
					{
						urlPattern: /\/draco\/.*/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'draco-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365
							}
						}
					}
				]
			}
		})
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	},
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [
						{
							name: 'three',
							test(id) {
								return id.includes('node_modules/three/build/')
							}
						},
						{
							name: 'icons',
							test(id) {
								return id.includes('assets/icons/')
							}
						}
					]
				}
			}
		}
	}
})
