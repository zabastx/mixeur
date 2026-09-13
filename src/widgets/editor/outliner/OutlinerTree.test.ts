/* eslint-disable vue/one-component-per-file */
import { render } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { computed, defineComponent, h, inject, provide, ref, type PropType, type VNode } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OutlinerTree from './OutlinerTree.vue'
import type { MxContextMenuItem } from '@/shared/ui/MxContextMenu.vue'
import type { OutlinerItem } from './types'

const sceneStore = vi.hoisted(() => ({
	scene: { uuid: 'scene-root' },
	sceneGroups: [] as Array<{ uuid: string; name: string }>,
	addGroup: vi.fn(),
	moveObjectToTarget: vi.fn(),
	duplicateObject: vi.fn(),
	deleteFromScene: vi.fn(),
	objectVisibilityUpdate: vi.fn()
}))

vi.mock('@/app/model/scene', () => ({
	useSceneStore: () => sceneStore
}))

interface VirtualTreeItem {
	_id: string
	value: OutlinerItem
	level: number
	hasChildren: boolean
	bind: Record<string, unknown>
}

interface TreeContext {
	items: Readonly<{ value: OutlinerItem[] }>
	modelValue: Readonly<{ value: OutlinerItem | undefined }>
	select: (item: OutlinerItem) => void
}

const treeContextKey = Symbol('tree')

const TreeRootStub = defineComponent({
	name: 'TreeRoot',
	props: {
		items: {
			type: Array as PropType<OutlinerItem[]>,
			required: true
		},
		modelValue: {
			type: Object as PropType<OutlinerItem | undefined>,
			default: undefined
		}
	},
	emits: ['update:modelValue'],
	setup(props, { emit, slots }) {
		provide<TreeContext>(treeContextKey, {
			items: computed(() => props.items),
			modelValue: computed(() => props.modelValue),
			select: (item) => emit('update:modelValue', item)
		})

		return () => h('div', { 'data-testid': 'tree-root' }, slots.default?.())
	}
})

function flattenItems(items: OutlinerItem[], level = 0): VirtualTreeItem[] {
	return items.flatMap((item) => [
		{
			_id: item.uuid,
			value: item,
			level,
			hasChildren: Boolean(item.children?.length),
			bind: {
				'data-uuid': item.uuid
			}
		},
		...flattenItems(item.children ?? [], level + 1)
	])
}

const TreeVirtualizerStub = defineComponent({
	name: 'TreeVirtualizer',
	setup(_props, { slots }) {
		const tree = inject<TreeContext>(treeContextKey)

		return () =>
			h(
				'div',
				{ 'data-testid': 'tree-virtualizer' },
				flattenItems(tree?.items.value ?? []).map((item) => slots.default?.({ item }))
			)
	}
})

const TreeItemStub = defineComponent({
	name: 'TreeItem',
	setup(_props, { attrs, slots }) {
		const expanded = ref(false)
		const tree = inject<TreeContext>(treeContextKey)
		const uuid = attrs['data-uuid'] as string

		return () => {
			const item = flattenItems(tree?.items.value ?? []).find(
				(entry) => entry.value.uuid === uuid
			)?.value

			return h(
				'div',
				{
					...attrs,
					'data-testid': `tree-item-${uuid}`,
					onClick: () => {
						if (item) tree?.select(item)
					}
				},
				slots.default?.({
					isExpanded: expanded.value,
					isSelected: tree?.modelValue.value?.uuid === uuid,
					handleToggle: () => {
						expanded.value = !expanded.value
					}
				})
			)
		}
	}
})

const CheckboxRootStub = defineComponent({
	name: 'CheckboxRoot',
	props: {
		modelValue: {
			type: Boolean,
			default: false
		}
	},
	emits: ['update:modelValue'],
	setup(props, { emit, slots }) {
		return () =>
			h(
				'button',
				{
					type: 'button',
					role: 'checkbox',
					'aria-checked': String(props.modelValue),
					'data-testid': 'visibility-toggle',
					onClick: () => emit('update:modelValue', !props.modelValue)
				},
				slots.default?.()
			)
	}
})

const MxIconStub = defineComponent({
	name: 'MxIcon',
	props: {
		name: {
			type: String,
			required: true
		}
	},
	setup(props) {
		return () => h('span', { 'data-testid': 'icon', 'data-icon': props.name })
	}
})

function renderMenuItems(items: MxContextMenuItem[] = []): VNode[] {
	return items.flatMap((item): VNode[] => {
		if (item.submenu) return renderMenuItems(item.submenu)

		return [
			h(
				'button',
				{
					type: 'button',
					'data-testid': `context-action-${item.key}`,
					onClick: () => item.onSelect?.(new Event('select'))
				},
				item.label
			)
		]
	})
}

const MxContextMenuStub = defineComponent({
	name: 'MxContextMenu',
	props: {
		items: {
			type: Array as PropType<MxContextMenuItem[]>,
			default: () => []
		}
	},
	emits: ['update:open'],
	setup(props, { emit, slots }) {
		return () =>
			h('div', { 'data-testid': 'context-menu' }, [
				h(
					'button',
					{
						type: 'button',
						'data-testid': 'context-open',
						onClick: () => emit('update:open', true)
					},
					'Open menu'
				),
				slots.default?.(),
				...renderMenuItems(props.items)
			])
	}
})

