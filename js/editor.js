import { postUp, showError } from "./messaging.js";

const V = "0.183.2";
const CDN = `https://esm.sh/three@${V}`;

export async function initEditor({ fileUrl, viewport, controlsDiv }) {
  const [THREE, { GLTFLoader }, { OrbitControls }, { TransformControls }] =
    await Promise.all([
      import(`${CDN}`),
      import(`${CDN}/examples/jsm/loaders/GLTFLoader.js`),
      import(`${CDN}/examples/jsm/controls/OrbitControls.js`),
      import(`${CDN}/examples/jsm/controls/TransformControls.js`),
    ]);

  // Scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    viewport.clientWidth / viewport.clientHeight,
    0.01,
    1000,
  );
  camera.position.set(2, 2, 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  viewport.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  // Controls
  const orbitControls = new OrbitControls(camera, renderer.domElement);
  const transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode("translate");
  scene.add(transformControls);

  // Ground grid for spatial reference — resized after model loads
  const grid = new THREE.GridHelper(100, 100, 0x444444, 0x333333);
  scene.add(grid);

  // Prevent orbit while dragging gizmo
  transformControls.addEventListener("dragging-changed", (e) => {
    orbitControls.enabled = !e.value;
  });

  // Post transformChange on drag end
  renderer.domElement.addEventListener("pointerup", () => {
    if (!model) return;
    postUp({
      type: "transformChange",
      position: {
        x: model.position.x,
        y: model.position.y,
        z: model.position.z,
      },
      rotation: {
        x: model.rotation.x,
        y: model.rotation.y,
        z: model.rotation.z,
      },
      scale: { x: model.scale.x, y: model.scale.y, z: model.scale.z },
    });
  });

  // Controls bar
  const infoEl = document.createElement("div");
  infoEl.className = "info";
  infoEl.textContent = "Loading model...";

  const modes = ["translate", "rotate", "scale"];
  const modeButtons = {};
  for (const mode of modes) {
    const btn = document.createElement("button");
    btn.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    btn.addEventListener("click", () => setGizmoMode(mode));
    modeButtons[mode] = btn;
    controlsDiv.appendChild(btn);
  }
  controlsDiv.appendChild(infoEl);
  setGizmoMode("translate");

  function setGizmoMode(mode) {
    transformControls.setMode(mode);
    for (const [m, btn] of Object.entries(modeButtons)) {
      btn.classList.toggle("active", m === mode);
    }
  }

  // Load model
  let model = null;
  const loader = new GLTFLoader();
  loader.load(
    fileUrl,
    (gltf) => {
      const mesh = gltf.scene;

      // Center mesh inside a pivot so it sits at world origin
      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());
      mesh.position.sub(center);

      const pivot = new THREE.Group();
      pivot.add(mesh);
      scene.add(pivot);

      // Fit camera to model size
      const dist = size * 1.5;
      camera.position.set(dist, dist * 0.6, dist);
      camera.near = size / 100;
      camera.far = size * 100;
      camera.updateProjectionMatrix();
      orbitControls.target.set(0, 0, 0);
      orbitControls.update();

      // Scale grid to model footprint
      const gridSize = size * 4;
      grid.scale.setScalar(gridSize / 10);
      grid.position.y = -size / 2;

      transformControls.attach(pivot);
      model = pivot;
      infoEl.textContent = "Model loaded. Use gizmo to transform.";
    },
    undefined,
    (err) =>
      showError(viewport, "Error loading model: " + (err?.message || err)),
  );

  // Resize handler
  window.addEventListener("resize", () => {
    camera.aspect = viewport.clientWidth / viewport.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  });

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Inbound messages
  window.addEventListener("message", (event) => {
    if (event.source === window) return;
    const { type, ...data } = event.data || {};
    if (!type || !model) return;
    switch (type) {
      case "setPosition":
        model.position.set(data.x ?? 0, data.y ?? 0, data.z ?? 0);
        break;
      case "setRotation":
        model.rotation.set(data.x ?? 0, data.y ?? 0, data.z ?? 0);
        break;
      case "setScale":
        model.scale.set(data.x ?? 1, data.y ?? 1, data.z ?? 1);
        break;
      case "setGizmoMode":
        if (modes.includes(data.mode)) setGizmoMode(data.mode);
        break;
    }
  });
}
