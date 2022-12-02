/**
 * small helper to get fist element with classname
 * @param element 
 * @param name 
 * @returns 
 */
export function getElementByClassName(element: HTMLElement, name: string) {
    return element.getElementsByClassName(name)[0] as HTMLElement;
}
