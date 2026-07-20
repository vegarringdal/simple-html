import { Datasource } from '../../datasource/dataSource';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { GridInterface } from '../gridInterface';

/**
 * Helpers for the grid gui tests.
 *
 * These are smoke level tests - they check that the grid builds the dom it is supposed to
 * and reacts to data/selection/scroll changes. They are meant to be cheap to keep green
 * during refactors, not to pin down every pixel.
 */

/**
 * happy-dom has no canvas implementation, and the grid measures text with it
 * (getTextWidth -> canvas.getContext('2d').measureText) when sizing columns.
 * A rough monospace-ish estimate is enough for the grid to lay itself out.
 */
export function stubCanvas() {
    (HTMLCanvasElement.prototype as any).getContext = () => ({
        font: '',
        measureText: (text: string) => ({ width: (text?.length || 0) * 7 })
    });
}

/**
 * happy-dom does not lay anything out, so every element reports a size of 0 and the
 * grid renders no rows at all. Give the elements a fixed viewport so the virtual
 * scroller has something to fill.
 */
export function stubElementSizes(height = 600, width = 1000) {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get() {
            return height;
        }
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get() {
            return width;
        }
    });
    (HTMLElement.prototype as any).getBoundingClientRect = () => ({
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        height,
        width,
        x: 0,
        y: 0
    });
}

export const simpleData = () => [
    { firstname: 'first1', lastname: 'last1', age: 10 },
    { firstname: 'first2', lastname: 'last2', age: 20 },
    { firstname: 'first3', lastname: 'last3', age: 30 },
    { firstname: 'first4', lastname: 'last4', age: 40 },
    { firstname: 'first5', lastname: 'last5', age: 50 }
];

export const simpleConfig = (): GridConfig => ({
    columnsCenter: [
        { rows: ['firstname'], width: 100 },
        { rows: ['lastname'], width: 100 },
        { rows: ['age'], width: 100 }
    ],
    attributes: [{ attribute: 'firstname' }, { attribute: 'lastname' }, { attribute: 'age', type: 'number' }]
});

export type MountedGrid = {
    element: GridElement;
    datasource: Datasource;
    gridInterface: GridInterface<any>;
};

/**
 * builds a datasource + interface + custom element and attaches it to the document
 */
export async function mountGrid(config: GridConfig = simpleConfig(), data: any[] = simpleData()): Promise<MountedGrid> {
    // the custom element registers itself on import
    await import('../gridElement');

    const datasource = new Datasource();
    datasource.setData(data);

    const gridInterface = new GridInterface(config, datasource);

    const element = document.createElement('simple-html-grid') as GridElement;
    element.style.width = '100%';
    element.style.height = '100%';
    element.classList.add('simple-html-grid');
    document.body.appendChild(element);
    element.connectInterface(gridInterface);

    return { element, datasource, gridInterface };
}

export function unmountGrid(mounted: MountedGrid) {
    mounted.element.remove();
}

export type RenderedRow = {
    /** 1 based, as the grid puts it in aria-rowindex */
    rowIndex: number;
    values: Record<string, string>;
    classes: string;
};

/**
 * The grid recycles a fixed pool of row elements and hides the unused ones, so the dom
 * order means nothing. This reads back only the rows that are actually on screen and
 * puts them in the order the user sees them.
 */
export function renderedRows(element: GridElement): RenderedRow[] {
    const container = element.querySelector('.simple-html-grid-body-row-container-pinned-middle');
    if (!container) {
        return [];
    }

    return Array.from(container.children)
        .filter((row) => (row as HTMLElement).style.display !== 'none')
        .map((row) => {
            const values: Record<string, string> = {};
            row.querySelectorAll('input[data-attribute]').forEach((input) => {
                const attribute = input.getAttribute('data-attribute');
                if (attribute) {
                    values[attribute] = (input as HTMLInputElement).value;
                }
            });
            return {
                rowIndex: Number(row.getAttribute('aria-rowindex')),
                values,
                classes: (row as HTMLElement).className
            };
        })
        .sort((a, b) => a.rowIndex - b.rowIndex);
}

/**
 * values of one attribute, in the order they are rendered
 */
export function renderedColumn(element: GridElement, attribute: string): string[] {
    return renderedRows(element).map((row) => row.values[attribute]);
}

/**
 * the grid writes "filtered/total" into the footer
 */
export function footerText(element: GridElement): string {
    return element.querySelector('.simple-html-grid-footer')?.textContent?.trim() || '';
}

/**
 * group rows are rendered into their own container
 */
export function renderedGroupRows(element: GridElement): HTMLElement[] {
    const container = element.querySelector('.simple-html-grid-body-row-container-group');
    if (!container) {
        return [];
    }
    return Array.from(container.children).filter((row) => (row as HTMLElement).style.display !== 'none') as HTMLElement[];
}
