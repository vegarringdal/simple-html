/**
 * light/dark theme of the demo: the dark class on the body.
 * index.css has `body.dark { color-scheme: dark }`, and every colour of the site, grid.css and
 * date.css is light-dark(<light>, <dark>): the whole page follows the color-scheme - the sidebar, the
 * code panels, the grid and the date picker. On the body and not on the grid's container: the menus,
 * the tooltips and the filter editor are put on the body (see the theming guide)
 */

const STORAGE_KEY = 'simple-html-demo-theme';

/**
 * localStorage can throw (blocked site data) - the theme then only lasts for the page
 */
function readStored(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

export function applyTheme(dark: boolean) {
    document.body.classList.toggle('dark', dark);
    try {
        localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    } catch {
        // blocked site data: the choice is not kept
    }
}

/**
 * The theme the user chose with the button, else the one of the OS (`prefers-color-scheme`)
 */
export function initTheme() {
    const stored = readStored();
    if (stored === 'dark' || stored === 'light') {
        document.body.classList.toggle('dark', stored === 'dark');
    } else {
        document.body.classList.toggle('dark', matchMedia('(prefers-color-scheme: dark)').matches);
    }
}

export function toggleTheme() {
    applyTheme(!document.body.classList.contains('dark'));
}
