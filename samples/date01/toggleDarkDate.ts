/**
 * Dark or light for the dev sample. Every colour of date.css is a `light-dark()`, so the date picker
 * follows the `color-scheme` of the page: switching it is all it takes. See guides/13-theming.md
 */
export function toggleDarkDate() {
    const root = document.documentElement;
    root.style.colorScheme = root.style.colorScheme === 'dark' ? 'light' : 'dark';
}
