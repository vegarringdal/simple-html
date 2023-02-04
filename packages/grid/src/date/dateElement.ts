import { DateInterface } from './dateInterface';

/**
 * this is custom element
 * it connects gridinterface to grid class
 */
export class DateElement extends HTMLElement {
    private dateInterface: DateInterface;

    constructor() {
        super();
    }

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
        this.dateInterface.disconnectElement();
    }
}

customElements.define('simple-html-date', DateElement);
