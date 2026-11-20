import { Grid } from './grid';
import type { GridInterface } from './gridInterface';

/**
 * this is custom element
 * it connects gridinterface to grid class
 */
export class GridElement extends HTMLElement {
    private gridInterface?: GridInterface<any>;
    private grid: Grid;

    constructor() {
        super();
        this.grid = new Grid();
    }

    public enableCleanup = false; // just so I can test

    /**
     * connecting a new interface keeps the dom that is already there, the grid just rebuilds it
     * for the new interface
     */
    connectInterface(value: GridInterface<any>) {
        /**
         * noticed hmr in react have given me issues, so will try out this
         */
        if (this.enableCleanup) {
            while (this.firstChild) {
                this.removeChild(this.firstChild);
            }
            // the dom is gone, so the grid has to build it again
            this.grid.domCreated = false;
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
