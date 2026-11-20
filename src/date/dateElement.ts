import type { DateInterface } from './dateInterface';

/**
 * this is custom element
 * it connects gridinterface to grid class
 */
export class DateElement extends HTMLElement {
    // undefined until connectInterface() is called
    private dateInterface?: DateInterface;

    connectInterface(dateInterface: DateInterface) {
        this.dateInterface = dateInterface;
        this.dateInterface.connectGridInterface(this);
    }

    public connectedCallback() {
        if (this.dateInterface) {
            this.dateInterface.connectElement(this);
        }
    }

    public disconnectedCallback() {
        // the element can be removed before connectInterface() was ever called
        this.dateInterface?.disconnectElement();
    }
}

customElements.define('simple-html-date', DateElement);
