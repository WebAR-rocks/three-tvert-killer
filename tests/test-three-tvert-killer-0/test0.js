import {
  BoxGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

// debug local:
import { clean_tVerticesFromGeometry } from '../../src/TVKill.mjs'

// NPM package:
//import { clean_tVerticesFromGeometry } from '@webAR-rocks/three-tvert-killer'


let _scene = null, _renderer = null, _camera = null, _controls = null


export function setup_threeCanvas(DOMElement) {
  // set fullscreen:
  DOMElement.width = window.innerWidth
  DOMElement.height = window.innerHeight
  
  // init three.js:
  _scene = new Scene()
  _scene.background = new Color( 0x333333 )
  _renderer = new WebGLRenderer( { antialias: true, canvas: DOMElement } )
  _camera = new PerspectiveCamera( 60, DOMElement.width / DOMElement.height, 0.1, 200 )
  _camera.position.set( 4, 4, 4 )

  // setup orbitcontrols:
  _controls = new OrbitControls( _camera, DOMElement )
  _controls.listenToKeyEvents( window )

  // add a cube for debug:
  /*const debugCube = new Mesh(new BoxGeometry(1,1,1), new MeshNormalMaterial())
  _scene.add(debugCube) //*/

  // load model with T-vertices:
  const loader = new GLTFLoader()
  loader.load('planeWithTVertices.glb', (gltf) => {
    gltf.scene.traverse((threeNode) => {
      if (threeNode.isMesh){
        threeNode.geometry.computeVertexNormals()
        threeNode.geometry = clean_tVerticesFromGeometry(threeNode.geometry)
        threeNode.material = new MeshNormalMaterial({side: DoubleSide, wireframe: false})
        _scene.add(threeNode)

        // append download button
        const DOMDownloadButton = document.createElement('button')
        DOMDownloadButton.innerHTML = 'Download as GLTF'
        document.body.appendChild(DOMDownloadButton)
        DOMDownloadButton.style.position = 'fixed'
        DOMDownloadButton.style.top = '10px'
        DOMDownloadButton.style.left = '10px'
        const threeMeshExport = new Mesh(threeNode.geometry, new MeshBasicMaterial())
        DOMDownloadButton.addEventListener('click', export_asGLTF.bind(null, threeMeshExport))
      }
    })
  })

  // setup rendering loop:
  animate()
}


function export_asGLTF(threeObj){
  const exporter = new GLTFExporter()
  exporter.parse(threeObj,
    (data) => {
      const fileContent = JSON.stringify(data)
      download(fileContent, 'debug.gltf', 'model/gltf+json')
    },
    (err) => {
      console.log('ERROR: cannot export as GLTF ', err)
    })
}


function download(content, fileName, contentType) {
  const a = document.createElement("a")
  const file = new Blob([content], { type: contentType })
  a.href = URL.createObjectURL(file)
  a.download = fileName
  a.click()
}


function animate(){
  _controls.update()
  _renderer.render(_scene, _camera)
  window.requestAnimationFrame(animate)
}
