/**
 * Extra helpers for the lifecycle/layout tests.
 * gridTestHelpers.ts is shared by all the grid tests, so new helpers live here.
 */

export type FakeResizeObserverRecord = {
    callback: () => void;
    observed: Element[];
    disconnected: boolean;
    /** call the observer callback, like the browser does when the element changes size */
    fire: () => void;
};

/**
 * happy-dom's ResizeObserver is a no-op that never calls back, so the resize logic can not be
 * tested with it. This swaps in one we can fire by hand, and records observe/disconnect so a
 * test can see what the grid did with it.
 */
export function installFakeResizeObserver() {
    const instances: FakeResizeObserverRecord[] = [];
    const original = (globalThis as any).ResizeObserver;

    (globalThis as any).ResizeObserver = class {
        private record: FakeResizeObserverRecord;

        constructor(callback: () => void) {
            const record: FakeResizeObserverRecord = {
                callback,
                observed: [],
                disconnected: false,
                fire: () => callback()
            };
            this.record = record;
            instances.push(record);
        }

        observe(element: Element) {
            this.record.observed.push(element);
        }

        unobserve() {
            // not used by the grid
        }

        disconnect() {
            this.record.disconnected = true;
        }
    };

    return {
        instances,
        /** the observer created last, this is the one the grid is using */
        current: () => instances[instances.length - 1],
        restore: () => {
            (globalThis as any).ResizeObserver = original;
        }
    };
}

/**
 * Attributes of the center columns that are on screen in the first rendered row, left to right.
 *
 * Only visible column elements count - a recycled column element that is hidden can still hold
 * the input it rendered last.
 */
export function visibleCenterAttributes(element: HTMLElement): string[] {
    const container = element.querySelector('.simple-html-grid-body-row-container-pinned-middle');
    const firstRow = Array.from(container?.children || [])
        .filter((row) => (row as HTMLElement).style.display !== 'none')
        .sort((a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')))[0];

    if (!firstRow) {
        return [];
    }

    const left = (col: HTMLElement) => Number(/translate3d\(([-\d.]+)px/.exec(col.style.transform)?.[1] ?? 0);

    return (Array.from(firstRow.children) as HTMLElement[])
        .filter((col) => col.style.display !== 'none')
        .sort((a, b) => left(a) - left(b))
        .map((col) => col.querySelector('input[data-attribute]')?.getAttribute('data-attribute'))
        .filter((attribute): attribute is string => !!attribute);
}

/**
 * Center columns with the given widths, attribute names c0, c1, c2...
 * plus one data row where every cell is "<attribute>v".
 */
export function centerColumns(widths: number[]) {
    const attributes = widths.map((_, i) => `c${i}`);
    return {
        attributes,
        config: {
            columnsCenter: attributes.map((attribute, i) => ({ rows: [attribute], width: widths[i] })),
            attributes: attributes.map((attribute) => ({ attribute }))
        },
        data: [Object.fromEntries(attributes.map((attribute) => [attribute, `${attribute}v`]))]
    };
}
