import './style.css';

const editor = document.getElementById('editor');
const status = document.getElementById('status');
editor.focus();

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

async function save() {
    const app = backend();
    if (!app) return;
    try {
        await app.SaveDocument(compile());
        flash('Saved');
    } catch (err) {
        flash('Save failed');
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

async function loadOnStartup() {
    const app = backend();
    if (!app) return;
    try {
        const html = await app.LoadDocument();
        if (html) {
            editor.innerHTML = decompile(html);
            caretToEnd();
        }
    } catch (err) {
        console.error(err);
    }
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

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        e.preventDefault();
        return;
    }

    // The primary modifier is Ctrl on Linux/Windows and Cmd on macOS.
    const primary = e.ctrlKey || e.metaKey;
    if (!primary) return;

    // Headings: Ctrl/Cmd+Alt+1..4. Use e.code so it works even when Alt
    // rewrites the character (e.g. Option+1 = "¡" on macOS).
    if (e.altKey) {
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

loadOnStartup();
