# Three T-Vertices Killer


<p align="center">
  <img src='/TVerticesKiller.webp' />
</p>

**Remove T-Vertices from THREE.js geometries.**


## Problem

A T-vertice is a point which coincides with an edge, but which does not belong to the edge. In general, a mesh with T-vertice is rendered correctly. But many operations on the mesh will fail. If we displace the T-Vertice, then it won't coincide with the edge anymore, and it will create a hole in the mesh.

T-Vertices can be generated in different ways. Here are a few:

* Output of `three-bvh-csg` CSG library can have T-vertices (see [this Github issue](https://github.com/gkjohnson/three-bvh-csg/issues/202)),
* Meshes generated with some CAD software (SketchUp),
* Your code if you split a face without caring for the surrounding linked faces.


T-vertices are a major tessellation issue, that's why we should kill'em:

* It makes the contour of the geometry hard to compute. For example, if you just want to render the edges of your geometry using [THREE.EdgeGeometry](https://threejs.org/docs/#api/en/geometries/EdgesGeometry), the edges having T-vertices will be wrongly displayed,
* The geometry is not manifold anymore. It cannot be 3D printed directly,
* It can create normals computation issues (so lighting issues),
* Vertices dynamic displacements (through skinning, height mapping) will create artifacts,
* Remeshing algorithm (Delaunay tessellation, decimation) will fail.


## Usage

Tested with `NodeJS 16+`

install:

```bash
npm i webAR-rocks/three-tvert-killer
```

Run:

```javascript
import { clean_tVerticesFromGeometry } from '@webAR-rocks/three-tvert-killer'

// it will change your geometry without returning a new one:
const yourGeometryCleaned = clean_tVerticesFromGeometry(yourGeometry, options)
```

* `yourGeometry` in an instance of `THREE.BufferGeometry`
* `options` is a facultative object with these properties:
  * `<boolean> mergeVertices`: if we merge vertices before cleaning the geometry. Default is `true`
  * `<float> mergeVerticesTol`: merge vertices tolerancy. Only used if `mergeVertices=true`. Default is `0.00001`
  * `<float> alignmentTol`: consider 2 units vector as colinear if their angles in radians is lower than this value. Default is `0.000005`
  * `<boolean> verbose`: log the number of T-vertices found, and other stories. Default is `true`
  * `<int> maxEdgesPerTVertex`: break the while loop if a T-vertice is a T-vertices for more than this value edges. Default is `100`


## Requirements

it works for both indexed and non-indexed geometries. However the returned geometry is always indexed.
Other attributes like normals, UVs, ... are preserved.


## Algorithm


Main runtime:

```
1. Data preparation:
- List all edges by tuples (i, j), i < j
- references faces for each edge. 
- for each edge, compute
  - its center and is squared length (for circumscribed sphere inclusion fast test)
  - its direction unit vector u

2. Main runtime:
For V vertex:
  while(E = get_coincidentEdge(V)):
    Split E to insert V:
      * remove it from edges array and add 2 new edges
    Split referenced faces including E to include the new edges
    Do other stuffs

3. Geometry rebuild:
- Browse edges and add faces to the faces set
- create index array from the faces set
```

T-vert test:

```
function get_coincidentEdge(V):
  
  for each edge E:
    if V belongs to E continue
    if V is outside the circumscribed sphere of E continue
    let k = ||E.u ^ (E.i - V))||^2 // squared cross product
    if (k < epsilon^2){ // colinearity test
      return E
    }

  return null
```


## Efficiency

Time is `O(N²)`, so it should not be called in the rendering loop. For high poly geometries it may be slow.
To make it `O(N.log(N))`, we should sort edges in an octree after the *1.Data preparation* step, then use this octree in `get_coincidentEdge` to only loop in edges in the same octree cells of the T-vertice candidate instead of looping on all edges.


## References

* [WebGL Academy](http://webglacademy.com): Interactive tutorials to learn WebGL and Three.js
* [Three.js official website](https:/threejs.org): Three.js doc and examples
* [Wikipedia](https://en.wikipedia.org/wiki/T-vertices): T-vertices definition
* [Github repo of Three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg): The best CSG library for Three.js so far
