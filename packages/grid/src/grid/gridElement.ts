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

    connectInterface(value: GridInterface<any>) {
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
