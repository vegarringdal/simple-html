/**
 * light/dark theme of the demo: the dark class on the body.
 * index.css has `body.dark { color-scheme: dark }` and the demo shell's own dark colours. The grid
 * and the date picker need nothing more: every colour of grid.css and date.css is
 * light-dark(<light>, <dark>), so they follow the color-scheme. On the body and not on the grid's
 * container: the menus, the tooltips and the filter editor are put on the body (see the theming guide)
 */

const STORAGE_KEY = 'simple-html-demo-theme';

export function applyTheme(dark: boolean) {
    document.body.classList.toggle('dark', dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
}

export function initTheme() {
    applyTheme(localStorage.getItem(STORAGE_KEY) === 'dark');
}

export function toggleTheme() {
    applyTheme(!document.body.classList.contains('dark'));
}
