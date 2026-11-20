import { Grid } from './grid';
import type { GridInterface } from './gridInterface';

/**
 * The `<simple-html-grid>` element: shows the grid of the {@link GridInterface} connected to it.
 *
 * `createGrid()` makes one for you, sized to fill a container, and is the easy way. Use the element
 * yourself when you want to place and size it on your own: create it, connect an interface and add it
 * to the page. It adds its `simple-html-grid` class itself; give it a size, e.g. width and height
 * 100% of a container with a height.
 *
 * Removing the element from the page disconnects the grid from the datasource and the document. Put
 * back, it connects again and shows the rows as they are then.
 *
 * @example
 * ```ts
 * const element = document.createElement('simple-html-grid') as GridElement;
 * element.style.width = '100%';
 * element.style.height = '100%';
 * element.connectInterface(new GridInterface(config, datasource));
 * document.getElementById('grid')!.appendChild(element);
 * ```
 */
export class GridElement extends HTMLElement {
    private grid: Grid;

    constructor() {
        super();
        this.grid = new Grid(this);
    }

    /**
     * Shows a grid interface in this element: its config, its datasource and its state.
     *
     * Connecting another interface later replaces the first one, which is disconnected from its
     * datasource. The dom is kept, the grid is rebuilt for the new interface.
     *
     * @param value the interface to show
     *
     * @example
     * ```ts
     * const element = document.createElement('simple-html-grid') as GridElement;
     * element.connectInterface(new GridInterface(config, datasource));
     * container.appendChild(element);
     * ```
     */
    public connectInterface(value: GridInterface<any>) {
        this.grid.connectGridInterface(value);
    }

    /**
     * @internal
     * called by the browser every time the element is added to the dom
     */
    public connectedCallback() {
        this.grid.connectElement();
    }

    /**
     * @internal
     * called by the browser every time the element is removed from the dom
     */
    public disconnectedCallback() {
        this.grid.disconnectElement();
    }
}

customElements.define('simple-html-grid', GridElement);
