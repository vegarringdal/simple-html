// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPopoverShown } from '../../__tests__/popoverStub';
// the date picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { attachTooltips } from '../gridFunctions/tooltip';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, menuItem } from './interactionTestHelpers';

/**
 * The filter editor is a modal <dialog> on document.body, outside the grid element.
 *
 * happy-dom (20.11.0) has the dialog's show(), showModal() and close() - they set and remove `open`,
 * close() sends `close` (at once, a browser queues it) - but none of what the browser does around
 * them: no top layer, no inert page behind a modal dialog, no focus moved into it or given back, and
 * Esc does nothing (no `cancel`). Those are the browser's, checked by reading the HTML spec: the tests
 * check what the grid does with them - showModal(), autofocus on the dialog, and a dialog the browser
 * closed (Esc) taken off the page.
 */

function openEditor(config = simpleConfig()) {
    return mountGrid(config).then((mounted) => {
        mounted.gridInterface.openFilterEditor();
        return mounted;
    });
}

/** the editor's dialog */
function container() {
    return document.querySelector('.filter-editor-content') as HTMLDialogElement;
}

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('filter editor - opening', () => {
    it('expect a modal dialog to be added to the body', async () => {
        const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
        await openEditor();

        expect(container()).toBeInstanceOf(HTMLDialogElement);
        expect(container().parentElement).toBe(document.body);
        expect(container().className).toEqual('simple-html-grid filter-editor-content simple-html-grid-tooltips');
        expect(container().open).toBe(true);
        // modal: the grid behind can not be used, as with the grey layer over the page before
        expect(showModal).toHaveBeenCalledTimes(1);
        expect(showModal.mock.contexts[0]).toBe(container());
    });

    it('expect the focus to go to the dialog itself when it opens', async () => {
        await openEditor();

        // showModal() moves the focus to the element with autofocus, happy-dom does not
        expect(container().hasAttribute('autofocus')).toBe(true);
        expect(container().tabIndex).toBe(-1);
    });

    it('expect a titlebar to be rendered', async () => {
        await openEditor();
        expect(container().querySelector('.filter-editor-titlebar')).not.toBeNull();
    });

    it('expect the dialog to get an explicit position, so it can be dragged', async () => {
        await openEditor();
        expect(container().style.left).not.toEqual('');
        expect(container().style.top).not.toEqual('');
    });

    it('expect a resize handle on every edge and corner', async () => {
        await openEditor();
        const content = container();

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

    it("expect the grid's texts to override a default tooltip, by the id ending with .tooltip", async () => {
        const config = simpleConfig();
        config.texts = { 'filterEditor.closeButton.tooltip': 'Lukk vinduet' };
        await openEditor(config);

        const overridden = container().querySelector('[data-tooltip="Lukk vinduet"]');
        expect(overridden).not.toBeNull();
    });

    it('expect a tooltip that is not overridden to keep its default text', async () => {
        const config = simpleConfig();
        config.texts = { 'filterEditor.closeButton.tooltip': 'Lukk vinduet' };
        await openEditor(config);

        const text = container().innerHTML;
        expect(text).toContain('Apply this filter to the grid and close the dialog');
    });

    it('expect hovering a button to show the tooltip in the dialog, not behind it on the body', async () => {
        await openEditor();
        const button = container().querySelector('[data-tooltip]') as HTMLElement;

        button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        // a modal dialog is in the top layer, over everything on the body
        const shown = document.body.querySelector('.simple-html-grid-tooltip') as HTMLElement;
        expect(shown).not.toBeNull();
        expect(shown.parentElement).toBe(container());
        expect(shown.style.display).toEqual('block');
        expect(shown.textContent).toEqual(button.getAttribute('data-tooltip'));
    });

    it('expect the tooltip of an element in a popover (a menu) to be shown in it', async () => {
        const popover = document.createElement('div');
        popover.popover = 'manual';
        popover.innerHTML = '<span data-tooltip="in the menu">x</span>';
        document.body.appendChild(popover);
        attachTooltips(popover);

        popover.querySelector('span')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        expect(document.querySelector('.simple-html-grid-tooltip')?.parentElement).toBe(popover);
    });

    it('expect the tooltip to hide again on mouseout, out of the document', async () => {
        await openEditor();
        const button = container().querySelector('[data-tooltip]') as HTMLElement;

        button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        const shown = document.body.querySelector('.simple-html-grid-tooltip') as HTMLElement;
        button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));

        expect(shown.style.display).toEqual('none');
        // not left in the dialog: a closed dialog would be kept in memory by it
        expect(shown.isConnected).toBe(false);
    });

    it('expect the tooltip not to be left in the dialog when it closes', async () => {
        await openEditor();
        const button = container().querySelector('[data-tooltip]') as HTMLElement;
        button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        const shown = document.querySelector('.simple-html-grid-tooltip') as HTMLElement;

        menuItem('Close').click();

        expect(shown.parentElement).toBeNull();
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

/** clicks an icon in the editor by its tooltip */
function clickIcon(tooltipText: string) {
    const holder = container().querySelector(`[data-tooltip="${tooltipText}"]`) as HTMLElement;
    (holder.querySelector('svg') ?? holder).dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const addCondition = () => clickIcon('Add a condition to this group');

describe('filter editor - rendered again in the same dialog', () => {
    it('expect an edit to keep the dialog, where it is and how big it is', async () => {
        await openEditor();
        const dialog = container();
        dialog.style.left = '33px';
        dialog.style.top = '44px';
        dialog.style.width = '555px';
        dialog.style.height = '444px';

        addCondition();

        expect(container()).toBe(dialog);
        expect(document.querySelectorAll('.filter-editor-content')).toHaveLength(1);
        expect(dialog.querySelectorAll('.grid-condition')).toHaveLength(1);
        expect([dialog.style.left, dialog.style.top, dialog.style.width, dialog.style.height]).toEqual([
            '33px',
            '44px',
            '555px',
            '444px'
        ]);
    });

    it('expect an edit to keep the elements, so the focus stays where it is', async () => {
        await openEditor();
        addCondition();
        const titlebar = container().querySelector('.filter-editor-titlebar');

        addCondition();

        expect(container().querySelector('.filter-editor-titlebar')).toBe(titlebar);
        expect(container().querySelectorAll('.grid-condition')).toHaveLength(2);
    });

    it('expect openFilterEditor() while it is open to start again in the same dialog', async () => {
        const { gridInterface } = await openEditor();
        const dialog = container();
        addCondition();

        gridInterface.openFilterEditor();

        expect(container()).toBe(dialog);
        expect(dialog.querySelectorAll('.grid-condition')).toHaveLength(0);
    });

    it('expect a typed value to be shown again after a render that does not change it', async () => {
        const { gridInterface, datasource } = await mountGrid();
        datasource.filter({ group: 'AND', children: [{ field: 'firstname', operator: 'EQUAL', value: 'a' }] });
        gridInterface.openFilterEditor();
        const input = container().querySelector('.grid-condition input') as HTMLInputElement;
        // the user types, then something else in the editor renders it again
        input.value = 'typed';
        input.dispatchEvent(new Event('input'));
        input.value = 'typed, not sent';

        addCondition();

        // the model says 'typed': a kept element shows the model, not what lit rendered last
        expect((container().querySelector('.grid-condition input') as HTMLInputElement).value).toEqual('typed');
    });
});

describe('filter editor - closing', () => {
    it('expect the Close button to close the dialog and take it off the page', async () => {
        const { element } = await openEditor();
        const dialog = container();
        const close = vi.spyOn(dialog, 'close');

        menuItem('Close').click();

        // close() first: the browser gives the focus back to where it was before the editor opened
        expect(close).toHaveBeenCalled();
        expect(dialog.isConnected).toBe(false);
        expect(gridOf(element).filterEditor).toBeNull();
    });

    it('expect the X in the titlebar to close it', async () => {
        await openEditor();

        (container().querySelector('.filter-editor-close') as HTMLElement).click();

        expect(container()).toBeNull();
    });

    it('expect a dialog the browser closed (Esc) to be taken off the page', async () => {
        const { element, gridInterface } = await openEditor();
        const dialog = container();

        // Esc: the browser sends cancel, closes the dialog and sends close. happy-dom does not, this
        // is the close
        dialog.close();

        expect(dialog.isConnected).toBe(false);
        expect(gridOf(element).filterEditor).toBeNull();
        // and it opens again
        gridInterface.openFilterEditor();
        expect(container()).not.toBeNull();
        expect(container()).not.toBe(dialog);
    });

    it('expect it to open centered again after it was closed', async () => {
        const { gridInterface } = await openEditor();
        const { left, top } = container().style;
        container().style.left = '3px';
        menuItem('Close').click();

        gridInterface.openFilterEditor();

        expect([container().style.left, container().style.top]).toEqual([left, top]);
    });

    it('expect removing the grid to close it, and its menu', async () => {
        const { element } = await openEditor();
        const dialog = container();
        addCondition();
        (container().querySelector('.grid-pick') as HTMLElement).click();
        const picker = document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;

        element.remove();

        expect(dialog.isConnected).toBe(false);
        expect(picker.isConnected).toBe(false);
    });
});

describe('filter editor - its menus', () => {
    /** the open menu: the element shown as a popover */
    const openMenuElement = () => document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;

    it('expect the field picker in the dialog: a menu outside a modal dialog can not be clicked', async () => {
        await openEditor();
        addCondition();

        (container().querySelector('.grid-pick') as HTMLElement).click();

        const picker = openMenuElement();
        expect(picker.parentElement).toBe(container());
        expect(picker.popover).toEqual('manual');
        expect(isPopoverShown(picker)).toBe(true);
    });

    it('expect the operator picker in the dialog too, and a pick to close it', async () => {
        await openEditor();
        addCondition();

        (container().querySelectorAll('.grid-pick')[1] as HTMLElement).click();
        expect(openMenuElement().parentElement).toBe(container());
        menuItem('Equal').click();

        expect(openMenuElement()).toBeUndefined();
        expect(container().querySelectorAll('.grid-pick')[1].textContent?.trim()).toEqual('Equal');
    });

    it('expect Esc to close the picker only, not the editor', async () => {
        await openEditor();
        addCondition();
        (container().querySelector('.grid-pick') as HTMLElement).click();

        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        container().dispatchEvent(esc);

        expect(openMenuElement()).toBeUndefined();
        // canceled: the browser closes a modal dialog on an Esc that is not
        expect(esc.defaultPrevented).toBe(true);
        expect(container().open).toBe(true);
    });

    it('expect Esc with no menu open to be left to the browser, which closes the editor', async () => {
        await openEditor();

        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        container().dispatchEvent(esc);

        expect(esc.defaultPrevented).toBe(false);
    });

    it('expect the date picker of a date condition in the dialog', async () => {
        const { gridInterface, datasource } = await mountGrid(
            { layout: { center: [{ fields: ['born'], width: 100 }] } },
            [{ born: new Date(2001, 4, 17) }],
            { fields: { born: 'date' } }
        );
        datasource.filter({ group: 'AND', children: [{ field: 'born', operator: 'EQUAL', value: new Date(2001, 4, 17) }] });
        gridInterface.openFilterEditor();
        vi.useFakeTimers();

        (container().querySelector('.grid-condition input') as HTMLInputElement).click();
        vi.runOnlyPendingTimers();
        vi.useRealTimers();

        const picker = document.querySelector('simple-html-date')?.parentElement as HTMLElement;
        expect(picker.parentElement).toBe(container());
        expect(isPopoverShown(picker)).toBe(true);
    });
});

/**
 * pointer events as a browser sends them. The pointer is captured on the handle at pointerdown, so the
 * browser sends the moves to the handle; happy-dom keeps track of the capture but does not send them
 * there, the tests do
 */
function pointer(type: string, x: number, y: number, init: PointerEventInit = {}) {
    return new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
        ...init
    });
}

/** the editor at 100,80, 650 by 600 */
async function openPlacedEditor() {
    const mounted = await openEditor();
    vi.spyOn(container(), 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 80, 650, 600));
    return mounted;
}

const box = () => {
    const { left, top, width, height } = container().style;
    return { left, top, width, height };
};

describe('filter editor - dragged by its titlebar, pointer events', () => {
    const titlebar = () => container().querySelector('.filter-editor-titlebar') as HTMLElement;

    it('expect the dialog to follow the pointer, and stop when it is let go', async () => {
        await openPlacedEditor();
        const bar = titlebar();

        const down = pointer('pointerdown', 200, 100);
        bar.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(true);
        expect(bar.hasPointerCapture(1)).toBe(true);

        bar.dispatchEvent(pointer('pointermove', 250, 130));
        expect([container().style.left, container().style.top]).toEqual(['150px', '110px']);

        bar.dispatchEvent(pointer('pointerup', 250, 130));
        bar.dispatchEvent(pointer('pointermove', 400, 400));
        expect([container().style.left, container().style.top]).toEqual(['150px', '110px']);
    });

    it('expect a touch (or a pen) to drag it as the mouse does', async () => {
        await openPlacedEditor();
        const bar = titlebar();

        bar.dispatchEvent(pointer('pointerdown', 200, 100, { pointerType: 'touch', pointerId: 7 }));
        bar.dispatchEvent(pointer('pointermove', 190, 150, { pointerType: 'touch', pointerId: 7 }));

        expect([container().style.left, container().style.top]).toEqual(['90px', '130px']);
    });

    it('expect pointercancel (the browser took the pointer) to stop it', async () => {
        await openPlacedEditor();
        const bar = titlebar();
        bar.dispatchEvent(pointer('pointerdown', 200, 100));
        bar.dispatchEvent(pointer('pointermove', 210, 100));

        bar.dispatchEvent(pointer('pointercancel', 210, 100));
        bar.dispatchEvent(pointer('pointermove', 400, 400));

        expect(container().style.left).toEqual('110px');
    });

    it('expect the moves of another pointer, a second finger, to be left alone', async () => {
        await openPlacedEditor();
        const bar = titlebar();
        bar.dispatchEvent(pointer('pointerdown', 200, 100));

        bar.dispatchEvent(pointer('pointermove', 400, 400, { pointerId: 2, isPrimary: false }));
        bar.dispatchEvent(pointer('pointerdown', 400, 400, { pointerId: 2, isPrimary: false }));

        expect(container().style.left).not.toEqual('300px');
        expect(bar.hasPointerCapture(2)).toBe(false);
    });

    it('expect the right mouse button and the close button not to start a drag', async () => {
        await openPlacedEditor();
        const bar = titlebar();
        const close = container().querySelector('.filter-editor-close') as HTMLElement;

        bar.dispatchEvent(pointer('pointerdown', 200, 100, { button: 2 }));
        close.dispatchEvent(pointer('pointerdown', 200, 100, { pointerId: 3 }));

        expect(bar.hasPointerCapture(1)).toBe(false);
        expect(bar.hasPointerCapture(3)).toBe(false);
    });

    it('expect it to be kept in the window, a bit of it to grab', async () => {
        await openPlacedEditor();
        const bar = titlebar();
        bar.dispatchEvent(pointer('pointerdown', 200, 100));

        bar.dispatchEvent(pointer('pointermove', 5000, -5000));
        expect([container().style.left, container().style.top]).toEqual([`${window.innerWidth - 40}px`, '0px']);

        bar.dispatchEvent(pointer('pointermove', -5000, 5000));
        expect([container().style.left, container().style.top]).toEqual([`${20 - 650}px`, `${window.innerHeight - 30}px`]);
    });

    it('expect the place to be kept when the editor renders again', async () => {
        await openPlacedEditor();
        const bar = titlebar();
        bar.dispatchEvent(pointer('pointerdown', 200, 100));
        bar.dispatchEvent(pointer('pointermove', 250, 130));
        bar.dispatchEvent(pointer('pointerup', 250, 130));

        addCondition();

        expect([container().style.left, container().style.top]).toEqual(['150px', '110px']);
    });
});

describe('filter editor - resized from every edge and corner, pointer events', () => {
    const handle = (side: string) => container().querySelector(`.simple-html-resize-handle.handle-${side}`) as HTMLElement;

    /** drags a handle 40px right and 30px down */
    function drag(side: string, dx = 40, dy = 30) {
        const element = handle(side);
        element.dispatchEvent(pointer('pointerdown', 300, 300));
        element.dispatchEvent(pointer('pointermove', 300 + dx, 300 + dy));
        element.dispatchEvent(pointer('pointerup', 300 + dx, 300 + dy));
    }

    // the editor is at 100,80, 650 by 600. Moving a west or north edge moves left/top too
    it.each([
        ['e', { left: '', top: '', width: '690px', height: '' }],
        ['w', { left: '140px', top: '', width: '610px', height: '' }],
        ['s', { left: '', top: '', width: '', height: '630px' }],
        ['n', { left: '', top: '110px', width: '', height: '570px' }],
        ['se', { left: '', top: '', width: '690px', height: '630px' }],
        ['sw', { left: '140px', top: '', width: '610px', height: '630px' }],
        ['ne', { left: '', top: '110px', width: '690px', height: '570px' }],
        ['nw', { left: '140px', top: '110px', width: '610px', height: '570px' }]
    ])('expect the %s handle to move its edges', async (side, expected) => {
        await openPlacedEditor();
        container().style.left = '';
        container().style.top = '';

        drag(side);

        expect(box()).toEqual(expected);
    });

    it('expect the pointer to be captured on the handle, and a finger not to start two resizes', async () => {
        await openPlacedEditor();
        const east = handle('e');

        east.dispatchEvent(pointer('pointerdown', 300, 300, { pointerType: 'touch' }));
        east.dispatchEvent(pointer('pointerdown', 300, 300, { pointerType: 'touch', pointerId: 2, isPrimary: false }));

        expect(east.hasPointerCapture(1)).toBe(true);
        expect(east.hasPointerCapture(2)).toBe(false);
    });

    it('expect the size to stop at the minimum, the left edge with it', async () => {
        await openPlacedEditor();
        // the tests have no stylesheet: the min size of the css, here
        container().style.minWidth = '460px';
        container().style.minHeight = '240px';

        drag('nw', 1000, 1000);

        expect(box()).toEqual({ left: `${100 + 650 - 460}px`, top: `${80 + 600 - 240}px`, width: '460px', height: '240px' });
    });

    it('expect the size to be kept when the editor renders again', async () => {
        await openPlacedEditor();
        drag('se');

        addCondition();

        expect([container().style.width, container().style.height]).toEqual(['690px', '630px']);
    });
});
