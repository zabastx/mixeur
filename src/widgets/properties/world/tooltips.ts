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
		'preset',
		{
			text: `One of the environment images bundled with the app.
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
			text: `How brightly the world lights the scene.
			1 leaves the surface colour as it is`
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
