<template>
	<MatSurfaceSections :surface-fields="surfaceFields" :field-groups="fieldGroups" />
</template>

<script lang="ts" setup>
import type THREE from '@/shared/three'
import type { FieldDescriptor, FieldGroup } from '@/shared/lib/field-descriptor'
import { alphaGroup, normalBumpGroup } from './groups'

type Mat = THREE.MeshNormalMaterial

const surfaceFields: FieldDescriptor<Mat>[] = []

const fieldGroups: FieldGroup<Mat>[] = [alphaGroup({ alphaMap: false }), normalBumpGroup()]
</script>
