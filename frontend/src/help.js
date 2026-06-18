// Help overlay (F1): a two-tab modal. "Shortcuts" is a quick reference for the
// keyboard shortcuts and sidebar features; "About Fokus" shows the version and
// author. Built entirely in JS, mirroring the sidebar module.

const APP_NAME = 'Fokus';
const APP_VERSION = '1.0.0';
const APP_AUTHOR = 'David';

// macOS uses different modifier names (and a few different chords) from
// Linux/Windows, so the reference is built per-OS rather than hardcoded.
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(
    (navigator.userAgentData && navigator.userAgentData.platform) ||
    navigator.platform || '');

// [keys, description] pairs, kept in sync with main.js's keydown handler.
const SHORTCUTS = IS_MAC ? [
    ['F1', 'Toggle this help'],
    ['Cmd + S', 'Save document'],
    ['Cmd + B / I / U', 'Bold / Italic / Underline'],
    ['Ctrl + Option + 1…4', 'Heading levels 1–4'],
    ['Ctrl + Option + Cmd + Space', 'Toggle statistics bar'],
    ['Ctrl + Tab', 'Toggle customization sidebar'],
    ['Esc', 'Close the sidebar or this help'],
] : [
    ['F1', 'Toggle this help'],
    ['Ctrl + S', 'Save document'],
    ['Ctrl + B / I / U', 'Bold / Italic / Underline'],
    ['Ctrl + Alt + 1…4', 'Heading levels 1–4'],
    ['Ctrl + Alt + Space', 'Toggle statistics bar'],
    ['Ctrl + Tab', 'Toggle customization sidebar'],
    ['Esc', 'Close the sidebar or this help'],
];

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

// The "Shortcuts" tab: a key/description table plus a note on the sidebar.
function buildShortcutsPanel() {
    const panel = el('div', 'help-panel');

    panel.appendChild(el('h3', null, 'Keyboard shortcuts'));

    const list = el('dl', 'help-keys');
    for (const [keys, desc] of SHORTCUTS) {
        list.appendChild(el('dt', null, keys));
        list.appendChild(el('dd', null, desc));
    }
    panel.appendChild(list);

    panel.appendChild(el('h3', null, 'Customization sidebar'));
    panel.appendChild(el('p', null,
        'Press Ctrl + Tab to open the sidebar and tailor the editor: ' +
        'background, text and caret colors via an RGB picker, plus the font, ' +
        'font size and line height. Click Save settings to keep your choices ' +
        'between sessions.'));

    return panel;
}

// The "About Fokus" tab: name, version, author, and a one-line description.
function buildAboutPanel() {
    const panel = el('div', 'help-panel about');

    panel.appendChild(el('h3', 'about-name', APP_NAME));
    panel.appendChild(el('p', 'about-version', `Version ${APP_VERSION}`));
    panel.appendChild(el('p', 'about-author', `Created by ${APP_AUTHOR}`));
    panel.appendChild(el('p', null,
        'A minimalist, distraction-free fullscreen text editor, ' +
        'inspired by FocusWriter.'));

    return panel;
}

// Build the modal, wire tab switching and dismissal, and return its controls.
export function setupHelp() {
    const overlay = el('div', null);
    overlay.id = 'help';
    overlay.setAttribute('aria-hidden', 'true');

    const modal = el('div', 'help-modal');
    overlay.appendChild(modal);

    const closeBtn = el('button', 'help-close', '×');
    closeBtn.setAttribute('aria-label', 'Close help');
    modal.appendChild(closeBtn);

    const tabs = [
        { label: 'Shortcuts', panel: buildShortcutsPanel() },
        { label: 'About Fokus', panel: buildAboutPanel() },
    ];

    const tabBar = el('div', 'help-tabs');
    const body = el('div', 'help-body');

    const select = (index) => {
        tabs.forEach((tab, i) => {
            tab.button.classList.toggle('active', i === index);
            tab.panel.classList.toggle('active', i === index);
        });
    };

    tabs.forEach((tab, i) => {
        tab.button = el('button', 'help-tab', tab.label);
        tab.button.addEventListener('click', () => select(i));
        tabBar.appendChild(tab.button);
        body.appendChild(tab.panel);
    });

    modal.append(tabBar, body);
    document.body.appendChild(overlay);
    select(0);

    const close = () => {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
    };

    const open = () => {
        select(0);
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
    };

    const toggle = () => (overlay.classList.contains('open') ? close() : open());

    closeBtn.addEventListener('click', close);
    // Click the backdrop (but not the modal itself) to dismiss.
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    return {
        toggle,
        close,
        isOpen: () => overlay.classList.contains('open'),
    };
}
