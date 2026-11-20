import type { DateInterface } from './dateInterface';

/**
 * The `<simple-html-date>` element: shows the date picker or calendar of the {@link DateInterface}
 * connected to it. Create it, connect an interface and put it on the page. Give it the
 * `simple-html-date` class for the styles of `@simple-html/grid/date.css`.
 *
 * Removing it from the page unsubscribes the interface's `on()` handlers.
 *
 * @example
 * ```ts
 * import { type DateElement, DateInterface, type IDateConfig } from '@simple-html/grid';
 *
 * declare const config: IDateConfig;
 *
 * const element = document.createElement('simple-html-date') as DateElement;
 * element.classList.add('simple-html-date');
 * element.connectInterface(new DateInterface(config));
 * host.appendChild(element);
 * ```
 */
export class DateElement extends HTMLElement {
    // undefined until connectInterface() is called
    private dateInterface?: DateInterface;

    /**
     * Shows a date interface in this element, and renders it.
     *
     * @param dateInterface the date picker or calendar to show
     *
     * @example
     * ```ts
     * import { type DateElement, DateInterface, type IDateConfig } from '@simple-html/grid';
     *
     * declare const config: IDateConfig;
     *
     * const element = document.createElement('simple-html-date') as DateElement;
     * element.connectInterface(new DateInterface(config));
     * host.appendChild(element);
     * ```
     */
    connectInterface(dateInterface: DateInterface) {
        this.dateInterface = dateInterface;
        this.dateInterface.connectGridInterface(this);
    }

    /**
     * Called by the browser when the element is put on the page: renders the connected interface. Not for
     * calling yourself.
     */
    public connectedCallback() {
        if (this.dateInterface) {
            this.dateInterface.connectElement(this);
        }
    }

    /**
     * Called by the browser when the element is removed from the page: disconnects the interface and
     * unsubscribes its `on()` handlers. Not for calling yourself.
     */
    public disconnectedCallback() {
        // the element can be removed before connectInterface() was ever called
        this.dateInterface?.disconnectElement();
    }
}

customElements.define('simple-html-date', DateElement);
