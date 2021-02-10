export function defineElement(classEl: CustomElementConstructor, elementName: string) {
    if (!customElements.get(elementName)) {
        customElements.define(elementName, classEl);
    } else {
        // so it plays nice with simpleHtml
        if ((globalThis as any).hmrCache) {
            customElements.define(elementName, classEl);
        }
    }
}
