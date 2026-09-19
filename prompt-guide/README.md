# Sprite Prompt Guide

A standalone planning workspace for producing reliable AI-assisted 2D game assets. It is designed to stop a model from being asked to solve a large animation sheet in one unreliable request.

## Run locally

```powershell
cd C:\Users\xxlil\OneDrive\Documents\SpriteForge\prompt-guide
npm install
npm run dev
```

Open the local address printed by Vite. Prompt kits and workflow progress save automatically in the browser.

## Commands

```powershell
npm test
npm run build
npm run preview
```

## What it does

- Uses asset-specific quick starts instead of applying character presets to every asset type.
- Plans actual cell requirements for direction sets, animation groups, tiles, VFX, and UI states.
- Defaults animated assets to a reference-first workflow: master design, style lock, small batches, then final assembly.
- Marks full animation sheets as experimental when the plan is too complex for one image request.
- Keeps the final prompt, reusable guide, workflow, and repair prompt on the same production contract.
- Saves named kits, workflow status and notes, and supports JSON export/import.
- Includes a mobile output drawer so the live prompt is always one tap away.

## Recommended animation workflow

1. Create and approve one master reference.
2. Lock its silhouette, palette, lighting, outline, and anchor point.
3. Generate only small pose batches from that reference.
4. Use the repair prompt when a batch drifts, crops, shifts, or ignores the background contract.
5. Normalize and assemble the accepted frames in your sprite editor.
