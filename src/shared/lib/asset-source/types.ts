/**
 * Where an asset's bytes come from: a file the user picked, or a URL to fetch.
 *
 * Loading takes one of these rather than a URL so that the temporary object URL
 * a `File` needs is created and revoked in one place instead of at every call
 * site.
 */
export type AssetSource = File | AssetUrl

export interface AssetUrl {
	url: string
	/** Display name for progress. Defaults to the last segment of `url`. */
	filename?: string
	/** Total bytes, when known before the transfer starts. */
	size?: number
}

/**
 * Answers the question an asset asks while it loads: "I reference this relative
 * URI — what should actually be loaded for it?"
 *
 * Return a `File` to serve its bytes, a string to redirect to another URL, or
 * nothing to leave the URI alone. Object URLs for returned files are created
 * and revoked by the loader, never by the resolver.
 */
export type AssetResolver = (uri: string) => File | string | undefined | null
