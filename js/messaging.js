// Shared postMessage helper — sends to parent, no-ops when not in an iframe.
export function postUp(msg) {
  if (window.parent === window) return;
  window.parent.postMessage(msg, "*");
}

export function showError(viewport, msg) {
  viewport.innerHTML = `<div class="error-message">${msg}</div>`;
  postUp({ type: "viewerError", error: { message: msg } });
}

export function showLoader(viewport) {
  const el = document.createElement("div");
  el.id = "viewer-loader";
  el.innerHTML = `<div class="loader-spinner"></div>`;
  viewport.appendChild(el);
  return () => el.remove(); // returns a hide function
}

