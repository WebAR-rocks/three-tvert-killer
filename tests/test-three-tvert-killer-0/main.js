import './style.css'
import { setup_threeCanvas } from './test0.js'

document.querySelector('#app').innerHTML = `
  <canvas id='threeCanvas'></canvas>
`

setup_threeCanvas(document.querySelector('#threeCanvas'))
