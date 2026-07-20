/**
 * this is custom element
 * it connects gridinterface to grid class
 */
export class DateElement extends HTMLElement {
    dateInterface;
    connectInterface(dateInterface) {
        this.dateInterface = dateInterface;
        this.dateInterface.connectGridInterface(this);
    }
    connectedCallback() {
        if (this.dateInterface) {
            this.dateInterface.connectElement(this);
        }
    }
    disconnectedCallback() {
        this.dateInterface.disconnectElement();
    }
}
customElements.define('simple-html-date', DateElement);
//# sourceMappingURL=dateElement.js.map