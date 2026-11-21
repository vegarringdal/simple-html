/**
 * Dark or light for the dev sample. Every colour of grid.css is a `light-dark()`, so the grid - its
 * menus, tooltips and the filter editor too - follows the `color-scheme` of the page: switching it is
 * all it takes. See guides/13-theming.md
 */
export function toggleDarkGrid() {
    const root = document.documentElement;
    root.style.colorScheme = root.style.colorScheme === 'dark' ? 'light' : 'dark';
}
