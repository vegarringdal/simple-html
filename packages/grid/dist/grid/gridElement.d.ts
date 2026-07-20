import type { GridInterface } from './gridInterface';
/**
 * this is custom element
 * it connects gridinterface to grid class
 */
export declare class GridElement extends HTMLElement {
    private gridInterface;
    private grid;
    constructor();
    enableCleanup: boolean;
    connectInterface(value: GridInterface<any>): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
}
//# sourceMappingURL=gridElement.d.ts.map