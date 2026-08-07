/* eslint-disable vue/one-component-per-file */
import { render } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, h, type PropType, type VNode } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DataOutliner from './DataOutliner.vue'
import type { OutlinerItem } from './types'
import THREE from '@/shared/three'
import { getUserData } from '@/shared/three/utils'

const sceneStore = vi.hoisted(() => ({
	sceneChildren: [] as THREE.Object3D[],
	addGroup: vi.fn()
}))

const cameraStore = vi.hoisted(() => ({
	renderCamera: null as THREE.Camera | null,
	setRenderCamera: vi.fn()
}))

const selectionStore = vi.hoisted(() => ({
	selectedObject: null as THREE.Object3D | null,
	select: vi.fn()
}))

vi.mock('@/app/model/scene', () => ({
	useSceneStore: () => sceneStore
}))

vi.mock('@/app/model/camera', () => ({
	useCameraStore: () => cameraStore
}))

vi.mock('@/app/model/selection', () => ({
	useSelectionStore: () => selectionStore
}))

function renderItems(items: OutlinerItem[]): VNode[] {
	return items.flatMap((item) => [
		h(
			'button',
			{
				type: 'button',
				'data-testid': `outliner-item-${item.uuid}`,
				'data-camera': String(item.isCamera),
				onClick: () => item
			},
			item.name
		),
		...renderItems(item.children ?? [])
	])
}

const OutlinerTreeStub = defineComponent({
	name: 'OutlinerTree',
	props: {
		items: {
			type: Array as PropType<OutlinerItem[]>,
			required: true
		},
		modelValue: {
			type: Object as PropType<OutlinerItem | undefined>,
			default: undefined
		},
		renderCameraId: {
			type: String,
			default: undefined
		}
	},
	emits: ['update:modelValue', 'setActiveCamera'],
	setup(props, { emit }) {
		return () =>
			h(
				'div',
				{
					'data-testid': 'outliner-tree',
					'data-render-camera-id': props.renderCameraId ?? '',
					'data-selected-id': props.modelValue?.uuid ?? ''
				},
				[
					...props.items.flatMap((item) => [
						h(
							'button',
							{
								type: 'button',
								'data-testid': `select-${item.uuid}`,
								onClick: () => emit('update:modelValue', item)
							},
							`Select ${item.name}`
						),
						...renderItems([item])
					]),
					h(
						'button',
						{
							type: 'button',
							'data-testid': 'set-active-camera',
							onClick: () => emit('setActiveCamera', 'camera-1')
						},
						'Set active camera'
					)
				]
			)
	}
})

const EditorWrapperStub = defineComponent({
	name: 'EditorWrapper',
	setup(_props, { slots }) {
		return () =>
			h('section', { 'data-testid': 'editor-wrapper' }, [
				h('header', slots.header?.()),
				h('main', slots.default?.())
			])
	}
})

const ScrollContainerStub = defineComponent({
	name: 'ScrollContainer',
	setup(_props, { slots }) {
		return () => h('div', { 'data-testid': 'scroll-container' }, slots.default?.())
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

const globalStubs = {
	EditorWrapper: EditorWrapperStub,
	ScrollContainer: ScrollContainerStub,
	OutlinerTree: OutlinerTreeStub,
	MxIcon: MxIconStub
}

function createObject<T extends THREE.Object3D>(
	object: T,
	options: {
		uuid: string
		name?: string
		userVisible?: boolean
		hideInOutliner?: boolean
	} = { uuid: object.uuid }
): T {
	object.uuid = options.uuid
	object.name = options.name ?? object.type
	const userData = getUserData(object)
	userData.userVisible = options.userVisible ?? true
	userData.hideInOutliner = options.hideInOutliner

	return object
}

function renderDataOutliner() {
	return render(DataOutliner, {
		global: {
			stubs: globalStubs
		}
	})
}

describe('DataOutliner', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		sceneStore.sceneChildren = []
		cameraStore.renderCamera = null
		selectionStore.selectedObject = null
	})

	it('renders visible scene objects as outliner items and filters hidden objects', () => {
		const group = createObject(new THREE.Group(), {
			uuid: 'group-1',
			name: 'Visible Group'
		})
		const child = createObject(new THREE.Mesh(), {
			uuid: 'mesh-1',
			name: 'Nested Mesh'
		})
		const hidden = createObject(new THREE.Mesh(), {
			uuid: 'hidden-1',
			name: 'Hidden Mesh',
			hideInOutliner: true
		})
		const camera = createObject(new THREE.PerspectiveCamera(), {
			uuid: 'camera-1',
			name: 'Render Camera'
		})
		group.add(child)
		sceneStore.sceneChildren = [group, hidden, camera]
		cameraStore.renderCamera = camera

		const { getByText, getByTestId, queryByText } = renderDataOutliner()

		getByText('Outliner')
		getByText('Scene')
		getByText('Visible Group')
		getByText('Nested Mesh')
		getByText('Render Camera')
		expect(queryByText('Hidden Mesh')).toBeNull()
		expect(getByTestId('outliner-item-camera-1').getAttribute('data-camera')).toBe('true')
		expect(getByTestId('outliner-tree').getAttribute('data-render-camera-id')).toBe('camera-1')
	})

	it('uses object type as the outliner name when an object has no name', () => {
		const mesh = createObject(new THREE.Mesh(), {
			uuid: 'mesh-without-name',
			name: ''
		})
		sceneStore.sceneChildren = [mesh]

		const { getByText } = renderDataOutliner()

		getByText('Mesh')
	})

	it('adds a group from the header action', async () => {
		const { getByRole } = renderDataOutliner()

		await userEvent.click(getByRole('button', { name: '' }))

		expect(sceneStore.addGroup).toHaveBeenCalledTimes(1)
	})

	it('forwards tree selection to the three store', async () => {
		const mesh = createObject(new THREE.Mesh(), {
			uuid: 'selected-mesh',
			name: 'Selectable Mesh'
		})
		sceneStore.sceneChildren = [mesh]

		const { getByTestId } = renderDataOutliner()

		await userEvent.click(getByTestId('select-selected-mesh'))

		expect(selectionStore.select).toHaveBeenCalledWith('selected-mesh')
	})

	it('passes the selected store object back to the tree model', () => {
		const mesh = createObject(new THREE.Mesh(), {
			uuid: 'selected-mesh',
			name: 'Selected Mesh'
		})
		sceneStore.sceneChildren = [mesh]
		selectionStore.selectedObject = mesh

		const { getByTestId } = renderDataOutliner()

		expect(getByTestId('outliner-tree').getAttribute('data-selected-id')).toBe('selected-mesh')
	})

	it('forwards active-camera events to the camera store', async () => {
		const { getByTestId } = renderDataOutliner()

		await userEvent.click(getByTestId('set-active-camera'))

		expect(cameraStore.setRenderCamera).toHaveBeenCalledWith('camera-1')
	})
})
