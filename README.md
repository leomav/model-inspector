# 🧭 3D Model Inspector

A lightweight **3D model inspector** built with [Google’s `<model-viewer>`](https://modelviewer.dev/).  
Easily preview and share `.glb` files directly in your browser — just provide the model URL through query parameters.

---

## 🚀 Features

- 🧩 **Supports `.glb` files** out of the box  
- ⚙️ **Configurable via URL parameters** — no code changes needed  
- 🕹️ **Optional interactive controls** (rotate, zoom, pan)  
- 🌐 **Instant 3D previews** from remote URLs  
- 📱 **Responsive and mobile-friendly**

---

## 🧠 How It Works

The app reads query parameters from the URL to determine:
- Which 3D model to load  
- Whether to show viewer controls

| Parameter | Type | Description | Example |
|------------|------|-------------|----------|
| `file` | `string` | The URL of the `.glb` model to load | `?file=https://example.com/model.glb` |
| `showControls` | `boolean` | Whether to display orbit controls (`true` / `false`) | `?file=...&showControls=true` |

### 🧩 Example Usage

```bash
https://your-domain.com/?file=https://example.com/models/car.glb&showControls=true
