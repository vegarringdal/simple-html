// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { centerColumns, visibleCenterAttributes } from './gridLifecycleHelpers';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * column elements and header sizes
 *
 * stubElementSizes gives every element a clientWidth of 1000, so the center viewport is 1000px.
 */

beforeAll(() => {
    stubCanvas();
});

beforeEach(() => {
    stubElementSizes(600, 1000);
    document.body.innerHTML = '';
});

/**
 * drags the resize handle of the center header column in slot `slot` by `dx` pixels
 */
function dragResizeHandle(element: HTMLElement, slot: number, dx: number) {
    const handle = element.querySelector(
        `.simple-html-grid-header-row-container-pinned-middle > .simple-html-grid-col[refID="${slot}"] > .simple-html-grid-col-resize`
    ) as HTMLElement;
    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 + dx }));
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 100 + dx }));
}

describe('grid layout - center column elements', () => {
    it('expect every column narrower than 50px to render when they all fit', async () => {
        const columns = centerColumns(new Array(30).fill(30)); // 900px in a 1000px viewport
        const { element } = await mountGrid(columns.config, columns.data);

        expect(visibleCenterAttributes(element)).toEqual(columns.attributes);
        expect(
            element.querySelectorAll('.simple-html-grid-header-row-container-pinned-middle > .simple-html-grid-col')
        ).toHaveLength(30);
    });

    it('expect columns made narrower with the resize handle to all render', async () => {
        const columns = centerColumns(new Array(40).fill(50));
        const { element } = await mountGrid(columns.config, columns.data);

        // 4 columns down to 25px, now 22 columns start inside the 1000px viewport
        for (let slot = 0; slot < 4; slot++) {
            dragResizeHandle(element, slot, -25);
        }

        expect(visibleCenterAttributes(element)).toEqual(columns.attributes.slice(0, 22));
    });
});

describe('grid layout - header height', () => {
    it('expect tall labels to fit when the filter row is hidden', async () => {
        const config = simpleConfig();
        config.cellHeight = 22;
        config.cellHeaderLabelHeight = 44;
        config.panelHeight = 25;
        config.selectSizeHeight = 18;
        config.hideFilter = true;
        const { element, gridInterface } = await mountGrid(config);

        const header = element.querySelector('.simple-html-grid-header') as HTMLElement;
        const body = element.querySelector('.simple-html-grid-body') as HTMLElement;
        // labels 44 + column selector row 18
        expect(header.style.height).toBe('62px');
        expect(body.style.top).toBe('87px');

        // the other way around the header holds filter rows, which are cellHeight tall
        const other = gridInterface.saveConfig();
        other.hideFilter = false;
        other.hideLabels = true;
        gridInterface.loadConfig(other);
        expect(header.style.height).toBe('40px');
    });
});
