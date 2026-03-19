import { postUp, showError, showLoader } from "./messaging.js";

const TRANSFORM_MODES = {
  translate: "translate",
  rotate: "rotate",
  scale: "scale",
};

export async function initEditor({
  fileUrl,
  viewport,
  controlsDiv,
  showDimensions,
  visibleControls = Object.values(TRANSFORM_MODES),
  compassEl = null,
}) {
  const [THREE, { GLTFLoader }, { OrbitControls }, { TransformControls }] =
    await Promise.all([
      import("three"),
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/controls/OrbitControls.js"),
      import("three/addons/controls/TransformControls.js"),
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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  viewport.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirLight = new THREE.DirectionalLight(0xffffff, 5);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  // Ground grid for spatial reference — resized after model loads
  const grid = new THREE.GridHelper(40, 40, 0x444444, 0x333333);
  // Position grid at model base; each cell = 1 real-world unit (meter)
  grid.scale.setScalar(1);
  scene.add(grid);

  // Controls
  const orbitControls = new OrbitControls(camera, renderer.domElement);
  const transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode(TRANSFORM_MODES.translate);
  const gizmo = transformControls.getHelper();
  scene.add(gizmo);

  // Prevent orbit while dragging gizmo
  transformControls.addEventListener("dragging-changed", (e) => {
    orbitControls.enabled = !e.value;
  });

  let baseDims = null;
  const fmt = (n) => n.toFixed(3);

  function updateSizeDisplay(pivot) {
    if (!baseDims) return;
    sizeEl.textContent = `Height: ${fmt(baseDims.y * pivot.scale.y)}, Width: ${fmt(baseDims.x * pivot.scale.x)}, Depth: ${fmt(baseDims.z * pivot.scale.z)}`;
  }

  function updateClientTransform(model) {
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
      dimensions: baseDims
        ? {
            width: baseDims.x * model.scale.x,
            height: baseDims.y * model.scale.y,
            depth: baseDims.z * model.scale.z,
          }
        : null,
    });
  }

  transformControls.addEventListener("objectChange", () => {
    if (transformControls.mode === TRANSFORM_MODES.scale && model) {
      updateSizeDisplay(model);
    }
  });

  // Post transformChange only when a gizmo drag actually ends
  transformControls.addEventListener("dragging-changed", (e) => {
    if (e.value || !model) return; // e.value=true means drag started, false means ended
    updateClientTransform(model);
  });

  // Controls bar
  const controlsHidden =
    Array.isArray(visibleControls) && visibleControls.length === 0;

  const infoEl = document.createElement("div");
  infoEl.className = "info";
  if (!controlsHidden) infoEl.textContent = "Loading model...";

  const sizeEl = document.createElement("div");
  sizeEl.className = "info";

  const modes = Object.values(TRANSFORM_MODES);
  const modeButtons = {};
  for (const mode of modes) {
    // null = show all; array = show only listed modes
    if (visibleControls !== null && !visibleControls.includes(mode)) continue;
    const btn = document.createElement("button");
    btn.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    btn.addEventListener("click", () => setGizmoMode(mode));
    modeButtons[mode] = btn;
    controlsDiv.appendChild(btn);
  }
  if (!controlsHidden) controlsDiv.appendChild(infoEl);
  if (!controlsHidden && showDimensions) controlsDiv.appendChild(sizeEl);
  setGizmoMode(TRANSFORM_MODES.translate);

  function setGizmoMode(mode) {
    transformControls.setMode(mode);
    for (const [m, btn] of Object.entries(modeButtons)) {
      btn.classList.toggle("active", m === mode);
    }
  }

  // Load model
  const hideLoader = showLoader(viewport);

  let model = null;
  const loader = new GLTFLoader();
  loader.load(
    fileUrl,
    (gltf) => {
      hideLoader();
      const mesh = gltf.scene;

      // Center mesh inside a pivot so it sits at world origin
      const box = new THREE.Box3().setFromObject(mesh);
      const dims = box.getSize(new THREE.Vector3());
      const size = dims.length();
      const center = box.getCenter(new THREE.Vector3());
      mesh.position.sub(center);

      baseDims = dims.clone();
      sizeEl.textContent = `Height: ${fmt(dims.y)}, Width: ${fmt(dims.x)}, Depth: ${fmt(dims.z)}`;

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
      orbitControls.saveState();

      transformControls.attach(pivot);
      transformControls.setSize(1);
      model = pivot;
      if (!controlsHidden)
        infoEl.textContent = "Model loaded. Use gizmo to transform.";

      postUp({
        type: "modelLoaded",
        dimensions: { width: dims.x, height: dims.y, depth: dims.z },
      });
    },
    undefined,
    (err) => {
      hideLoader();
      showError(viewport, "Error loading model: " + (err?.message || err));
    },
  );

  // Resize handler
  window.addEventListener("resize", () => {
    camera.aspect = viewport.clientWidth / viewport.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  });

  // Render loop
  const _camDir = new THREE.Vector3();
  function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
    if (compassEl) {
      camera.getWorldDirection(_camDir);
      const angle = Math.atan2(_camDir.x, -_camDir.z) * (180 / Math.PI);
      compassEl.style.transform = `rotate(${angle}deg)`;
    }
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
      case "initTransform":
        model.position.set(
          data.transform.position?.x ?? 0,
          data.transform.position?.y ?? 0,
          data.transform.position?.z ?? 0,
        );
        model.rotation.set(
          data.transform.rotation?.x ?? 0,
          data.transform.rotation?.y ?? 0,
          data.transform.rotation?.z ?? 0,
        );
        model.scale.set(
          data.transform.scale?.x ?? 1,
          data.transform.scale?.y ?? 1,
          data.transform.scale?.z ?? 1,
        );
        updateClientTransform(model);
        break;
      case "setGizmoMode":
        if (modes.includes(data.mode)) setGizmoMode(data.mode);
        break;
    }
  });
}
