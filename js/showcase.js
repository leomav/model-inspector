import { postUp, showError } from "./messaging.js";

export async function initShowcase({ fileUrl, viewport, controlsDiv }) {
  // Load model-viewer only in showcase mode
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.type = "module";
    s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    s.onload = () => customElements.whenDefined("model-viewer").then(resolve);
    s.onerror = () => reject(new Error("Failed to load model-viewer"));
    document.head.appendChild(s);
  });

  const mv = document.createElement("model-viewer");
  mv.setAttribute("src", fileUrl);
  mv.setAttribute("auto-rotate", "");
  mv.setAttribute("camera-controls", "");
  mv.setAttribute("exposure", "1");
  mv.setAttribute("shadow-intensity", "0.5");
  mv.setAttribute("alt", "3D model viewer");
  mv.style.cssText = "width:100%;height:100%";
  viewport.appendChild(mv);

  // Controls bar
  const infoEl = document.createElement("div");
  infoEl.className = "info";
  infoEl.textContent = "Loading model...";

  const btnReset = document.createElement("button");
  btnReset.textContent = "Reset Camera";

  const btnToggle = document.createElement("button");
  btnToggle.textContent = "Disable Auto-Rotate";

  controlsDiv.append(btnReset, btnToggle, infoEl);

  // Events
  mv.addEventListener("load", () => {
    infoEl.textContent = "Model loaded.";
    sendCameraChange("load");
  });

  mv.addEventListener("camera-change", (ev) => {
    if (ev.detail?.source === "user-interaction") {
      sendCameraChange("camera-change", ev.detail);
    }
  });

  mv.addEventListener("error", () => {
    showError(viewport, "Error loading model");
  });

  btnReset.addEventListener("click", () => {
    mv.removeAttribute("camera-orbit");
    sendCameraChange("ui-reset");
  });

  btnToggle.addEventListener("click", () => {
    if (mv.hasAttribute("auto-rotate")) {
      mv.removeAttribute("auto-rotate");
      btnToggle.textContent = "Enable Auto-Rotate";
      sendCameraChange("ui-auto-rotate", { enabled: false });
    } else {
      mv.setAttribute("auto-rotate", "");
      btnToggle.textContent = "Disable Auto-Rotate";
      sendCameraChange("ui-auto-rotate", { enabled: true });
    }
  });

  function sendCameraChange(reason, detail = null) {
    const payload = { type: "cameraChange", reason };
    if (detail) {
      payload.detail = detail;
    } else {
      payload.cameraOrbit = mv.getAttribute("camera-orbit") || null;
      payload.fieldOfView = mv.getAttribute("field-of-view") || null;
    }
    postUp(payload);
  }

  // Inbound messages
  window.addEventListener("message", (event) => {
    if (event.source === window) return;
    const { type, ...data } = event.data || {};
    if (!type) return;
    switch (type) {
      case "setCameraOrbit":
        if (typeof data.orbit === "string") {
          mv.setAttribute("camera-orbit", data.orbit);
          sendCameraChange("setCameraOrbit", { cameraOrbit: data.orbit });
        }
        break;
      case "resetCamera":
        mv.removeAttribute("camera-orbit");
        sendCameraChange("resetCamera");
        break;
      case "setAutoRotate":
        if (data.enabled) mv.setAttribute("auto-rotate", "");
        else mv.removeAttribute("auto-rotate");
        sendCameraChange("setAutoRotate", { enabled: !!data.enabled });
        break;
    }
  });
}
