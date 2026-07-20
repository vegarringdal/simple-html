import { Grid } from './grid';
/**
 * this is custom element
 * it connects gridinterface to grid class
 */
export class GridElement extends HTMLElement {
    gridInterface;
    grid;
    constructor() {
        super();
        this.grid = new Grid();
    }
    enableCleanup = false; // just so I can test
    connectInterface(value) {
        /**
         * noticed hmr in react have given me issues, so will try out this
         */
        if (this.enableCleanup) {
            if (this.hasChildNodes) {
                while (this.firstChild) {
                    this.removeChild(this.firstChild);
                }
            }
        }
        this.gridInterface = value;
        this.grid.connectGridInterface(this.gridInterface);
    }
    connectedCallback() {
        this.grid.connectElement(this);
    }
    disconnectedCallback() {
        this.grid.disconnectElement();
    }
}
customElements.define('simple-html-grid', GridElement);
//# sourceMappingURL=gridElement.js.map