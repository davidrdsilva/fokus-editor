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
- **`app.go`** — The `App` struct bound to the frontend via `Bind`. Holds `ctx`, a `startup` hook, and the persistence methods `SaveDocument(content)`/`LoadDocument()` and `SaveConfig(content)`/`LoadConfig()`, which read/write `document.html` and `config.json` respectively under `<os.UserConfigDir>/fokus-editor/` (path built by the shared `appFilePath` helper). Any Go method added here with an exported (capitalized) name becomes callable from JS — Wails regenerates bindings into `frontend/wailsjs/` on build/dev.
- **`frontend/`** — `index.html` is a single `<div id="editor" contenteditable>` plus a `#status` flash element and a `#stats` bar (the `#sidebar` and `#help` modal are built in JS, not in the HTML); `src/main.js` focuses the editor, swallows Escape (which also closes the sidebar and help), handles Ctrl/Cmd+S to save, toggles the sidebar on Ctrl/Cmd+Tab and the help modal on F1, and applies formatting and stats shortcuts; `src/sidebar.js` builds the customization sidebar and RGB color picker; `src/help.js` builds the F1 help modal; `src/style.css` controls all visual styling (including `#editor h1`–`h4`). No framework.

### Formatting

The editor is a `contenteditable` div, so it holds rich markup. `main.js` keydown handler maps shortcuts via a "primary" modifier that is `ctrlKey || metaKey` (Ctrl on Linux/Windows, Cmd on macOS): **Ctrl/Cmd+B/I/U** toggle bold/italic/underline via `document.execCommand`, and **Ctrl/Cmd+Alt+1..4** set H1–H4 via `formatBlock` (toggling back to `<p>` if already that level). Inline shortcuts `preventDefault` so the webview's native handling doesn't double-toggle; headings key off `e.code` (`Digit1`…) so Alt-rewritten characters on macOS still match. `execCommand` is deprecated but is the pragmatic, universally-supported choice across WebKit (Linux/macOS) and WebView2 (Windows) for an editor this simple.

A `paste` handler forces a **clean paste**: it `preventDefault`s and inserts only the clipboard's `text/plain` via `execCommand('insertText')`, so markup from a PDF/web page/IDE never enters the `contenteditable` and the editor's own styling applies uniformly.

### Statistics bar

**Ctrl/Cmd+Alt+Space** toggles the `#stats` bar (keyed off `e.code === 'Space'` in the same Alt branch as headings). `renderStats` leads with the current document's name (`fileLabel`, prefixed with `•` while there are unsaved edits — since the frameless window has no title bar, this is the only place the open file is identified), then reads `editor.innerText` (not `textContent` — innerText inserts line breaks between block elements) to count words (`/\S+/g`), paragraphs (split on blank lines), and estimated reading time (`words / WORDS_PER_MINUTE`, 200 wpm, rounded up). While the bar is visible an `input` listener keeps it live as the user types; `refreshStats` re-renders it after save/open/new so the name and dirty marker stay current.

### Customization sidebar

**Ctrl/Cmd+Tab** toggles the `#sidebar` (Escape also closes it). `src/sidebar.js` builds it entirely in JS and exposes `toggle`/`close`/`isOpen`. It edits six appearance settings — background, text and caret **color**, **font**, **font size**, and **line height** — each of which drives a CSS custom property on `:root` (`--bg-color`, `--text-color`, `--caret-color`, `--font-family`, `--font-size`, `--line-height`). Those properties are declared with defaults in `style.css` and referenced by `html, body` and `#editor`; the sidebar reads their computed values to seed its controls, so the "no config file" fallback is exactly what the stylesheet declares. Changing a control live-applies by setting the property inline on `:root`.

The panel chrome is deliberately a system sans (set apart from the serif writing canvas) and stays grayscale — the only color in it comes from the wheel. The three colors share **one circular HSV color wheel** (`createColorGroup`): a row of three swatches (Background/Text/Caret) selects which color the wheel edits; hue rides the wheel's angle (CSS `conic-gradient` aligned `from 90deg`), saturation its radius (radial white falloff), and value a slider beneath. The wheel paints into `.wheel` via CSS while a `.wheel-shade` child dims it to reflect value and a thumb marks the selection — its radius constant `WHEEL_RADIUS` in `sidebar.js` must match the `.wheel` diameter in `style.css`. `rgbToHsv`/`hsvToRgb` convert to the stored hex. `createColorGroup` returns per-key `get`/`set` handles so each color still behaves like an individual control for save/load. It defaults to the Text swatch on open so the wheel shows full vibrancy rather than the black-background default dimming it.

