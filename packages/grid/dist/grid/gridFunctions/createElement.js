/**
 * small helper to generate new element
 * @param tag
 * @param classes
 * @returns
 */
export function creatElement(tag, classes) {
    const element = document.createElement(tag);
    element.classList.add(classes);
    return element;
}
//# sourceMappingURL=createElement.js.map