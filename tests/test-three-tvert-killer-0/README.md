# T-Vertices Killer test

## Install

Tested on Node.js 16+

```
npm install
``` 


## Run

```
npm run dev
```

Then open in the browser the URL displayed in the console.
It should display the mesh `public/planeWithTVertices.glb`
With T-vertices removed. You can download the cleaned mesh by clicking on a button.

Then you can open it with Blender, Go to Edit mode, select edges selection.
And click on Select > Select by trait > Non-Manifold.
Only contour edges should be selected.