Font size and line height use single-value sliders. The **font** uses a custom dropdown (`createFontPicker`), styled to match the panel, previewing each option in its own face. Since no cross-platform API enumerates installed fonts (`queryLocalFonts` is Chromium/WebView2-only, absent in WebKit), it probes a curated per-OS candidate list (`FONT_CANDIDATES`) with `isFontAvailable` — a canvas `measureText` width comparison against generic baselines — and keeps only those actually installed, plus the generic families. Because that curated list can't know about custom/just-installed fonts, the dropdown also has an **"Add a font by name…"** input pinned at the top: the user types any family name and it's checked by `ensureFontAvailable` — an async probe that first nudges the CSS Font Loading API (`document.fonts.load`/`.check`) so WebKit actually resolves the font (the bare `isFontAvailable` canvas trick misses fonts the page hasn't loaded yet, e.g. a font installed on macOS after launch), then falls back to the canvas comparison. If it resolves it's added via `addItem` and selected (otherwise an inline "Not installed" message shows). The stored value is a `font-family` string (`"Georgia"`); `primaryFamily` maps a stack back to a single selection.

The **Save settings** button serializes the controls to JSON and persists via Go's `SaveConfig`, confirming inline by switching to a "Saved" state for ~1.6s (or "Save failed" on error); on startup `LoadConfig` is read back and applied (absent file → stylesheet defaults). Live changes that aren't saved last only for the session.

### Help modal

**F1** toggles the `#help` overlay (Escape and a close button also dismiss it; clicking the backdrop closes it). `src/help.js` builds a centered two-tab modal in JS and exposes `toggle`/`close`/`isOpen`. The **Shortcuts** tab is a key/description reference (kept in sync with `main.js`'s keydown handler via the `SHORTCUTS` array) plus a note on the sidebar; the **About Fokus** tab shows the app name, version, and author from the `APP_NAME`/`APP_VERSION`/`APP_AUTHOR` constants at the top of the module — bump `APP_VERSION` there on release.

### Persistence

The editor is **file-based**: `main.js` tracks the bound file in `currentPath` (null until saved/opened) and a `dirty` flag (set on `input`). Documents are no longer auto-saved or auto-loaded — launching starts on an empty, unsaved buffer, and quitting without saving discards the work. Three shortcuts drive it, all on the primary modifier (Ctrl/Cmd):

- **Ctrl/Cmd+S** (`save`) — compiles the editor's `innerHTML` into a standalone, viewable HTML document inside `<div id="content">` (sharing `DOCUMENT_STYLE` with the live editor so it renders identically standalone). If `currentPath` is set it writes there silently; otherwise it prompts via Go's `SaveDialog` (a native save-as) and remembers the chosen path.
- **Ctrl/Cmd+O** (`openFile`) — prompts via Go's `OpenDialog`, reads the file with `ReadDocument`, and `decompile` returns `#content`'s `innerHTML` into the editor. Documents from the original plain-text build (which used `<pre id="content">` with escaped text) are detected and converted.
- **Ctrl/Cmd+N** (`newFile`) — clears to an empty Untitled buffer.

New/Open guard against data loss: when `dirty`, they first call Go's `ConfirmDiscard` (a native question dialog) and abort unless the user confirms. The Go methods live in `app.go`: `SaveDialog`/`OpenDialog`/`ConfirmDiscard` wrap the `wails/v2/pkg/runtime` dialogs (cancel → empty string), and `WriteDocument(path, content)`/`ReadDocument(path)` do the path-based file IO opaquely. The appearance config (`config.json` via `SaveConfig`/`LoadConfig`) still lives in the OS config dir, unaffected.

### Editing styling

Visual tweaks (column width, font, size, line spacing, colors) live in `frontend/src/style.css` on `html, body` and `#editor`. Note `--wails-draggable: no-drag` is set so text selection works inside the frameless window.
