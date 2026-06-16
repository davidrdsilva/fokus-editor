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
    fontSize: '--font-size',
    lineHeight: '--line-height',
};

// Which settings are colors (driven by the RGB picker); the rest are sliders.
const COLOR_KEYS = ['background', 'text', 'caret'];

const LABELS = {
    background: 'Background',
    text: 'Text',
    caret: 'Caret',
    fontSize: 'Font size',
    lineHeight: 'Line height',
};

// Range bounds and unit for the non-color (numeric) settings.
const NUMERIC = {
    fontSize: { min: 14, max: 48, step: 1, unit: 'px' },
    lineHeight: { min: 1, max: 3, step: 0.1, unit: '' },
};

function clampByte(n) {
    return Math.max(0, Math.min(255, n | 0));
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

// The RGB color picker component: three 0–255 channel sliders with live numeric
// readouts and a swatch preview. onChange receives the current hex on every
// move. Returns the element plus get()/set() so the sidebar can read it back
// for saving and seed it from a loaded config.
function createColorPicker(hex, onChange) {
    const channels = hexToRgb(hex);

    const wrap = document.createElement('div');
    wrap.className = 'picker';

    const swatch = document.createElement('div');
    swatch.className = 'picker-swatch';
    wrap.appendChild(swatch);

    const sliders = document.createElement('div');
    sliders.className = 'picker-channels';
    wrap.appendChild(sliders);

    const rows = {};
    const current = () => rgbToHex(channels.r, channels.g, channels.b);
    const paint = () => {
        swatch.style.backgroundColor = current();
    };

    for (const ch of ['r', 'g', 'b']) {
        const row = document.createElement('label');
        row.className = 'picker-row';

        const name = document.createElement('span');
        name.className = 'picker-ch';
        name.textContent = ch.toUpperCase();

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '255';
        slider.value = String(channels[ch]);

        const readout = document.createElement('span');
        readout.className = 'picker-val';
        readout.textContent = String(channels[ch]);

        slider.addEventListener('input', () => {
            channels[ch] = Number(slider.value);
            readout.textContent = slider.value;
            paint();
            onChange(current());
        });

        row.append(name, slider, readout);
        sliders.appendChild(row);
        rows[ch] = { slider, readout };
    }

    paint();

    return {
        element: wrap,
        get: current,
        set(nextHex) {
            const rgb = hexToRgb(nextHex);
            for (const ch of ['r', 'g', 'b']) {
                channels[ch] = rgb[ch];
                rows[ch].slider.value = String(rgb[ch]);
                rows[ch].readout.textContent = String(rgb[ch]);
            }
            paint();
        },
    };
}

// A single value slider for the numeric settings (font size, line height),
// with a readout that includes the unit.
function createSlider({ min, max, step, unit }, value, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'slider';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(parseFloat(value));

    const readout = document.createElement('span');
    readout.className = 'slider-val';
    readout.textContent = value;

    slider.addEventListener('input', () => {
        const next = slider.value + unit;
        readout.textContent = next;
        onChange(next);
    });

    wrap.append(slider, readout);

    return {
        element: wrap,
        get: () => slider.value + unit,
        set(next) {
            slider.value = String(parseFloat(next));
            readout.textContent = next;
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

// Build the sidebar, wire live preview + save/load, and return its controls.
// `load`/`save` are async functions over the JSON config string; `flash` shows
// a transient status message.
export function setupSidebar({ load, save, flash }) {
    const defaults = cssDefaults();
    const controls = {};
    const root = document.documentElement.style;
    const applyOne = (key, value) => root.setProperty(VARS[key], value);

    const sidebar = document.createElement('aside');
    sidebar.id = 'sidebar';
    sidebar.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h2');
    title.textContent = 'Customize';
    sidebar.appendChild(title);

    for (const key of Object.keys(VARS)) {
        const field = document.createElement('div');
        field.className = 'field';

        const label = document.createElement('span');
        label.className = 'field-label';
        label.textContent = LABELS[key];
        field.appendChild(label);

        const control = COLOR_KEYS.includes(key)
            ? createColorPicker(defaults[key], (hex) => applyOne(key, hex))
            : createSlider(NUMERIC[key], defaults[key], (value) => applyOne(key, value));

        controls[key] = control;
        field.appendChild(control.element);
        sidebar.appendChild(field);
    }

    const saveBtn = document.createElement('button');
    saveBtn.id = 'sidebar-save';
    saveBtn.textContent = 'Save settings';
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

    saveBtn.addEventListener('click', async () => {
        try {
            await save(JSON.stringify(readControls(), null, 2));
            flash('Settings saved');
        } catch (err) {
            flash('Save failed');
            console.error(err);
        }
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
