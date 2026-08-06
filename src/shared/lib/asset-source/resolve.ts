import type { AssetResolver, AssetSource } from './types'

/** Display name for a source: the file's name, or the last segment of the URL. */
export function sourceName(source: AssetSource): string {
	if (source instanceof File) return source.name
	return source.filename || uriFilename(source.url) || source.url
}

/** Total bytes, when they are known before the transfer starts. */
export function sourceSize(source: AssetSource): number | undefined {
	return source.size
}

/** The filename part of a URI or URL, without query string or fragment. */
export function uriFilename(uri: string): string {
	const path = uri.split(/[?#]/)[0]
	const segment = path.split('/').pop() ?? ''
	return decode(segment)
}

/**
 * Every object URL minted while one asset loads, revoked together when it
 * finishes. Callers never hold an object URL, so they can never leak one.
 */
export class TempUrls {
	private readonly urls: string[] = []

	create(blob: Blob): string {
		const url = URL.createObjectURL(blob)
		this.urls.push(url)
		return url
	}

	revokeAll() {
		for (const url of this.urls) URL.revokeObjectURL(url)
		this.urls.length = 0
	}
}

export interface UrlModifierParameters {
	/** URL of the asset doing the referencing — its own URL is never rewritten. */
	baseUrl: string
	resolve: AssetResolver
	temp: TempUrls
}

/**
 * Builds the function Three.js calls for every URI referenced from inside an
 * asset.
 *
 * Three resolves references against the asset's own URL, so by the time we see
 * one it has been prefixed with a `blob:` or `https:` base. This strips that
 * base to recover the relative URI the asset's author actually wrote, which is
 * the only form a resolver can be expected to recognise.
 */
export function createUrlModifier({ baseUrl, resolve, temp }: UrlModifierParameters) {
	const base = directoryOf(baseUrl)

	return (url: string): string => {
		if (url === baseUrl) return url

		const replacement = resolve(relativeUri(url, base))
		if (!replacement) return url

		return typeof replacement === 'string' ? replacement : temp.create(replacement)
	}
}

/**
 * Looks `uri` up in `map`, falling back to any entry whose filename matches.
 *
 * Loaders do not always ask for a reference in the exact form the file declared
 * it — FBX in particular reports paths that no longer line up with the names
 * the user mapped — so an exact miss is not the same as no match.
 */
export function lookupUri<T>(map: ReadonlyMap<string, T>, uri: string): T | undefined {
	const exact = map.get(uri)
	if (exact !== undefined) return exact

	const filename = uriFilename(uri)
	for (const [key, value] of map) {
		if (uriFilename(key) === filename) return value
	}
	return undefined
}

function directoryOf(url: string): string {
	return url.substring(0, url.lastIndexOf('/') + 1)
}

function relativeUri(url: string, base: string): string {
	return decode(base && url.startsWith(base) ? url.slice(base.length) : url)
}

function decode(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}
