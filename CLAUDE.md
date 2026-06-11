# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A minimalist, distraction-free fullscreen text editor built with [Wails v2](https://wails.io): a Go backend embeds a webview frontend (vanilla JS + Vite, no framework). The window is frameless and launches fullscreen with a black background and a single centered serif `<textarea>`. The purpose of this project is to provide a lightweight and customized text editor that can be easily executed on Linux, Windows and MacOS. It is inspired by the FocusWriter project, which currently lacks support for easy installation on MacOS, and has some old, unresolved issues.

## Commands

All commands run from the repo root. On Linux (Ubuntu 24.04+) the `webkit2_41` build tag is **required** because the project depends on `libwebkit2gtk-4.1`; omit it on macOS, Windows, and older Linux.

```bash
wails dev -tags webkit2_41      # hot-reloading dev (Vite + Go recompile); browser devtools at http://localhost:34115
wails build -tags webkit2_41    # redistributable binary → build/bin/
cd frontend && npm install      # install frontend deps (Wails also runs this via frontend:install)
```

There is no test suite or linter configured.

Because the app launches frameless/fullscreen with no close button, quit dev/builds with **Alt+F4** (Linux/Windows) / **Cmd+Q** (macOS), or kill the `wails` process.

## Architecture

- **`main.go`** — Wails entry point. Defines all window behavior via `options.App`: fullscreen start state, frameless, black `BackgroundColour`, and `//go:embed all:frontend/dist` to bundle the built frontend into the Go binary. Change window appearance/behavior here.
- **`app.go`** — The `App` struct bound to the frontend via `Bind`. Currently only holds `ctx` and a `startup` hook. Any Go method added here with an exported (capitalized) name becomes callable from JS — Wails regenerates bindings into `frontend/wailsjs/` on build/dev.
- **`frontend/`** — `index.html` is a single `<textarea id="editor">`; `src/main.js` focuses it on load and swallows Escape; `src/style.css` controls all visual styling. No persistence, file I/O, or framework — purely an in-memory editor.

### Editing styling

Visual tweaks (column width, font, size, line spacing, colors) live in `frontend/src/style.css` on `html, body` and `#editor`. Note `--wails-draggable: no-drag` is set so text selection works inside the frameless window.
