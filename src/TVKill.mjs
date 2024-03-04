import {
  Vector3
} from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'


const _defaultOptions = {
  mergeVertices: true,
  mergeVerticesTol: 0.00001,
  alignmentTol: 0.0001
}


// avoid allocation:
const _vec3 = new Vector3()
const _vec3_2 = new Vector3()

function clean_tVerticesFromGeometry(threeGeomRaw, optionsArg){
  const options = Object.assign(_defaultOptions, optionsArg || {})
  const alignmentTolSq = Math.pow(options.alignmentTol, 2)

  // 0. Merge vertices:
  let threeGeom = null
  if (options.mergeVertices){
    threeGeom = mergeVertices(threeGeomRaw, options.mergeVerticesTol)
  } else {
    threeGeom = threeGeomRaw.clone()
  }
  
  // 1. Data preparation:
  const edges = extract_edges(threeGeom)
  
  // 2. Main runtime:
  const posAttr = threeGeom.attributes.position
  const v = new Vector3()
  let TVerticesCount = 0
  for (let vi=0; vi<posAttr.count; ++vi){
    v.fromBufferAttribute(posAttr, vi)
    let coincidentEdge = null
    while (coincidentEdge = get_coincidentEdge(v, vi, edges.arr, alignmentTolSq)){
      ++TVerticesCount
      
      const {ijMin, ijMax, faces} = coincidentEdge.edge
      if (ijMin === vi || ijMax === vi){
        console.log('ERROR: A coincident edge cannot include the T-vertice')
        debugger
      }

      // remove the coincident edge from edges array:
      edges.arr.splice(coincidentEdge.ind, 1)
      delete(edges.byKey[coincidentEdge.edge.key])

      // loop over faces sharing the coincident Edge (faces to split):
      faces.forEach((face) => {
        const vk = get_oppositeVertexInd(face, coincidentEdge.edge)
        if (vk === undefined){
          console.log('ERROR: cannot get the opposite vertex of a face')
          debugger
        }

        // we get the already existing edges different than the coincident edge:
        const edgeIjMinK = search_edge(edges.byKey, ijMin, vk)
        const edgeIjMaxK = search_edge(edges.byKey, ijMax, vk)

        remove_face(edgeIjMinK, face)
        remove_face(edgeIjMaxK, face)

        if (vk === vi){
          // Flat face. We should just delete it:
          return
        }
        // The face is not flat. We need to split it:

        // search or create if not exist 2 edges from the coincident edge:
        const egdeSplitChunkIjMin = create_edgeIfNotExist(posAttr, edges, ijMin, vi)
        const egdeSplitChunkIjMax = create_edgeIfNotExist(posAttr, edges, ijMax, vi)

        // We split the face:
        const edgeFaceSplit = create_edgeIfNotExist(posAttr, edges, vk, vi)

        // we create 2 faces:
        const facesSplit = split_face(face, vi, ijMin, ijMax)

        // get which face contains ijMin and which ijMax:
        const faceIjMin = facesSplit[0].includes(ijMin) ? facesSplit[0] : facesSplit[1]
        const faceIjMax = (faceIjMin === facesSplit[0]) ? facesSplit[1] : facesSplit[0]

        // we reference the new faces to the new edges:
        edgeFaceSplit.faces.push(faceIjMin, faceIjMax)
        egdeSplitChunkIjMin.faces.push(faceIjMin)
        egdeSplitChunkIjMax.faces.push(faceIjMax)

        // We update faces in the already existing edges:
        if (!edgeIjMinK || !edgeIjMaxK){
          console.log('ERROR: Cannot find a face to split existing edges')
          debugger
        }
        if (edgeIjMinK){
          edgeIjMinK.faces.push(faceIjMin)
        }
        if (edgeIjMaxK){
          edgeIjMaxK.faces.push(faceIjMax)
        }
        
      }) // end loop on faces to split
    } // end while coincident edge
  } // end loop on vertices

  // 3. Geometry rebuild:
  if (TVerticesCount > 0){
    rebuild_geometry(threeGeom, edges.arr)
  }

  console.log('INFO in clean_tVerticesFromGeometry(): T-Vertices cleaned count =', TVerticesCount)

  return threeGeom
}


function search_face(edges, face){
  return edges.arr.find((edge) => (edge.faces.indexOf(face)!==-1))
}


function remove_face(edge, face){
  const i = edge.faces.indexOf(face)
  if (i!==-1){
    edge.faces.splice(i, 1)
  } else {
    debugger
  }
}


function split_face(face, vNew, vA, vB){
  // we should return 2 faces with the same culling
  const faceNewA = face.map((vi) => (vi===vB) ? vNew : vi) // replace B by the new
  const faceNewB = face.map((vi) => (vi===vA) ? vNew : vi) // replace A by the new
  return [faceNewA, faceNewB]
}


