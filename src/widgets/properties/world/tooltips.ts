import type { MxTooltipContent } from '@/shared/lib/types'

export const worldTooltipMap: ReadonlyMap<string, MxTooltipContent> = new Map([
	[
		'surface',
		{
			text: `What the world is made of — the surface behind and around everything`,
			footer: 'Visible in Rendered shading'
		}
	],
	[
		'source',
		{
			text: `Where the world image comes from`,
			footer: 'A preset or Poly Haven world reloads with the project'
		}
	],
	// `source-<kind>`: the image row shows one control for every Source, and what
	// there is to say about it differs by where the image came from. Prefixed so
	// Source kinds cannot collide with the field names above — `preset` would
	// otherwise be a legal key in both namespaces.
	[
		'source-polyhaven',
		{
			text: `The image downloaded from Poly Haven.
			Click to browse the library or pick a different size`,
			footer: 'Stored as a link, not in the project file'
		}
	],
	[
		'source-import',
		{
			text: `An image from your own files. Click to pick another`,
			footer: 'Saved by name only — reopening the project asks for it again'
		}
	],
	[
		'preset',
		{
			text: `One of the images bundled with the app.
			The same images are offered as studio lights, which preview materials
			instead and never reach a render`
		}
	],
	[
		'blurriness',
		{
			text: `Softens the visible backdrop without dimming or softening the
			light it casts`,
			footer: 'Small values go a long way'
		}
	],
	[
		'rotation',
		{
			text: `Turns the world around the scene. Moves the backdrop and the light
			together`
		}
	],
	[
		'color',
		{
			text: `Colour of the world surface.
			Lights the scene evenly from every direction`
		}
	],
	[
		'strength',
		{
			text: `How brightly the world both appears and lights the scene.
			One value: what you see and what it lights with cannot disagree`
		}
	],
	[
		'fog',
		{
			text: `Fades distant objects into a colour.
			Linear fades between two distances; exponential thickens with depth`
		}
	],
	[
		'fog-color',
		{
			text: `Colour distant objects fade into`
		}
	],
	[
		'fog-near',
		{
			text: `Distance at which the fog starts`
		}
	],
	[
		'fog-far',
		{
			text: `Distance at which objects are hidden by fog completely`
		}
	],
	[
		'fog-density',
		{
			text: `How quickly the fog thickens with distance`
		}
	]
])
