/**
 * The single failure contract for asset loading: a load either succeeds with a
 * value or fails with an `Error`. Nothing throws past the loader, and nothing
 * returns a bare `null` that the caller has to interpret.
 */
export type LoadResult<T> = LoadSuccess<T> | LoadFailure

export interface LoadSuccess<T> {
	ok: true
	value: T
}

export interface LoadFailure {
	ok: false
	error: Error
}

export function loaded<T>(value: T): LoadSuccess<T> {
	return { ok: true, value }
}

export function failed(cause: unknown): LoadFailure {
	return { ok: false, error: cause instanceof Error ? cause : new Error(String(cause)) }
}