function get_oppositeVertexInd(face, edge){
  return face.find((vi) => (vi!==edge.ijMin && vi!==edge.ijMax))
}


function create_edgeIfNotExist(posAttr, edges, i, j){
  let edge =  search_edge(edges.byKey, i, j)
  if (edge){
    return edge
  }
  edge = create_edge(posAttr, i, j)
  // insert into edges arrays:
  edges.byKey[edge.key] = edge
  edges.arr.push(edge)
  return edge
}

function search_edge(edgesByKey, i, j){
  const searchEdgeKey = forge_edgeKey(i, j)
  return edgesByKey[searchEdgeKey] || null
}


function rebuild_geometry(threeGeom, edges){
  const facesSet = new Set()
  edges.forEach((edge) => {
    edge.faces.forEach(facesSet.add.bind(facesSet))
  })
  const newIndex = new Array(facesSet.size)
  let i = 0
  for (const face of facesSet){
    newIndex[i++] = face[0]
    newIndex[i++] = face[1]
    newIndex[i++] = face[2]
  }
  threeGeom.setIndex(newIndex)
}


function get_coincidentEdge(v, vi, edges, alignmentTolSq){
  const edgeInd = edges.findIndex((edge) => {
    // test if v belongs to edge:
    if (vi === edge.ijMin || vi === edge.ijMax){
      return false
    }

    // test if v is outside the circumscribed circle of edge:
    const vToCenter = _vec3.copy(edge.center).sub(v)
    const vToCenterSq = vToCenter.lengthSq()
    if (vToCenterSq >= edge.halfLengthSq){
      return false
    }

    // let AB the edge, and u edge unit vector
    // test if u and VA are colinear:
    const va = _vec3_2.copy(edge.pi).sub(v).normalize()
    _vec3.crossVectors(va, edge.u)
    const k = _vec3.lengthSq()
    return (k<alignmentTolSq)
  })

  return (edgeInd >=0 ) ? {
      edge: edges[edgeInd],
      ind: edgeInd
    } : null
}


function forge_edgeKey(i, j){
  const ijMin = Math.min(i, j)
  const ijMax = Math.max(i, j)
  return ijMin.toString() + '_' + ijMax.toString()
}


function create_edge(posAttr, i, j){
  const key = forge_edgeKey(i, j)
  const ijMin = Math.min(i, j)
  const ijMax = Math.max(i, j)
  const pi = _vec3.fromBufferAttribute(posAttr, i)
  const pj = _vec3_2.fromBufferAttribute(posAttr, j)
  const u = pi.clone().sub(pj).normalize() // edge unit vector
  const center = pi.clone().add(pj).multiplyScalar(0.5) // edge center
  return {
    key,
    pi: pi.clone(),
    ijMin,
    ijMax,
    faces: [],
    center,
    halfLengthSq: pi.distanceToSquared(pj) * 0.25,
    u
  }
}


function extract_edges(threeGeom){
  const posAttr = threeGeom.attributes.position

  // build edgesByKeys:
  const edgesByKeys = {}
  const faces = []

  const add_edge = (i, j, face) => {
    const key = forge_edgeKey(i, j)
    if (!edgesByKeys[key]){
      edgesByKeys[key] = create_edge(posAttr, i, j)
    }
    if (face){
      edgesByKeys[key].faces.push(face)
    }
  }

  loop_onFaceIndices(threeGeom, (ia, ib, ic) => {
    // exclude degenerate faces:
    if (ia === ib && ia === ic){
      return
    }
    if (ia === ib){
      add_edge(ia, ic, null)
      return
    }
    if (ia === ic){
      add_edge(ia, ib, null)
      return
    }
    if (ib === ic){
      add_edge(ia, ib, null)
      return
    }

    const face = [ia, ib, ic]
    add_edge(ia, ib, face)
    add_edge(ib, ic, face)
    add_edge(ic, ia, face)
  })

  // convert edgesByKeys to numerical array to make it faster to browse:
  const edges = []
  for (let key in edgesByKeys){
    edges.push(edgesByKeys[key])
  }
  return {
    arr: edges,
    byKey: edgesByKeys
  }
}


// take account of both indexed and unindexed geometries:
function loop_onFaceIndices(threeGeom, cb){
  if (threeGeom.index === null){
    const n = threeGeom.attributes.position.count
    for (let i=0; i<n; i+=3){
      cb(i, i+1, i+2)
    }
  } else {
    let n = threeGeom.index.count
    if(threeGeom.groups && threeGeom.groups.length === 1){
      n = Math.min(n, threeGeom.groups[0].count)
    }
    const indsArr = threeGeom.index.array
    for (let i=0; i<n; i+=3){
      cb(indsArr[i], indsArr[i+1], indsArr[i+2])
    }
  }
}


export {
  clean_tVerticesFromGeometry
} 
