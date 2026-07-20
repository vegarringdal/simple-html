import type { DateInterface } from './dateInterface';
/**
 * this is custom element
 * it connects gridinterface to grid class
 */
export declare class DateElement extends HTMLElement {
    private dateInterface;
    connectInterface(dateInterface: DateInterface): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
}
//# sourceMappingURL=dateElement.d.ts.map