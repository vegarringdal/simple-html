/**
 * The theme of the demo: light or dark, and the theme of the grids - four looks.
 *
 * - light/dark: the dark class on the body. index.css has `body.dark { color-scheme: dark }`, and every
 *   colour of the site, grid.css, date.css and theme-tredespace.css is light-dark(<light>, <dark>): the
 *   whole page follows the color-scheme - the sidebar, the code panels, the grid and the date picker
 * - the grid theme: the default (grid.css), or TreDeSpace (theme-tredespace.css) with
 *   `data-grid-theme="tredespace"` on the body. Only the grids and their menus take it, the site keeps
 *   its own colours
 *
 * Both on the body and not on the grid's container: the menus, the tooltips and the filter editor are
 * put on the body (see the theming guide).
 */

const STORAGE_KEY = 'simple-html-demo-theme';
const GRID_THEME_KEY = 'simple-html-demo-grid-theme';

/**
 * the themes of the grid: the default one and the one of the TreDeSpace widget library
 */
export const GRID_THEMES = [
    { id: 'default', label: 'Default' },
    { id: 'tredespace', label: 'TreDeSpace' }
] as const;

export type GridTheme = (typeof GRID_THEMES)[number]['id'];

/**
 * localStorage can throw (blocked site data) - the theme then only lasts for the page
 */
function readStored(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function store(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // blocked site data: the choice is not kept
    }
}

export function applyTheme(dark: boolean) {
    document.body.classList.toggle('dark', dark);
    store(STORAGE_KEY, dark ? 'dark' : 'light');
}

/**
 * the attribute theme-tredespace.css looks for, on the body. None for the default
 */
function setGridTheme(theme: GridTheme) {
    if (theme === 'default') {
        delete document.body.dataset.gridTheme;
    } else {
        document.body.dataset.gridTheme = theme;
    }
}

/**
 * The grid theme the user picked, kept for the next visit
 */
export function applyGridTheme(theme: GridTheme) {
    setGridTheme(theme);
    store(GRID_THEME_KEY, theme);
}

/**
 * The grid theme in use: the attribute on the body
 */
export function currentGridTheme(): GridTheme {
    return GRID_THEMES.find((theme) => theme.id === document.body.dataset.gridTheme)?.id ?? 'default';
}

/**
 * The theme the user chose with the button, else the one of the OS (`prefers-color-scheme`). The grid
 * theme the user chose, else the default
 */
export function initTheme() {
    const stored = readStored(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
        document.body.classList.toggle('dark', stored === 'dark');
    } else {
        document.body.classList.toggle('dark', matchMedia('(prefers-color-scheme: dark)').matches);
    }
    setGridTheme(GRID_THEMES.find((theme) => theme.id === readStored(GRID_THEME_KEY))?.id ?? 'default');
}

export function toggleTheme() {
    applyTheme(!document.body.classList.contains('dark'));
}
