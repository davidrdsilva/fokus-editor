import './style.css';
import { setupSidebar } from './sidebar.js';
import { setupHelp } from './help.js';

const editor = document.getElementById('editor');
const status = document.getElementById('status');
const stats = document.getElementById('stats');
editor.focus();

// Average adult silent reading speed, used for the estimated reading time.
const WORDS_PER_MINUTE = 200;

// The bound Go methods are injected by the Wails runtime at startup. The
// generated wailsjs bindings under wailsjs/go/main/App.js are just thin
// wrappers around these, so we call them directly to avoid an import that
// only exists after a build.
const backend = () => window.go && window.go.main && window.go.main.App;

// Shared <style> for both the live editor and the compiled, standalone file,
// so a saved document renders identically when opened on its own.
const DOCUMENT_STYLE = `
  body { background:#000; color:#fff; margin:0; }
  #content {
    width: 45vw;
    margin: 6vh auto;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 25px;
    line-height: 1.8;
  }
  #content h1, #content h2, #content h3, #content h4 { font-weight: bold; line-height: 1.3; margin: 0.6em 0 0.3em; }
  #content h1 { font-size: 1.9em; }
  #content h2 { font-size: 1.55em; }
  #content h3 { font-size: 1.3em; }
  #content h4 { font-size: 1.1em; }
`;

