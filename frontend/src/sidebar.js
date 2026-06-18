// Customization sidebar: live-editable appearance settings backed by a JSON
// config file (saved alongside the document via Go's Save/LoadConfig). Each
// setting drives a CSS custom property on :root, and the defaults are read from
// those properties' values in style.css — so an absent config file naturally
// falls back to the stylesheet.

// Setting key -> the CSS custom property it controls on :root.
const VARS = {
    background: '--bg-color',
    text: '--text-color',
    caret: '--caret-color',
    font: '--font-family',
    fontSize: '--font-size',
    lineHeight: '--line-height',
};

// The three color settings, edited through one shared color wheel.
const COLOR_FIELDS = [
    { key: 'background', label: 'Background' },
    { key: 'text', label: 'Text' },
    { key: 'caret', label: 'Caret' },
];

// Range bounds and unit for the numeric settings.
const NUMERIC = {
    fontSize: { label: 'Size', min: 14, max: 48, step: 1, unit: 'px' },
    lineHeight: { label: 'Line height', min: 1, max: 3, step: 0.1, unit: '' },
};

// Wheel diameter; the radius constant must match the .wheel size in style.css.
const WHEEL_RADIUS = 92;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function clampByte(n) {
    return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((n) => clampByte(n).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return { r: 0, g: 0, b: 0 };
    const int = parseInt(m[1], 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

// RGB <-> HSV. Hue in degrees, saturation/value in [0,1]. The wheel maps hue to
// angle and saturation to radius; value rides a separate slider.
function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
    }
    return { h, s: max ? d / max : 0, v: max };
}

function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

// One circular HSV wheel shared by the three color settings. A swatch row picks
// which color is being edited; the wheel + value slider edit it. `initial` maps
// each key to its starting hex; onChange(key, hex) fires on every adjustment.
// Returns the element plus per-key get/set handles so the sidebar's save/load
// machinery can treat each color like any other control.
function createColorGroup(initial, onChange) {
    const state = {};
    for (const { key } of COLOR_FIELDS) state[key] = initial[key];
    // Start on Text: its default (white) shows the wheel at full vibrancy,
    // whereas the black background default would dim the whole wheel on open.
    let activeKey = 'text';
    let hsv = { h: 0, s: 0, v: 0 };

    const wrap = el('div', 'colors');

    // Swatch selector.
    const swatchRow = el('div', 'swatches');
    const dots = {};
    const buttons = {};
    for (const { key, label } of COLOR_FIELDS) {
        const button = el('button', 'swatch-btn');
        button.type = 'button';
        const dot = el('span', 'swatch-dot');
        dot.style.backgroundColor = state[key];
        button.append(dot, el('span', 'swatch-name', label));
        button.addEventListener('click', () => selectKey(key));
        swatchRow.appendChild(button);
        dots[key] = dot;
        buttons[key] = button;
    }

    // The wheel itself: hue ring + saturation falloff are painted in CSS; a
    // child shade dims it to reflect value, and a thumb marks the selection.
    const wheelWrap = el('div', 'wheel-wrap');
    const wheel = el('div', 'wheel');
    const shade = el('div', 'wheel-shade');
    const thumb = el('div', 'wheel-thumb');
    wheel.append(shade, thumb);
    wheelWrap.appendChild(wheel);

    const valueSlider = el('input', 'value-slider');
    valueSlider.type = 'range';
    valueSlider.min = '0';
    valueSlider.max = '100';
    valueSlider.setAttribute('aria-label', 'Brightness');

    const hexLabel = el('span', 'hex');

    wrap.append(swatchRow, wheelWrap, valueSlider, hexLabel);

    const currentHex = () => {
        const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
        return rgbToHex(r, g, b);
    };

    // Repaint the wheel UI from the current hsv (no onChange).
    const refresh = () => {
        const hex = currentHex();
        hexLabel.textContent = hex.toUpperCase();
        dots[activeKey].style.backgroundColor = hex;

        const r = hsv.s * WHEEL_RADIUS;
        const a = (hsv.h * Math.PI) / 180;
        thumb.style.left = `${WHEEL_RADIUS + r * Math.cos(a)}px`;
        thumb.style.top = `${WHEEL_RADIUS + r * Math.sin(a)}px`;
        shade.style.opacity = String(1 - hsv.v);

        const pure = hsvToRgb(hsv.h, hsv.s, 1);
        valueSlider.style.setProperty('--v-color', rgbToHex(pure.r, pure.g, pure.b));
    };

    // Apply an edit: store it, repaint, and notify.
    const commit = () => {
        state[activeKey] = currentHex();
        refresh();
        onChange(activeKey, state[activeKey]);
    };

    // Load a color into the wheel without notifying (selection / external set).
    const loadActive = () => {
        const { r, g, b } = hexToRgb(state[activeKey]);
        hsv = rgbToHsv(r, g, b);
        valueSlider.value = String(Math.round(hsv.v * 100));
        refresh();
    };

    const selectKey = (key) => {
        activeKey = key;
        for (const k of Object.keys(buttons)) buttons[k].classList.toggle('active', k === key);
        loadActive();
    };

    // Translate a pointer position on the wheel to hue (angle) + saturation
    // (radius), keeping value from the slider.
    const pickFrom = (event) => {
        const rect = wheel.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const radius = rect.width / 2;
        hsv.h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        hsv.s = Math.min(1, Math.hypot(dx, dy) / radius);
        commit();
    };

    const onMove = (event) => pickFrom(event);
    wheel.addEventListener('pointerdown', (event) => {
        wheel.setPointerCapture(event.pointerId);
        pickFrom(event);
        wheel.addEventListener('pointermove', onMove);
    });
    wheel.addEventListener('pointerup', (event) => {
        wheel.releasePointerCapture(event.pointerId);
        wheel.removeEventListener('pointermove', onMove);
    });

    valueSlider.addEventListener('input', () => {
        hsv.v = Number(valueSlider.value) / 100;
        commit();
    });

    selectKey(activeKey);

    const handles = {};
    for (const { key } of COLOR_FIELDS) {
        handles[key] = {
            get: () => state[key],
            set: (hex) => {
                state[key] = hex;
                dots[key].style.backgroundColor = hex;
                if (key === activeKey) loadActive();
            },
        };
    }

    return { element: wrap, handles };
}

// A labeled value slider for the numeric settings (font size, line height),
// with a header showing the label and the live value (incl. unit).
function createSlider({ label, min, max, step, unit }, value, onChange) {
    const field = el('div', 'ctrl-field');

    const head = el('div', 'ctrl-head');
    head.appendChild(el('span', 'ctrl-label', label));
    const readout = el('span', 'ctrl-val', value);
    head.appendChild(readout);

    const slider = el('input', 'range');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(parseFloat(value));

    slider.addEventListener('input', () => {
        const next = slider.value + unit;
        readout.textContent = next;
        onChange(next);
    });

    field.append(head, slider);

    return {
        element: field,
        get: () => slider.value + unit,
        set(next) {
            slider.value = String(parseFloat(next));
            readout.textContent = next;
        },
    };
}

// Generic CSS families are always offered (and, unlike named fonts, are never
// quoted when written into the font-family property).
const GENERIC_FONTS = ['serif', 'sans-serif', 'monospace'];

// Fonts commonly shipped with Windows, macOS, and Linux. Only those actually
// installed on the running system are kept (see isFontAvailable), so the
// dropdown reflects what the user can really use on their platform. There is no
// cross-platform API to enumerate installed fonts (queryLocalFonts exists only
// in Chromium/WebView2, not WebKit), hence the probe-a-known-list approach.
const FONT_CANDIDATES = [
    // Cross-platform / widely bundled
    'Arial', 'Helvetica', 'Helvetica Neue', 'Verdana', 'Tahoma', 'Trebuchet MS',
    'Times New Roman', 'Times', 'Georgia', 'Garamond', 'Palatino', 'Courier New', 'Courier',
    // Windows
    'Segoe UI', 'Calibri', 'Cambria', 'Consolas', 'Candara', 'Corbel', 'Constantia',
    // macOS
    'Avenir', 'Avenir Next', 'Optima', 'Menlo', 'Monaco', 'Geneva', 'Lucida Grande',
    'Hoefler Text', 'Baskerville', 'American Typewriter',
    // Linux
    'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono',
    'Liberation Sans', 'Liberation Serif', 'Liberation Mono',
    'Ubuntu', 'Cantarell', 'Noto Sans', 'Noto Serif', 'FreeSans', 'FreeSerif',
];

// A font is installed if it renders the sample at a different width than every
// generic baseline: when absent, the browser falls back to the baseline and the
// widths match. Reuses a single canvas context across calls.
function isFontAvailable(font) {
    const sample = 'mmmmmmmmmmlli wWQ';
    const size = '72px';
    const ctx = isFontAvailable._ctx ||
        (isFontAvailable._ctx = document.createElement('canvas').getContext('2d'));
    return ['monospace', 'sans-serif', 'serif'].some((base) => {
        ctx.font = `${size} ${base}`;
        const baseWidth = ctx.measureText(sample).width;
        ctx.font = `${size} "${font}", ${base}`;
        return ctx.measureText(sample).width !== baseWidth;
    });
}

// Async, more thorough availability check for a font the user typed in. The
// canvas probe alone misses fonts WebKit hasn't loaded into the page yet — on
// macOS that includes custom fonts the user installed but the app hasn't
// referenced — so first nudge the Font Loading API to load it, then trust
// document.fonts.check (accurate on WebKit) before falling back to the canvas.
async function ensureFontAvailable(font) {
    try {
        await document.fonts.load(`16px "${font}"`);
        if (document.fonts.check(`16px "${font}"`)) return true;
    } catch (err) {
        console.error(err);
    }
    return isFontAvailable(font);
}

// First family in a CSS font-family list, unquoted (e.g. '"Georgia", serif' ->
// 'Georgia'). Used to map a stored stack back to a single dropdown selection.
function primaryFamily(stack) {
    return String(stack).split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

// Wrap a chosen family for the font-family property: generics bare, names quoted.
function toCssFamily(family) {
    return GENERIC_FONTS.includes(family) ? family : `"${family}"`;
}

// A custom dropdown of the system fonts available across platforms — styled to
// match the rest of the panel, with each option previewed in its own font.
// onChange receives the chosen family as a font-family string.
function createFontPicker(value, onChange) {
    const installed = FONT_CANDIDATES.filter((f, i, arr) => arr.indexOf(f) === i && isFontAvailable(f));
    const options = [...GENERIC_FONTS, ...installed.sort()];
    let current = primaryFamily(value);
    // Keep the current font selectable even if detection missed it.
    if (current && !options.includes(current)) options.unshift(current);

    const wrap = el('div', 'dropdown');

    const trigger = el('button', 'dropdown-trigger');
    trigger.type = 'button';
    const currentLabel = el('span', 'dropdown-current', current);
    currentLabel.style.fontFamily = toCssFamily(current);
    trigger.append(currentLabel, el('span', 'dropdown-chevron', '▾'));

    const menu = el('ul', 'dropdown-menu');
    const items = {};
    const addItem = (family) => {
        const item = el('li', 'dropdown-item', family);
        item.style.fontFamily = toCssFamily(family);
        item.addEventListener('click', () => {
            select(family);
            closeMenu();
        });
        menu.appendChild(item);
        items[family] = item;
    };
    options.forEach(addItem);

    // Add-a-font box pinned at the top of the menu. Since no API enumerates
    // installed fonts on WebKit, let the user name any font directly; we probe
    // it with the same isFontAvailable check and add it only if it really
    // renders, so custom/just-installed fonts become selectable on the fly.
    const customRow = el('li', 'dropdown-custom');
    const customInput = el('input', 'dropdown-custom-input');
    customInput.type = 'text';
    customInput.placeholder = 'Add a font by name…';
    customInput.setAttribute('aria-label', 'Add a font by name');
    const customMsg = el('span', 'dropdown-custom-msg', 'Not installed — check the name');
    const addCustom = async () => {
        const name = customInput.value.trim();
        if (!name) return;
        if (items[name] || await ensureFontAvailable(name)) {
            if (!items[name]) addItem(name);
            select(name);
            customInput.value = '';
            customRow.classList.remove('not-found');
            closeMenu();
        } else {
            customRow.classList.add('not-found');
        }
    };
    // Keep typing (and the menu's own Escape) from reaching the global
    // shortcut handler and the sidebar's Escape-to-close.
    customInput.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
            event.preventDefault();
            addCustom();
        } else if (event.key === 'Escape') {
            closeMenu();
        } else {
            customRow.classList.remove('not-found');
        }
    });
    customInput.addEventListener('click', (event) => event.stopPropagation());
    customRow.append(customInput, customMsg);
    menu.insertBefore(customRow, menu.firstChild);

    wrap.append(trigger, menu);

    const markActive = () => {
        for (const family of Object.keys(items)) {
            items[family].classList.toggle('active', family === current);
        }
    };
    const select = (family) => {
        current = family;
        currentLabel.textContent = family;
        currentLabel.style.fontFamily = toCssFamily(family);
        markActive();
        onChange(toCssFamily(family));
    };
    const closeMenu = () => wrap.classList.remove('open');
    const openMenu = () => {
        wrap.classList.add('open');
        markActive();
        items[current]?.scrollIntoView({ block: 'nearest' });
    };

    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        wrap.classList.contains('open') ? closeMenu() : openMenu();
    });
    // Close the menu only (not the sidebar) on Escape while it's open.
    trigger.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && wrap.classList.contains('open')) {
            event.stopPropagation();
            closeMenu();
        }
    });
    document.addEventListener('click', (event) => {
        if (!wrap.contains(event.target)) closeMenu();
    });

    markActive();

    return {
        element: wrap,
        get: () => toCssFamily(current),
        set(next) {
            const family = primaryFamily(next);
            if (family && !items[family]) addItem(family);
            current = family;
            currentLabel.textContent = family;
            currentLabel.style.fontFamily = toCssFamily(family);
            markActive();
        },
    };
}

