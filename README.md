# 3D Model Viewer

A lightweight 3D model viewer designed to be embedded in an **iframe**. Supports two modes: a polished **showcase** mode using `<model-viewer>`, and an interactive **editor** mode using Three.js with transform gizmos.

---

## Getting Started

Serve the project locally:

```bash
./scripts/serve.sh
```

Then open in your browser:

```
http://localhost:8080?file=https://example.com/model.glb
```

---

## URL Parameters

| Parameter | Values | Default | Description |
|---|---|---|---|
| `file` | URL string | required | URL of the `.glb` model to load |
| `freelook` | `true` / `false` | `false` | Switch between showcase and editor mode |
| `controls` | `hide` / `translate,rotate,scale` / omitted | all shown | Which control buttons to display |
| `showDimensions` | `true` / `false` | `false` | Show Width / Height / Depth in the controls bar (editor only) |

### `controls` examples

| Value | Result |
|---|---|
| omitted | All buttons shown |
| `controls=translate,rotate` | Only Translate and Rotate buttons |
| `controls=scale` | Only Scale button |
| `controls=hide` | No controls bar at all |

---

## Modes

### Showcase mode (`freelook=true`)

Uses Google's `<model-viewer>` web component.

- Auto-rotate enabled, camera locked (view-only)
- Controls bar: Reset Camera, Toggle Auto-Rotate

### Editor mode (`freelook=false`, default)

Uses raw Three.js with OrbitControls and TransformControls.

- Orbit / zoom / pan the camera freely
- Transform gizmos: Translate, Rotate, Scale (uniform only)
- Ground grid scaled to model size
- Dimensions display (opt-in via `showDimensions=true`)

---

## iframe postMessage API

### Messages sent to parent (iframe → parent)

| `type` | When | Key fields |
|---|---|---|
| `viewerReady` | Page JS initialized | — |
| `modelLoaded` | Model added to scene, gizmo attached (editor) | — |
| `viewerError` | Load failure | `error: { message }` |
| `cameraChange` | Camera moved by user (showcase) | `reason`, `detail` |
| `transformChange` | Gizmo drag ends, or on initial model load (editor) | `position`, `rotation`, `scale`, `dimensions` |

#### `transformChange` shape

```js
{
  type: "transformChange",
  position: { x, y, z },
  rotation: { x, y, z },  // Euler radians
  scale:    { x, y, z },
  dimensions: { width, height, depth }  // world-space size after scaling
}
```

### Messages accepted from parent (parent → iframe)

#### Showcase mode

```js
iframe.contentWindow.postMessage({ type: 'setCameraOrbit', orbit: '1rad 0.6rad 2m' }, '*');
iframe.contentWindow.postMessage({ type: 'resetCamera' }, '*');
iframe.contentWindow.postMessage({ type: 'setAutoRotate', enabled: true }, '*');
```

#### Editor mode

```js
iframe.contentWindow.postMessage({ type: 'setPosition', x: 0, y: 0.5, z: 0 }, '*');
iframe.contentWindow.postMessage({ type: 'setRotation', x: 0, y: 1.57, z: 0 }, '*');  // radians
iframe.contentWindow.postMessage({ type: 'setScale',    x: 2, y: 2,   z: 2 }, '*');
iframe.contentWindow.postMessage({ type: 'setGizmoMode', mode: 'rotate' }, '*');  // translate | rotate | scale
```

### Listening from the parent page

```js
window.addEventListener('message', (event) => {
  // Optional origin check:
  // if (event.origin !== 'http://localhost:8080') return;

  switch (event.data.type) {
    case 'viewerReady':
      console.log('Viewer initialized');
      break;
    case 'modelLoaded':
      console.log('Model in scene');
      break;
    case 'transformChange':
      console.log(event.data.position, event.data.dimensions);
      break;
    case 'viewerError':
      console.error(event.data.error.message);
      break;
  }
});
```

---

## File Structure

```
index.html          — bootstrap: param parsing, mode dispatch
js/
  messaging.js      — shared postUp() and showError() helpers
  showcase.js       — initShowcase() — model-viewer mode
  editor.js         — initEditor()  — Three.js + TransformControls mode
scripts/
  serve.sh          — starts python3 http.server on port 8080
```
