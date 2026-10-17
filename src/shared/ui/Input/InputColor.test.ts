import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import InputColor from './InputColor.vue'

async function openPicker() {
	const user = userEvent.setup()
	expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	await user.click(screen.getByRole('button'))
	const picker = await screen.findByRole('dialog')
	return { user, picker, hex: within(picker).getByRole('textbox') }
}

async function enterHex(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, hex: string) {
	await user.clear(input)
	await user.type(input, hex)
	await user.tab()
}

describe('InputColor', () => {
	it('opens a picker holding its colour', async () => {
		render(InputColor, { props: { hex: '#00ff00', alpha: 1 } })

		const { hex } = await openPicker()

		expect(hex).toHaveValue('#00ff00')
	})

	it('opens a picker holding its 8-digit colour in transparency mode', async () => {
		render(InputColor, { props: { transparency: true, hex: '#ff000080' } })

		const { hex } = await openPicker()

		expect(hex).toHaveValue('#ff000080')
	})

	it('emits the colour entered in the picker', async () => {
		const { emitted } = render(InputColor, { props: { hex: '#ff0000', alpha: 1 } })
		const { user, hex } = await openPicker()

		await enterHex(user, hex, '#0000ff')

		expect(emitted<[string]>('update:hex').at(-1)).toEqual(['#0000ff'])
	})

	it('emits the colour and alpha entered in the picker in transparency mode', async () => {
		const { emitted } = render(InputColor, {
			props: { transparency: true, hex: '#ff0000ff', alpha: 1 }
		})
		const { user, hex } = await openPicker()

		await enterHex(user, hex, '#0000ff80')

		expect(emitted<[string]>('update:hex').at(-1)).toEqual(['#0000ff80'])
		expect(emitted<[number]>('update:alpha').at(-1)?.[0]).toBeCloseTo(128 / 255)
	})
})