// Read each setting's default straight from its CSS custom property, so the
// "no config file" fallback is exactly what style.css declares.
function cssDefaults() {
    const root = getComputedStyle(document.documentElement);
    const out = {};
    for (const [key, prop] of Object.entries(VARS)) {
        out[key] = root.getPropertyValue(prop).trim();
    }
    return out;
}

// Build a labeled field wrapper (header label + a control beneath it).
function fieldEl(label, control) {
    const field = el('div', 'ctrl-field');
    const head = el('div', 'ctrl-head');
    head.appendChild(el('span', 'ctrl-label', label));
    field.append(head, control);
    return field;
}

// A titled section grouping related controls.
function sectionEl(label) {
    const section = el('section', 'section');
    section.appendChild(el('div', 'section-label', label));
    return section;
}

// Build the sidebar, wire live preview + save/load, and return its controls.
// `load`/`save` are async functions over the JSON config string; `flash` shows
// a transient status message (used as an error fallback).
export function setupSidebar({ load, save, flash }) {
    const defaults = cssDefaults();
    const controls = {};
    const root = document.documentElement.style;
    const applyOne = (key, value) => root.setProperty(VARS[key], value);

    const sidebar = document.createElement('aside');
    sidebar.id = 'sidebar';
    sidebar.setAttribute('aria-hidden', 'true');
    sidebar.appendChild(el('h2', null, 'Customize'));

    // Color section — one shared wheel driven by three swatches.
    const colorSection = sectionEl('Color');
    const colorGroup = createColorGroup(
        { background: defaults.background, text: defaults.text, caret: defaults.caret },
        (key, hex) => applyOne(key, hex),
    );
    for (const { key } of COLOR_FIELDS) controls[key] = colorGroup.handles[key];
    colorSection.appendChild(colorGroup.element);
    sidebar.appendChild(colorSection);

    // Type section — font, size, line height.
    const typeSection = sectionEl('Type');

    const fontPicker = createFontPicker(defaults.font, (family) => applyOne('font', family));
    controls.font = fontPicker;
    typeSection.appendChild(fieldEl('Font', fontPicker.element));

    for (const key of ['fontSize', 'lineHeight']) {
        const slider = createSlider(NUMERIC[key], defaults[key], (value) => applyOne(key, value));
        controls[key] = slider;
        typeSection.appendChild(slider.element);
    }
    sidebar.appendChild(typeSection);

    const saveBtn = el('button', null, 'Save settings');
    saveBtn.id = 'sidebar-save';
    saveBtn.type = 'button';
    sidebar.appendChild(saveBtn);

    document.body.appendChild(sidebar);

    const readControls = () => {
        const config = {};
        for (const key of Object.keys(VARS)) config[key] = controls[key].get();
        return config;
    };

    const applyConfig = (config) => {
        for (const key of Object.keys(VARS)) {
            const value = config[key];
            if (!value) continue;
            controls[key].set(value);
            applyOne(key, value);
        }
    };

    // Confirm the save on the button itself, then return it to its resting state.
    let savedTimer;
    saveBtn.addEventListener('click', async () => {
        try {
            await save(JSON.stringify(readControls(), null, 2));
            saveBtn.textContent = 'Saved';
            saveBtn.classList.add('saved');
        } catch (err) {
            saveBtn.textContent = 'Save failed';
            saveBtn.classList.add('error');
            flash('Save failed');
            console.error(err);
        }
        clearTimeout(savedTimer);
        savedTimer = setTimeout(() => {
            saveBtn.textContent = 'Save settings';
            saveBtn.classList.remove('saved', 'error');
        }, 1600);
    });

    // Load persisted settings on startup; an absent file leaves the controls
    // and editor on the style.css defaults read above.
    (async () => {
        try {
            const raw = await load();
            if (raw) applyConfig(JSON.parse(raw));
        } catch (err) {
            console.error(err);
        }
    })();

    const close = () => {
        sidebar.classList.remove('open');
        sidebar.setAttribute('aria-hidden', 'true');
    };

    const toggle = () => {
        const open = sidebar.classList.toggle('open');
        sidebar.setAttribute('aria-hidden', open ? 'false' : 'true');
    };

    return {
        toggle,
        close,
        isOpen: () => sidebar.classList.contains('open'),
    };
}
