/**
 * The typefaces shipped in `public/fonts`. Kept apart from the loader so that
 * listing them in a dropdown does not pull the Three.js addon bundle in.
 */
export const defaultFontUrls = new Map<string, string>([
	['gentilis-bold', '/fonts/gentilis_bold.typeface.json'],
	['gentilis-regular', '/fonts/gentilis_regular.typeface.json'],
	['helvetiker-regular', '/fonts/helvetiker_regular.typeface.json'],
	['helvetiker-bold', '/fonts/helvetiker_bold.typeface.json'],
	['optimer-regular', '/fonts/optimer_regular.typeface.json'],
	['optimer-bold', '/fonts/optimer_bold.typeface.json']
])

export const defaultFontsList: FontsListOption[] = [
	{
		value: 'helvetiker-regular',
		label: 'Helvetiker Regular'
	},
	{
		value: 'optimer-regular',
		label: 'Optimer Regular'
	},
	{
		value: 'gentilis-regular',
		label: 'Gentilis Regular'
	},
	{
		value: 'helvetiker-bold',
		label: 'Helvetiker Bold'
	},
	{
		value: 'optimer-bold',
		label: 'Optimer Bold'
	},
	{
		value: 'gentilis-bold',
		label: 'Gentilis Bold'
	}
] as const

export type StdFontName =
	| 'helvetiker-regular'
	| 'helvetiker-bold'
	| 'optimer-regular'
	| 'optimer-bold'
	| 'gentilis-regular'
	| 'gentilis-bold'

export interface FontsListOption {
	value: StdFontName
	label: string
}
