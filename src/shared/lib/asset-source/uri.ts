/** Reading the parts of a URI or URL that identify what is being fetched. */

/** The filename part of a URI or URL, without query string or fragment. */
export function uriFilename(uri: string): string {
	return decodeUri(lastSegment(uri))
}

/** The lowercased extension of a URI or URL, or `''` when it has none. */
export function uriExtension(uri: string): string {
	const segment = lastSegment(uri)
	const dot = segment.lastIndexOf('.')
	return dot === -1 ? '' : segment.slice(dot + 1).toLowerCase()
}

function lastSegment(uri: string): string {
	const path = uri.split(/[?#]/)[0]
	return path.split('/').pop() ?? ''
}

export function decodeUri(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}
