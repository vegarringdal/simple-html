// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import { mountGrid, simpleData, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * smoke test - can the grid mount at all, and does it build the dom skeleton
 */

describe('grid - mounting', () => {
    beforeAll(() => {
        stubCanvas();
        stubElementSizes();
    });

    it('expect the grid to mount without throwing', async () => {
        const mounted = await mountGrid();
        expect(mounted.element).toBeDefined();
    });

    it('expect the main sections to be created', async () => {
        const { element } = await mountGrid();
        expect(element.querySelector('.simple-html-grid-panel')).not.toBeNull();
        expect(element.querySelector('.simple-html-grid-header')).not.toBeNull();
        expect(element.querySelector('.simple-html-grid-body')).not.toBeNull();
        expect(element.querySelector('.simple-html-grid-footer')).not.toBeNull();
    });

    it('expect the body row containers to be created', async () => {
        const { element } = await mountGrid();
        expect(element.querySelector('.simple-html-grid-body-row-container-pinned-middle')).not.toBeNull();
        expect(element.querySelector('.simple-html-grid-body-row-container-selector')).not.toBeNull();
    });

    it('expect the datasource to be reachable through the interface', async () => {
        const { gridInterface } = await mountGrid();
        expect(gridInterface.getDatasource().length()).toEqual(simpleData().length);
    });
});
