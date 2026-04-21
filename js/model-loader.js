import { showError } from "./messaging.js";

function getExtension(url) {
  try {
    const { pathname, searchParams } = new URL(url);
    // Some URLs encode the real filename in a query param (e.g. ?file=model.ply)
    const candidate =
      searchParams.get("file") || searchParams.get("name") || pathname;
    const match = candidate.toLowerCase().match(/\.(glb|gltf|ply)/);
    return match ? match[1] : "glb";
  } catch {
    return "glb";
  }
}

/**
 * Loads a 3D model from a URL and returns a Three.js Object3D.
 * Supports GLB, GLTF, and PLY formats.
 *
 * @param {string} url
 * @param {object} THREE - the Three.js namespace
 * @param {HTMLElement} viewport - used for error display
 * @param {function} onLoad - called with the loaded Object3D
 * @param {function} onError - called with the error
 */
export async function loadModel(url, THREE, viewport, onLoad, onError) {
  const ext = getExtension(url);

  if (ext === "ply") {
    const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js");
    const loader = new PLYLoader();
    loader.load(
      url,
      (geometry) => {
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({
          vertexColors: geometry.hasAttribute("color"),
        });
        const mesh = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        group.add(mesh);
        onLoad(group);
      },
      undefined,
      onError,
    );
  } else {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => onLoad(gltf.scene), undefined, onError);
  }
}
