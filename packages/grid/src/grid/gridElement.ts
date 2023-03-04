import { Grid } from './grid';
import { GridInterface } from './gridInterface';

/**
 * this is custom element
 * it connects gridinterface to grid class
 */
export class GridElement extends HTMLElement {
    private gridInterface: GridInterface<any>;
    private grid: Grid;

    constructor() {
        super();
        this.grid = new Grid();
    }

    public enableCleanup = false; // just so I can test

    connectInterface(value: GridInterface<any>) {

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

    public connectedCallback() {
        this.grid.connectElement(this);
    }

    public disconnectedCallback() {
        this.grid.disconnectElement();
    }
}

customElements.define('simple-html-grid', GridElement);
