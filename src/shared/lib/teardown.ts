/**
 * A list of releases to run when something is torn down.
 *
 * Call `add` on the line that acquires a resource, so an acquisition cannot be
 * read without its release being visible right next to it.
 */
export interface Teardown {
	/** Record the release for something just acquired. */
	add(release: () => void): void
	/** Run every recorded release and forget them. Safe to call more than once. */
	run(): void
}

export function createTeardown(): Teardown {
	const releases: (() => void)[] = []

	return {
		add(release) {
			releases.push(release)
		},
		run() {
			// Taken before running so a release that itself tears something down
			// cannot see a half-drained list, and reversed so a resource is
			// released before whatever it was built on.
			const pending = releases.splice(0).reverse()

			for (const release of pending) {
				// One release throwing must not strand the rest — a viewport that
				// only half-releases leaks the remainder for the life of the page.
				try {
					release()
				} catch (error) {
					console.error('Teardown step failed:', error)
				}
			}
		}
	}
}
