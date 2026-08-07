// PROTOTYPE SUPPORT SCRIPT — not production code.
//
// Dumps the real UV layouts of Mixeur's primitives (the same THREE geometries
// `createMesh` builds) straight into the `geometry-data` block of the prototype
// HTML, so that file stays a single double-clickable artefact. The prototype
// must chew on the actual vertex splitting these geometries produce —
// hand-written test data would answer the wrong question.
//
//   bun src/app/model/prototype-uv-editing/generate-geometry.mjs

import * as THREE from 'three'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const round = (n, places = 5) => Number(n.toFixed(places))

function dump(name, geometry) {
	const position = Array.from(geometry.attributes.position.array, (n) => round(n))
	const uv = Array.from(geometry.attributes.uv.array, (n) => round(n))
	const index = geometry.index ? Array.from(geometry.index.array) : null
	return { name, position, uv, index }
}

const geometries = [
	// Six quads, 24 vertices, zero shared UVs — the "everything is an island" case.
	dump('cube', new THREE.BoxGeometry()),
	// A grid with a duplicated seam column and degenerate pole rows.
	dump('sphere', new THREE.SphereGeometry(1, 16, 12)),
	// Body + two cap fans: three islands, and the caps share nothing with the body.
	dump('cylinder', new THREE.CylinderGeometry(1, 1, 2, 16, 1)),
	// One island, wrapped twice — the UV grid tiles seamlessly across it.
	dump('torus', new THREE.TorusGeometry(1, 0.4, 12, 24)),
	// The trivial case: 4 vertices, 1 island, UVs exactly the unit square.
	dump('plane', new THREE.PlaneGeometry(1, 1, 1, 1))
]

const json = JSON.stringify(Object.fromEntries(geometries.map((g) => [g.name, g])))

const target = fileURLToPath(new URL('./uv-editing-prototype.html', import.meta.url))
const html = readFileSync(target, 'utf8')
const block = /(<script id="geometry-data" type="application\/json">)[\s\S]*?(<\/script>)/
if (!block.test(html)) throw new Error('geometry-data block not found in ' + target)
writeFileSync(target, html.replace(block, `$1\n${json}\n$2`))

for (const g of geometries) {
	console.log(
		`${g.name.padEnd(9)} ${String(g.position.length / 3).padStart(4)} verts  ` +
			`${String((g.index?.length ?? g.position.length / 3) / 3).padStart(4)} tris`
	)
}
console.log(`\ninlined ${(json.length / 1024).toFixed(0)} KB into ${target}`)