// Wrap the editor's rich HTML in a standalone, viewable document. The markup
// is stored verbatim inside #content, so bold/italic/underline/headings all
// persist and the file opens correctly in any browser.
function compile() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>fokus document</title>
<style>${DOCUMENT_STYLE}</style>
</head>
<body>
<div id="content">${editor.innerHTML}</div>
</body>
</html>
`;
}

// Recover editor markup from a compiled document.
function decompile(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const content = doc.getElementById('content');
    if (!content) return '';
    // Documents saved by the original plain-text build used <pre id="content">
    // with escaped text; convert those line breaks to markup so they survive.
    if (content.tagName === 'PRE') {
        return content.textContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }
    return content.innerHTML;
}

function flash(message) {
    status.textContent = message;
    status.classList.add('show');
    clearTimeout(flash._timer);
    flash._timer = setTimeout(() => status.classList.remove('show'), 1200);
}

// The file the editor is currently bound to (null until the document is saved
// or opened), and whether it has unsaved edits.
let currentPath = null;
let dirty = false;

// The current document's display name (basename), or 'Untitled' when unsaved.
function fileLabel() {
    return currentPath ? currentPath.split(/[\\/]/).pop() : 'Untitled';
}

// Mark the document edited and keep the stats bar (if shown) current.
function markDirty() {
    dirty = true;
    refreshStats();
}

// Ask the user (via a native dialog) whether to discard unsaved edits. In a
// plain browser (no Wails runtime) or on error, don't block.
async function confirmDiscard() {
    const app = backend();
    if (!app) return true;
    try {
        return await app.ConfirmDiscard();
    } catch (err) {
        console.error(err);
        return true;
    }
}

// Save to the bound file, or prompt for one (save-as) the first time.
async function save() {
    const app = backend();
    if (!app) return;
    try {
        let path = currentPath;
        if (!path) {
            path = await app.SaveDialog('untitled.html');
            if (!path) return; // cancelled
        }
        await app.WriteDocument(path, compile());
        currentPath = path;
        dirty = false;
        flash('Saved');
        refreshStats();
    } catch (err) {
        flash('Save failed');
        console.error(err);
    }
}

// Start a fresh, empty document (confirming first if there are unsaved edits).
async function newFile() {
    if (dirty && !(await confirmDiscard())) return;
    editor.innerHTML = '';
    currentPath = null;
    dirty = false;
    caretToEnd();
    refreshStats();
}

// Open an existing document, replacing the current one (confirming first if
// there are unsaved edits).
async function openFile() {
    const app = backend();
    if (!app) return;
    if (dirty && !(await confirmDiscard())) return;
    try {
        const path = await app.OpenDialog();
        if (!path) return; // cancelled
        editor.innerHTML = decompile(await app.ReadDocument(path));
        currentPath = path;
        dirty = false;
        caretToEnd();
        refreshStats();
        flash('Opened');
    } catch (err) {
        flash('Open failed');
        console.error(err);
    }
}

function caretToEnd() {
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

// Tag of the block element the caret currently sits in (H1–H4/P/DIV), or null.
function currentBlockTag() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.anchorNode;
    while (node && node !== editor) {
        if (node.nodeType === 1 && /^(H1|H2|H3|H4|P|DIV)$/.test(node.tagName)) {
            return node.tagName;
        }
        node = node.parentNode;
    }
    return null;
}

// Apply a heading level, or toggle back to a paragraph if already that level.
function setHeading(level) {
    const tag = 'H' + level;
    const block = currentBlockTag() === tag ? '<p>' : '<h' + level + '>';
    document.execCommand('formatBlock', false, block);
    editor.focus();
}

function toggle(command) {
    document.execCommand(command, false, null);
    editor.focus();
}

function plural(n, noun) {
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

// Recompute and render the statistics bar from the editor's rendered text.
// innerText (not textContent) inserts line breaks between block elements, so
// it gives accurate word counts and lets us split paragraphs on blank lines.
function renderStats() {
    const text = editor.innerText.trim();
    const words = text ? text.match(/\S+/g).length : 0;
    const paragraphs = text ? text.split(/\n+/).filter((p) => p.trim()).length : 0;
    const minutes = words ? Math.ceil(words / WORDS_PER_MINUTE) : 0;
    // Lead with the file name (• marks unsaved edits) so the bar doubles as the
    // only place the current document is identified in the frameless window.
    const name = `${dirty ? '• ' : ''}${fileLabel()}`;
    stats.textContent = `${name} · ${plural(words, 'word')} · ${plural(paragraphs, 'paragraph')} · ${plural(minutes, 'min')} read`;
}

// Refresh the stats bar only while it's visible (the filename/dirty marker can
// change on save/open/new even when the bar is hidden).
function refreshStats() {
    if (stats.classList.contains('show')) renderStats();
}

function toggleStats() {
    const showing = stats.classList.toggle('show');
    if (showing) renderStats();
}

// The customization sidebar (Ctrl/Cmd+Tab). It reads/writes the appearance
// config through the bound Go methods, falling back to no-ops in a plain
// browser (dev devtools) where the Wails runtime is absent.
const sidebar = setupSidebar({
    load: async () => {
        const app = backend();
        return app ? app.LoadConfig() : '';
    },
    save: async (json) => {
        const app = backend();
        if (app) await app.SaveConfig(json);
    },
    flash,
});

// The help overlay (F1).
const help = setupHelp();

document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
        e.preventDefault();
        help.toggle();
        return;
    }

    if (e.key === 'Escape') {
        e.preventDefault();
        help.close();
        sidebar.close();
        return;
    }

    // The primary modifier is Ctrl on Linux/Windows and Cmd on macOS.
    const primary = e.ctrlKey || e.metaKey;
    if (!primary) return;

    // Ctrl/Cmd+Tab toggles the customization sidebar.
    if (e.key === 'Tab') {
        e.preventDefault();
        sidebar.toggle();
        return;
    }

    // Ctrl/Cmd+Alt shortcuts. Key off e.code so they work even when Alt
    // rewrites the character (e.g. Option+1 = "¡" / Option+Space on macOS).
    // The branch fires on (Ctrl OR Cmd)+Alt, but on macOS the simpler combos
    // are reserved by the OS and never reach the webview: Cmd+Space and
    // Cmd+Option+Space go to Spotlight/Finder. So the chord that actually works
    // there is Ctrl+Option(+Cmd)+Space and Ctrl+Option+1..4 — which is what the
    // F1 help shows for macOS.
    if (e.altKey) {
        if (e.code === 'Space') {
            e.preventDefault();
            toggleStats();
            return;
        }
        const headings = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };
        if (headings[e.code]) {
            e.preventDefault();
            setHeading(headings[e.code]);
        }
        return;
    }

    // Inline formatting: Ctrl/Cmd+B / +I / +U. We preventDefault and apply the
    // command ourselves so the webview's native shortcut doesn't double-toggle.
    switch (e.key.toLowerCase()) {
        case 's':
            e.preventDefault();
            save();
            break;
        case 'n':
            e.preventDefault();
            newFile();
            break;
        case 'o':
            e.preventDefault();
            openFile();
            break;
        case 'b':
            e.preventDefault();
            toggle('bold');
            break;
        case 'i':
            e.preventDefault();
            toggle('italic');
            break;
        case 'u':
            e.preventDefault();
            toggle('underline');
            break;
    }
});

// Force a clean paste: a contenteditable would otherwise absorb the source's
// markup (from a PDF, web page, IDE, etc.). Strip it by inserting only the
// clipboard's plain text, letting the editor's own styling apply uniformly.
editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
});

// Track unsaved edits and keep the statistics current while the bar is visible.
editor.addEventListener('input', () => {
    markDirty();
});
