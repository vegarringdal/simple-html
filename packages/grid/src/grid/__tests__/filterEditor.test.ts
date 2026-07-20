// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The filter editor is rendered into document.body, outside the grid element.
 */

function openEditor(config = simpleConfig()) {
    return mountGrid(config).then((mounted) => {
        mounted.gridInterface.openFilterEditor();
        return mounted;
    });
}

function container() {
    return document.querySelector('.filter-editor-container') as HTMLElement;
}

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('filter editor - opening', () => {
    it('expect the dialog to be added to the document', async () => {
        await openEditor();
        expect(container()).not.toBeNull();
        expect(container().querySelector('.filter-editor-content')).not.toBeNull();
    });

    it('expect a titlebar to be rendered', async () => {
        await openEditor();
        expect(container().querySelector('.filter-editor-titlebar')).not.toBeNull();
    });

    it('expect the dialog to get an explicit position, so it can be dragged', async () => {
        await openEditor();
        const content = container().querySelector('.filter-editor-content') as HTMLElement;
        expect(content.style.left).not.toEqual('');
        expect(content.style.top).not.toEqual('');
    });

    it('expect a resize handle on every edge and corner', async () => {
        await openEditor();
        const content = container().querySelector('.filter-editor-content') as HTMLElement;

        ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'].forEach((side) => {
            expect(content.querySelector(`.simple-html-resize-handle.handle-${side}`)).not.toBeNull();
        });
        expect(content.querySelectorAll('.simple-html-resize-handle')).toHaveLength(8);
    });

    it('expect the footer buttons to be rendered', async () => {
        await openEditor();
        const text = container().textContent || '';
        expect(text).toContain('Filter & Close');
        expect(text).toContain('Filter Only');
        expect(text).toContain('Close');
    });
});

describe('filter editor - tooltips', () => {
    it('expect every footer button to carry a data-tooltip', async () => {
        await openEditor();
        const buttons = Array.from(container().querySelectorAll('.grid-button'));
        expect(buttons.length).toBeGreaterThan(0);
        buttons.forEach((button) => {
            expect(button.getAttribute('data-tooltip')).toBeTruthy();
        });
    });

    it('expect the built in tooltip to be enabled by default', async () => {
        await openEditor();
        expect(container().classList.contains('simple-html-grid-tooltips')).toEqual(true);
    });

    it('expect tooltips:false to turn off the built in tooltip', async () => {
        const config = simpleConfig();
        config.tooltips = false;
        await openEditor(config);

        expect(container().classList.contains('simple-html-grid-tooltips')).toEqual(false);
    });

    it('expect data-tooltip to still be written when the built in tooltip is off', async () => {
        const config = simpleConfig();
        config.tooltips = false;
        await openEditor(config);

        expect(container().querySelectorAll('[data-tooltip]').length).toBeGreaterThan(0);
    });

    it('expect tooltipText to override a default tooltip', async () => {
        const config = simpleConfig();
        config.tooltipText = { 'filterEditor.closeButton': 'Lukk vinduet' };
        await openEditor(config);

        const overridden = container().querySelector('[data-tooltip="Lukk vinduet"]');
        expect(overridden).not.toBeNull();
    });

    it('expect a tooltip that is not overridden to keep its default text', async () => {
        const config = simpleConfig();
        config.tooltipText = { 'filterEditor.closeButton': 'Lukk vinduet' };
        await openEditor(config);

        const text = container().innerHTML;
        expect(text).toContain('Apply this filter to the grid and close the dialog');
    });

    it('expect hovering a button to show the tooltip on the body, not inside the dialog', async () => {
        await openEditor();
        const button = container().querySelector('[data-tooltip]') as HTMLElement;

        button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        const shown = document.body.querySelector('.simple-html-grid-tooltip') as HTMLElement;
        expect(shown).not.toBeNull();
        expect(shown.parentElement).toBe(document.body);
        expect(shown.style.display).toEqual('block');
        expect(shown.textContent).toEqual(button.getAttribute('data-tooltip'));
    });

    it('expect the tooltip to hide again on mouseout', async () => {
        await openEditor();
        const button = container().querySelector('[data-tooltip]') as HTMLElement;

        button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));

        const shown = document.body.querySelector('.simple-html-grid-tooltip') as HTMLElement;
        expect(shown.style.display).toEqual('none');
    });

    it('expect the tooltip to stay inside the window', async () => {
        await openEditor();
        const button = container().querySelector('[data-tooltip]') as HTMLElement;

        button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        const shown = document.body.querySelector('.simple-html-grid-tooltip') as HTMLElement;
        expect(Number.parseInt(shown.style.left, 10)).toBeGreaterThanOrEqual(0);
        expect(Number.parseInt(shown.style.top, 10)).toBeGreaterThanOrEqual(0);
    });

    it('expect no tooltip to be shown when the built in one is turned off', async () => {
        const config = simpleConfig();
        config.tooltips = false;
        await openEditor(config);

        const button = container().querySelector('[data-tooltip]') as HTMLElement;
        button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        const shown = document.body.querySelector('.simple-html-grid-tooltip') as HTMLElement;
        expect(shown === null || shown.style.display === 'none').toEqual(true);
    });
});
