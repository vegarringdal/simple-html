/**
 * small helper to generate new element
 * @param tag
 * @param classes
 * @returns
 */
export function createElement(tag: string, classes: string) {
    const element = document.createElement(tag);
    element.classList.add(classes);
    return element;
}