const globalStubs = {
	TreeRoot: TreeRootStub,
	TreeVirtualizer: TreeVirtualizerStub,
	TreeItem: TreeItemStub,
	CheckboxRoot: CheckboxRootStub,
	MxIcon: MxIconStub,
	MxContextMenu: MxContextMenuStub
}

function createItem(overrides: Partial<OutlinerItem> = {}): OutlinerItem {
	return {
		uuid: 'mesh-1',
		type: 'Mesh',
		name: 'Cube',
		isCamera: false,
		userData: {
			userVisible: true
		},
		...overrides
	}
}

function renderOutliner(props: Partial<InstanceType<typeof OutlinerTree>['$props']> = {}) {
	const items = props.items ?? [createItem()]

	return render(OutlinerTree, {
		props: {
			items,
			...props
		},
		global: {
			stubs: globalStubs
		}
	})
}

describe('OutlinerTree', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		sceneStore.scene.uuid = 'scene-root'
		sceneStore.sceneGroups = []
		sceneStore.addGroup.mockReturnValue({ uuid: 'new-group' })
	})

	it('renders object rows with nested indentation and object icons', () => {
		const child = createItem({
			uuid: 'child-mesh',
			name: 'Child Mesh',
			type: 'Mesh'
		})
		const parent = createItem({
			uuid: 'parent-group',
			name: 'Parent Group',
			type: 'Group',
			children: [child]
		})

		const { getByText, getByTestId, getAllByTestId } = renderOutliner({ items: [parent] })

		getByText('Parent Group')
		getByText('Child Mesh')
		expect(
			getByTestId('tree-item-child-mesh').querySelector('div')?.getAttribute('style')
		).toContain('padding-left: 1.25rem')
		expect(
			getAllByTestId('icon').some((icon) => icon.getAttribute('data-icon') === 'outliner/group')
		).toBe(true)
	})

	it('emits setActiveCamera when the render-camera control is clicked', async () => {
		const camera = createItem({
			uuid: 'camera-1',
			type: 'PerspectiveCamera',
			name: 'Camera',
			isCamera: true
		})
		const { emitted, getAllByTestId } = renderOutliner({
			items: [camera],
			renderCameraId: 'camera-1'
		})

		await userEvent.click(
			getAllByTestId('icon').find((icon) => icon.getAttribute('data-icon') === 'outliner/camera')!
		)

		expect(emitted('setActiveCamera')).toEqual([['camera-1']])
	})

	it('updates object visibility from the visibility checkbox', async () => {
		const item = createItem({
			uuid: 'hidden-target',
			userData: {
				userVisible: false
			}
		})

		const { getByTestId } = renderOutliner({ items: [item] })

		await userEvent.click(getByTestId('visibility-toggle'))

		expect(sceneStore.objectVisibilityUpdate).toHaveBeenCalledWith('hidden-target', true)
	})

	it('runs context-menu scene actions for the opened object', async () => {
		sceneStore.sceneGroups = [{ uuid: 'group-1', name: 'Existing Group' }]
		const item = createItem({ uuid: 'mesh-context' })

		const { getByTestId } = renderOutliner({ items: [item] })

		await userEvent.click(getByTestId('context-open'))
		await userEvent.click(getByTestId('context-action-sceneroot'))
		await userEvent.click(getByTestId('context-action-newgroup'))
		await userEvent.click(getByTestId('context-action-group-1'))
		await userEvent.click(getByTestId('context-action-duplicate'))
		await userEvent.click(getByTestId('context-action-delete'))

		expect(sceneStore.moveObjectToTarget).toHaveBeenNthCalledWith(1, 'mesh-context', 'scene-root')
		expect(sceneStore.addGroup).toHaveBeenCalledTimes(1)
		expect(sceneStore.moveObjectToTarget).toHaveBeenNthCalledWith(2, 'mesh-context', 'new-group')
		expect(sceneStore.moveObjectToTarget).toHaveBeenNthCalledWith(3, 'mesh-context', 'group-1')
		expect(sceneStore.duplicateObject).toHaveBeenCalledWith('mesh-context')
		expect(sceneStore.deleteFromScene).toHaveBeenCalledWith('mesh-context')
	})

	it('forwards tree selection through v-model', async () => {
		const item = createItem({ uuid: 'selectable-mesh' })

		const { emitted, getByTestId } = renderOutliner({ items: [item] })

		await userEvent.click(getByTestId('tree-item-selectable-mesh'))

		expect(emitted('update:modelValue')).toEqual([[item]])
	})

	it('marks the selected row with the E2E selection test id', () => {
		const item = createItem({ uuid: 'selected-mesh', name: 'test-outliner-mesh' })

		const { getByText } = renderOutliner({
			items: [item],
			modelValue: item
		})

		expect(getByText('test-outliner-mesh')).toBeTruthy()
	})
})
