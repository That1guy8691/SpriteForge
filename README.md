# SpriteForge

SpriteForge is a browser-based 2D sprite-sheet utility for slicing, cleaning, packing, previewing, and exporting game sprites.

## Use Online

[Open SpriteForge](https://that1guy8691.github.io/SpriteForge/)

No installation or account is required. Imported images are processed in your browser.
The project library is stored in that browser; export a project bundle to keep a portable backup.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://127.0.0.1:5173/
```

## Build

```bash
npm run build
```

## Current Features

- Sprite sheet import and slicing
- Grid, frame, pivot, offset, and playback controls
- Standalone prompt guide and prompt builder in `prompt-guide/`
- Key-color detection and background removal
- Detected sprite boxes
- Fill/pack detected sprites into a clean centered sheet
- Rotation cleanup workspace
- Persistent local project library with Save Project and Save a Copy
- Undo/redo for sheet edits, including frame swaps and applied packing
- Unsaved-change warnings and session-only recovery for deleted library items
- Dark mode

## Saving and Recovery

- **Save Project** saves the current asset and its settings in this browser. Saving a loaded asset updates it; **Save a Copy** creates another asset.
- **Export PNG** downloads the selected animation. It does not save your editable project.
- **Backup** downloads an editable project including current unsaved changes. Project JSON/ZIP exports contain the saved library assets.
- Use **Ctrl/Cmd+Z** to undo, **Ctrl/Cmd+Shift+Z** or **Ctrl+Y** to redo, and **Ctrl/Cmd+S** to save. Text inputs keep their native undo behavior.
- Document history retains up to 60 edits and resets when opening another asset. Deleted library items can be restored with **Undo deletion** until the tab closes.
- Browser storage can be cleared or run out of space. Keep downloaded backups; save failures remain visible and do not count as successful saves.

## GitHub Pages

The root application is published through `.github/workflows/deploy-pages.yml`.
Pushes to `master` run the tests and production build before deploying to GitHub Pages.
The workflow can also be started manually from the repository's Actions tab.

In repository Settings > Pages, the publishing source must be **GitHub Actions**.
Vite uses relative asset paths so the app works under `/SpriteForge/`.
The standalone `prompt-guide/` application is not included in this deployment.
