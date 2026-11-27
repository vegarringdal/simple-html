// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPopoverShown } from '../../__tests__/popoverStub';
import type { Datasource } from '../../datasource/dataSource';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { DRAG_DISTANCE, TOUCH_HOLD } from '../gridFunctions/dragEvent';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import type { GridInterface } from '../gridInterface';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import {
    dragAndDrop,
    labelCell,
    menuItem,
    openLabelMenu,
    pointerEvent,
    pointerOver,
    sleep,
    stubScrollSize,
    touchAt
} from './interactionTestHelpers';

/**
 * Column drag/drop in the header and to/from the grouping panel, and the click on a label that
 * sorts. Pointer events: mouse, pen and touch.
 *
 * The events are sent the way a browser sends them: pointerdown on the element under the pointer,
 * and once the drag has captured the pointer, the moves and the pointerup on the dragged cell.
 * happy-dom does no layout, so `pointerOver()` says what the browser's hit test
 * (document.elementFromPoint) finds under the pointer.
 */

const data = () => [
    { firstname: 'a', lastname: 'x', age: 1 },
    { firstname: 'b', lastname: 'y', age: 2 }
];

const threeColumns = (): GridConfig => ({
    layout: {
        center: [
            { fields: ['firstname'], width: 100 },
            { fields: ['lastname'], width: 100 },
            { fields: ['age'], width: 100 }
        ]
    }
});

// the fields of each center column, as the state has them
const centerRows = (gridInterface: GridInterface<unknown>) =>
    gridInterface.getState().layout.center.map((column) => column.fields);

// a drop zone of the label cell of a field
const zone = (element: GridElement, attribute: string, side: 'left' | 'right' | 'top' | 'bottom' | 'center') =>
    labelCell(element, attribute).querySelector(`.simple-html-grid-drop-zone-${side}`) as HTMLElement;

const panelOf = (element: GridElement) => element.querySelector('.simple-html-grid-panel') as HTMLElement;
const headerOf = (element: GridElement) => element.querySelector('.simple-html-grid-header') as HTMLElement;

// the element that follows the pointer during a drag
const ghost = () => document.querySelector('.simple-html-draggable-element') as HTMLElement | null;

const sorting = (datasource: Datasource) => datasource.getLastSorting().map((sort) => [sort.attribute, sort.ascending]);

// css class of the drop target under the pointer
const HOVER = 'simple-html-grid-col-resize-hover';

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

describe('drag/drop - moving a cell within its own column', () => {
    it('expect dropping a lower cell on the top of the cell above to swap their order', async () => {
        const config: GridConfig = {
            layout: {
                center: [
                    { fields: ['firstname', 'lastname'], width: 100 },
                    { fields: ['age'], width: 100 }
                ]
            }
        };
        const { element, gridInterface } = await mountGrid(config, data());

        const target = labelCell(element, 'firstname').querySelector('.simple-html-grid-drop-zone-top') as HTMLElement;
        dragAndDrop(labelCell(element, 'lastname'), target);

        expect(centerRows(gridInterface)).toEqual([['lastname', 'firstname'], ['age']]);
    });

    it('expect dropping the bottom cell below the top cell to put it in the middle', async () => {
        const config: GridConfig = {
            layout: { center: [{ fields: ['firstname', 'lastname', 'age'], width: 100 }] }
        };
        const { element, gridInterface } = await mountGrid(config, data());

        const target = labelCell(element, 'firstname').querySelector('.simple-html-grid-drop-zone-bottom') as HTMLElement;
        dragAndDrop(labelCell(element, 'age'), target);

        expect(centerRows(gridInterface)).toEqual([['firstname', 'age', 'lastname']]);
    });
});

describe('drag/drop - group chips', () => {
    it('expect a group chip dropped on a column to change no columns', async () => {
        const { element, datasource, gridInterface } = await mountGrid(threeColumns(), data());
        datasource.group([{ attribute: 'lastname', title: 'Lastname' }]);
        await sleep(10);

        const chip = element.querySelector('.simple-html-grid-panel-label') as HTMLElement;
        const target = labelCell(element, 'age').querySelector('.simple-html-grid-drop-zone-center') as HTMLElement;
        dragAndDrop(chip, target);

        expect(centerRows(gridInterface)).toEqual([['firstname'], ['lastname'], ['age']]);
    });

    it('expect a group chip dropped next to a column to add no column', async () => {
        const { element, datasource, gridInterface } = await mountGrid(threeColumns(), data());
        datasource.group([{ attribute: 'lastname', title: 'Lastname' }]);
        await sleep(10);

        const chip = element.querySelector('.simple-html-grid-panel-label') as HTMLElement;
        const target = labelCell(element, 'age').querySelector('.simple-html-grid-drop-zone-left') as HTMLElement;
        dragAndDrop(chip, target);

        expect(centerRows(gridInterface)).toEqual([['firstname'], ['lastname'], ['age']]);
    });

    it('expect dropping an already grouped column on the panel to not group on it twice', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        datasource.group([{ attribute: 'lastname', title: 'Lastname' }]);
        await sleep(10);

        const panel = element.querySelector('.simple-html-grid-panel') as HTMLElement;
        dragAndDrop(labelCell(element, 'lastname'), panel);

        expect(datasource.getGrouping().map((group: any) => group.attribute)).toEqual(['lastname']);
    });
});

describe('drag/drop - drop targets', () => {
    it('expect dropping on the right zone of a column to make the field a column of its own right of it', async () => {
        const { element, gridInterface } = await mountGrid(threeColumns(), data());

        dragAndDrop(labelCell(element, 'firstname'), zone(element, 'lastname', 'right'));

        expect(centerRows(gridInterface)).toEqual([['lastname'], ['firstname'], ['age']]);
    });

    it('expect dropping on the center of a cell to swap the two fields', async () => {
        const { element, gridInterface } = await mountGrid(threeColumns(), data());

        dragAndDrop(labelCell(element, 'firstname'), zone(element, 'age', 'center'));

        expect(centerRows(gridInterface)).toEqual([['age'], ['lastname'], ['firstname']]);
    });

    it('expect dropping a label on the panel to group on it', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());

        dragAndDrop(labelCell(element, 'age'), panelOf(element));

        expect(datasource.getGrouping().map((group) => group.attribute)).toEqual(['age']);
    });

    it('expect the group chip to show the label the header shows', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());

        dragAndDrop(labelCell(element, 'age'), panelOf(element));
        await sleep(10);

        expect(datasource.getGrouping()).toEqual([{ attribute: 'age', title: 'Age' }]);
        const chip = element.querySelector('.simple-html-grid-panel-label-text') as HTMLElement;
        expect(chip.textContent?.trim()).toEqual('Age');
    });

    it('expect a group chip dropped on the left zone of another chip to go before it', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        datasource.group([
            { attribute: 'lastname', title: 'Lastname' },
            { attribute: 'age', title: 'Age' }
        ]);
        await sleep(10);

        const [lastnameChip, ageChip] = Array.from(element.querySelectorAll('.simple-html-grid-panel-label')) as HTMLElement[];
        dragAndDrop(ageChip, lastnameChip.querySelector('.simple-html-grid-drop-zone-left-panel') as HTMLElement);

        expect(datasource.getGrouping().map((group) => group.attribute)).toEqual(['age', 'lastname']);
    });

    it('expect a drop on nothing to change nothing', async () => {
        const { element, datasource, gridInterface } = await mountGrid(threeColumns(), data());

        // the label itself, not one of its drop zones
        dragAndDrop(labelCell(element, 'firstname'), labelCell(element, 'age'));

        expect(centerRows(gridInterface)).toEqual([['firstname'], ['lastname'], ['age']]);
        expect(sorting(datasource)).toEqual([]);
        expect(ghost()).toBeNull();
    });

    it('expect the panel of another grid on the page not to be a drop target', async () => {
        const first = await mountGrid(threeColumns(), data());
        const second = await mountGrid(threeColumns(), data());

        dragAndDrop(labelCell(first.element, 'age'), panelOf(second.element));

        expect(first.datasource.getGrouping()).toEqual([]);
        expect(second.datasource.getGrouping()).toEqual([]);
    });
});

describe('drag/drop - a click or a drag', () => {
    it('expect a click on a label to sort on it, and the next click to turn the direction', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'age');

        label.dispatchEvent(pointerEvent('pointerdown'));
        label.dispatchEvent(pointerEvent('pointerup'));
        expect(sorting(datasource)).toEqual([['age', true]]);

        // a rebuild after the sort made new label cells
        labelCell(element, 'age').dispatchEvent(pointerEvent('pointerdown'));
        labelCell(element, 'age').dispatchEvent(pointerEvent('pointerup'));
        expect(sorting(datasource)).toEqual([['age', false]]);
    });

    it('expect shift+click to add the field to the sort', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        datasource.sort({ attribute: 'firstname', ascending: true });

        labelCell(element, 'age').dispatchEvent(pointerEvent('pointerdown', { shiftKey: true }));
        labelCell(element, 'age').dispatchEvent(pointerEvent('pointerup', { shiftKey: true }));

        expect(sorting(datasource)).toEqual([
            ['firstname', true],
            ['age', true]
        ]);
    });

    it('expect a slow click to sort too: a mouse has no time limit', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'age');

        label.dispatchEvent(pointerEvent('pointerdown'));
        await sleep(TOUCH_HOLD + 50);
        expect(ghost()).toBeNull();
        label.dispatchEvent(pointerEvent('pointerup'));

        expect(sorting(datasource)).toEqual([['age', true]]);
    });

    it('expect a press that moves less than DRAG_DISTANCE to be a click', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'age');

        label.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
        label.dispatchEvent(pointerEvent('pointermove', { clientX: 10 + DRAG_DISTANCE - 1, clientY: 10 }));
        expect(ghost()).toBeNull();
        label.dispatchEvent(pointerEvent('pointerup', { clientX: 10 + DRAG_DISTANCE - 1, clientY: 10 }));

        expect(sorting(datasource)).toEqual([['age', true]]);
    });

    it('expect a press that moves DRAG_DISTANCE to be a drag, which does not sort', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'age');
        pointerOver(null);

        label.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
        label.dispatchEvent(pointerEvent('pointermove', { clientX: 10, clientY: 10 + DRAG_DISTANCE }));
        expect(ghost()).not.toBeNull();
        label.dispatchEvent(pointerEvent('pointerup', { clientX: 10, clientY: 10 + DRAG_DISTANCE }));

        expect(sorting(datasource)).toEqual([]);
        expect(ghost()).toBeNull();
    });

    it('expect the dragged cell to capture the pointer once it is a drag, not on the press', async () => {
        const { element } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'age');
        pointerOver(null);

        // a click on a child of the cell (the remove icon of a group chip) has to reach that child
        label.dispatchEvent(pointerEvent('pointerdown', { pointerId: 7, clientX: 10, clientY: 10 }));
        expect(label.hasPointerCapture(7)).toBe(false);

        label.dispatchEvent(pointerEvent('pointermove', { pointerId: 7, clientX: 50, clientY: 10 }));
        expect(label.hasPointerCapture(7)).toBe(true);
        label.dispatchEvent(pointerEvent('pointerup', { pointerId: 7, clientX: 50, clientY: 10 }));
    });

    it('expect the ghost, the drop zones and the drop target under the pointer to show while dragging', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'firstname');
        const left = zone(element, 'age', 'left');
        const panel = panelOf(element);
        const hitTest = pointerOver(left);

        label.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
        label.dispatchEvent(pointerEvent('pointermove', { clientX: 250, clientY: 30 }));

        expect(ghost()?.style.transform).toBe('translate3d(240px, 20px, 0px)');
        // elementFromPoint must not find the ghost
        expect(ghost()?.style.pointerEvents).toBe('none');
        expect(headerOf(element).classList.contains('dragdrop-state')).toBe(true);
        expect(panel.classList.contains('dragdrop-state')).toBe(true);
        expect(left.classList.contains(HOVER)).toBe(true);

        hitTest.mockReturnValue(panel);
        label.dispatchEvent(pointerEvent('pointermove', { clientX: 250, clientY: 5 }));
        expect(left.classList.contains(HOVER)).toBe(false);
        expect(panel.classList.contains(HOVER)).toBe(true);

        label.dispatchEvent(pointerEvent('pointerup', { clientX: 250, clientY: 5 }));
        expect(ghost()).toBeNull();
        expect(headerOf(element).classList.contains('dragdrop-state')).toBe(false);
        expect(panel.classList.contains('dragdrop-state')).toBe(false);
        expect(panel.classList.contains(HOVER)).toBe(false);
        expect(datasource.getGrouping().map((group) => group.attribute)).toEqual(['firstname']);
    });

    it('expect the zones of an empty label cell not to be a drop target', async () => {
        const config: GridConfig = {
            layout: {
                center: [
                    { fields: ['firstname', 'lastname'], width: 100 },
                    { fields: ['age'], width: 100 }
                ]
            }
        };
        const { element, gridInterface } = await mountGrid(config, data());
        const empty = Array.from(element.querySelectorAll('.simple-html-grid-col-cell.simple-html-label')).find(
            (cell) => cell.getAttribute('type') === 'label' && !(cell as HTMLElement & { $attribute: string | null }).$attribute
        ) as HTMLElement;
        const emptyZone = empty.querySelector('.simple-html-grid-drop-zone-center') as HTMLElement;
        const label = labelCell(element, 'firstname');
        pointerOver(emptyZone);

        label.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
        label.dispatchEvent(pointerEvent('pointermove', { clientX: 150, clientY: 30 }));
        expect(emptyZone.classList.contains(HOVER)).toBe(false);
        label.dispatchEvent(pointerEvent('pointerup', { clientX: 150, clientY: 30 }));

        expect(centerRows(gridInterface)).toEqual([['firstname', 'lastname'], ['age']]);
    });

    it('expect only the left button of the primary pointer to drag or sort', async () => {
        const { element, datasource, gridInterface } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'firstname');
        pointerOver(zone(element, 'age', 'center'));

        // right button
        label.dispatchEvent(pointerEvent('pointerdown', { button: 2, buttons: 2, clientX: 10, clientY: 10 }));
        label.dispatchEvent(pointerEvent('pointermove', { buttons: 2, clientX: 250, clientY: 10 }));
        expect(ghost()).toBeNull();
        label.dispatchEvent(pointerEvent('pointerup', { button: 2, clientX: 250, clientY: 10 }));

        // a second finger
        label.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: false }));
        label.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, pointerType: 'touch', isPrimary: false }));

        expect(centerRows(gridInterface)).toEqual([['firstname'], ['lastname'], ['age']]);
        expect(sorting(datasource)).toEqual([]);
    });

    it('expect the events of another pointer to be ignored', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'age');

        label.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 }));
        // a pen moving and lifted somewhere else on the page
        document.body.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, pointerType: 'pen', clientX: 300, clientY: 10 }));
        document.body.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, pointerType: 'pen' }));
        expect(ghost()).toBeNull();
        expect(sorting(datasource)).toEqual([]);

        label.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 10, clientY: 10 }));
        expect(sorting(datasource)).toEqual([['age', true]]);
    });

    it('expect pointercancel to end the drag without a drop', async () => {
        const { element, datasource, gridInterface } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'firstname');
        const center = zone(element, 'age', 'center');
        pointerOver(center);

        label.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
        label.dispatchEvent(pointerEvent('pointermove', { clientX: 250, clientY: 10 }));
        expect(ghost()).not.toBeNull();
        label.dispatchEvent(pointerEvent('pointercancel', { clientX: 250, clientY: 10 }));

        expect(ghost()).toBeNull();
        expect(headerOf(element).classList.contains('dragdrop-state')).toBe(false);
        expect(center.classList.contains(HOVER)).toBe(false);

        // the gesture is over: a pointerup after it neither drops nor sorts
        label.dispatchEvent(pointerEvent('pointerup', { clientX: 250, clientY: 10 }));
        expect(centerRows(gridInterface)).toEqual([['firstname'], ['lastname'], ['age']]);
        expect(sorting(datasource)).toEqual([]);
    });

    it('expect a pen to drag like a mouse', async () => {
        const { element, gridInterface } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'firstname');
        pointerOver(zone(element, 'age', 'center'));

        label.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'pen', clientX: 10, clientY: 10 }));
        label.dispatchEvent(pointerEvent('pointermove', { pointerType: 'pen', clientX: 250, clientY: 10 }));
        label.dispatchEvent(pointerEvent('pointerup', { pointerType: 'pen', clientX: 250, clientY: 10 }));

        expect(centerRows(gridInterface)).toEqual([['age'], ['lastname'], ['firstname']]);
    });

    it('expect label cells and group chips to keep the browser from scrolling under a finger', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        datasource.group([{ attribute: 'lastname', title: 'Lastname' }]);
        await sleep(10);

        expect(labelCell(element, 'age').style.touchAction).toBe('none');
        expect((element.querySelector('.simple-html-grid-panel-label') as HTMLElement).style.touchAction).toBe('none');
    });
});

describe('drag/drop - touch', () => {
    const touch = { pointerType: 'touch' };

    // the touch listeners of the grid (touchScroll.ts) scroll this element
    const bodyScroller = (element: GridElement) => element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;

    const touchEvent = (type: 'touchstart' | 'touchmove', target: Element, clientX: number, clientY: number) =>
        new TouchEvent(type, { bubbles: true, cancelable: true, touches: [touchAt(target, clientX, clientY)] });

    it('expect a tap on a label to sort', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'age');

        label.dispatchEvent(pointerEvent('pointerdown', touch));
        label.dispatchEvent(pointerEvent('pointerup', touch));

        expect(sorting(datasource)).toEqual([['age', true]]);
    });

    it('expect a finger held still for TOUCH_HOLD to drag, and the grid not to scroll under it', async () => {
        const { element, gridInterface } = await mountGrid(threeColumns(), data());
        stubScrollSize(element);
        const label = labelCell(element, 'firstname');
        // the finger goes down on the text of the label, the touch events go there
        const text = label.querySelector('[data-attribute-header]') as HTMLElement;
        pointerOver(zone(element, 'age', 'center'));

        text.dispatchEvent(pointerEvent('pointerdown', { ...touch, clientX: 10, clientY: 100 }));
        text.dispatchEvent(touchEvent('touchstart', text, 10, 100));
        expect(ghost()).toBeNull();
        await sleep(TOUCH_HOLD + 20);
        expect(ghost()).not.toBeNull();
        // in the top layer, over the column chooser and a dialog the grid is in
        expect(ghost()?.popover).toBe('manual');
        expect(isPopoverShown(ghost())).toBe(true);
        expect(label.hasPointerCapture(1)).toBe(true);

        // captured: the pointer events go to the label cell, the touch events stay on the text.
        // Up 40px twice: a swipe like this scrolls the rows 40px (next test). The moves of the drag are
        // canceled: nothing pans under it
        label.dispatchEvent(pointerEvent('pointermove', { ...touch, clientX: 250, clientY: 60 }));
        const moves = [60, 20].map((y) => touchEvent('touchmove', text, 250, y));
        for (const move of moves) {
            text.dispatchEvent(move);
        }
        expect(bodyScroller(element).scrollTop).toBe(0);
        expect(moves.every((move) => move.defaultPrevented)).toBe(true);

        label.dispatchEvent(pointerEvent('pointerup', { ...touch, clientX: 250, clientY: 60 }));
        expect(centerRows(gridInterface)).toEqual([['age'], ['lastname'], ['firstname']]);
        expect(ghost()).toBeNull();
    });

    it('expect a finger that moves before TOUCH_HOLD to scroll the grid, not drag or sort', async () => {
        const { element, datasource, gridInterface } = await mountGrid(threeColumns(), data());
        stubScrollSize(element);
        const label = labelCell(element, 'firstname');
        const text = label.querySelector('[data-attribute-header]') as HTMLElement;
        pointerOver(zone(element, 'age', 'center'));

        text.dispatchEvent(pointerEvent('pointerdown', { ...touch, clientX: 10, clientY: 100 }));
        text.dispatchEvent(touchEvent('touchstart', text, 10, 100));
        text.dispatchEvent(pointerEvent('pointermove', { ...touch, clientX: 10, clientY: 60 }));
        // the first move tells a swipe from a press, the rows follow the finger from there (touchScroll.ts)
        text.dispatchEvent(touchEvent('touchmove', text, 10, 60));
        text.dispatchEvent(pointerEvent('pointermove', { ...touch, clientX: 10, clientY: 20 }));
        text.dispatchEvent(touchEvent('touchmove', text, 10, 20));
        text.dispatchEvent(pointerEvent('pointerup', { ...touch, clientX: 10, clientY: 20 }));
        await sleep(TOUCH_HOLD + 20);

        // swiped up 40px after that: the rows scroll down 40px
        expect(bodyScroller(element).scrollTop).toBe(40);
        expect(ghost()).toBeNull();
        expect(sorting(datasource)).toEqual([]);
        expect(centerRows(gridInterface)).toEqual([['firstname'], ['lastname'], ['age']]);
    });

    it('expect a field of the column chooser to pan its list until a hold makes it a drag, then not', async () => {
        const { element, gridInterface } = await mountGrid(threeColumns(), data());
        openLabelMenu(element, 'age');
        menuItem('Column chooser').click();
        const field = Array.from(
            document.querySelectorAll<HTMLCellElement>('.simple-html-grid-menu-sub .simple-html-grid-menu-item')
        ).find((item) => item.$attribute === 'firstname') as HTMLCellElement;
        expect(field.style.touchAction).toBe('pan-y');

        // a swipe: the browser pans the list, nothing cancels its moves, nothing is dragged
        field.dispatchEvent(pointerEvent('pointerdown', { ...touch, clientX: 10, clientY: 100 }));
        field.dispatchEvent(pointerEvent('pointermove', { ...touch, clientX: 10, clientY: 60 }));
        const pan = touchEvent('touchmove', field, 10, 60);
        field.dispatchEvent(pan);
        field.dispatchEvent(pointerEvent('pointercancel', touch));
        await sleep(TOUCH_HOLD + 20);
        expect(pan.defaultPrevented).toBe(false);
        expect(ghost()).toBeNull();

        // held: a drag, its moves canceled - the list does not pan under it. Dropped on a label's left
        pointerOver(zone(element, 'age', 'left'));
        field.dispatchEvent(pointerEvent('pointerdown', { ...touch, clientX: 10, clientY: 100 }));
        await sleep(TOUCH_HOLD + 20);
        expect(ghost()).not.toBeNull();
        field.dispatchEvent(pointerEvent('pointermove', { ...touch, clientX: 10, clientY: 60 }));
        const drag = touchEvent('touchmove', field, 10, 60);
        field.dispatchEvent(drag);
        field.dispatchEvent(pointerEvent('pointerup', { ...touch, clientX: 10, clientY: 60 }));

        expect(drag.defaultPrevented).toBe(true);
        expect(ghost()).toBeNull();
        // a field of the chooser is a new column: inserted left of age (the one in the layout stays)
        expect(centerRows(gridInterface).slice(-2)).toEqual([['firstname'], ['age']]);
    });

    /** the chooser open from the header menu of age, and its field of `attribute` */
    const chooserField = (element: GridElement, attribute: string) => {
        openLabelMenu(element, 'age');
        menuItem('Column chooser').click();
        return Array.from(
            document.querySelectorAll<HTMLCellElement>('.simple-html-grid-menu-sub .simple-html-grid-menu-item')
        ).find((item) => item.$attribute === attribute) as HTMLCellElement;
    };

    it('expect the handle of a chooser field to drag at once with a finger: no hold, its moves canceled', async () => {
        const { element, gridInterface } = await mountGrid(threeColumns(), data());
        const field = chooserField(element, 'firstname');
        const handle = field.querySelector('.simple-html-grid-drag-handle') as HTMLElement;
        pointerOver(zone(element, 'age', 'left'));

        handle.dispatchEvent(pointerEvent('pointerdown', { ...touch, clientX: 10, clientY: 100 }));
        // moved at once, straight up: a drag, not a swipe
        field.dispatchEvent(pointerEvent('pointermove', { ...touch, clientX: 10, clientY: 80 }));
        expect(ghost()).not.toBeNull();
        const move = touchEvent('touchmove', handle, 10, 60);
        handle.dispatchEvent(move);
        expect(move.defaultPrevented).toBe(true);
        field.dispatchEvent(pointerEvent('pointerup', { ...touch, clientX: 10, clientY: 60 }));

        expect(ghost()).toBeNull();
        expect(centerRows(gridInterface).slice(-2)).toEqual([['firstname'], ['age']]);
        // the drag is over: the moves of the next press pan the list again
        const after = touchEvent('touchmove', handle, 10, 40);
        handle.dispatchEvent(after);
        expect(after.defaultPrevented).toBe(false);
    });

    it('expect a long press to be no menu on a chooser field: its contextmenu canceled, the drag goes on', async () => {
        const { element, gridInterface } = await mountGrid(threeColumns(), data());
        const field = chooserField(element, 'firstname');
        const label = field.querySelector('.simple-html-grid-chooser-label') as HTMLElement;
        pointerOver(zone(element, 'age', 'left'));

        label.dispatchEvent(pointerEvent('pointerdown', { ...touch, clientX: 10, clientY: 100 }));
        await sleep(TOUCH_HOLD + 20);
        expect(ghost()).not.toBeNull();
        // Android's own long press, at 500ms (and the grid's, longPress.ts): a touch contextmenu
        const menu = new PointerEvent('contextmenu', { bubbles: true, cancelable: true, pointerType: 'touch', button: 2 });
        label.dispatchEvent(menu);
        expect(menu.defaultPrevented).toBe(true);
        expect(ghost()).not.toBeNull();
        field.dispatchEvent(pointerEvent('pointermove', { ...touch, clientX: 10, clientY: 60 }));
        field.dispatchEvent(pointerEvent('pointerup', { ...touch, clientX: 10, clientY: 60 }));

        expect(centerRows(gridInterface).slice(-2)).toEqual([['firstname'], ['age']]);
        // a right click of a mouse on it is the browser's: not canceled
        const right = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        label.dispatchEvent(right);
        expect(right.defaultPrevented).toBe(false);
    });

    it('expect a contextmenu on the field to end the drag a hold started: no drop, no sort (a long press, longPress.ts)', async () => {
        const { element, datasource, gridInterface } = await mountGrid(threeColumns(), data());
        const label = labelCell(element, 'firstname');
        const text = label.querySelector('[data-attribute-header]') as HTMLElement;
        pointerOver(zone(element, 'age', 'center'));

        text.dispatchEvent(pointerEvent('pointerdown', { ...touch, clientX: 10, clientY: 100 }));
        await sleep(TOUCH_HOLD + 20);
        expect(ghost()).not.toBeNull();
        text.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        label.dispatchEvent(pointerEvent('pointerup', { ...touch, clientX: 250, clientY: 60 }));

        expect(ghost()).toBeNull();
        expect(sorting(datasource)).toEqual([]);
        expect(centerRows(gridInterface)).toEqual([['firstname'], ['lastname'], ['age']]);
    });

    it('expect a swipe on the rows to scroll the grid', async () => {
        const { element } = await mountGrid(threeColumns(), data());
        stubScrollSize(element);
        const cell = element.querySelector('input[data-attribute="firstname"]') as HTMLElement;

        cell.dispatchEvent(touchEvent('touchstart', cell, 10, 300));
        // a swipe from here on, see touchScroll.ts
        cell.dispatchEvent(touchEvent('touchmove', cell, 10, 250));
        cell.dispatchEvent(touchEvent('touchmove', cell, 10, 200));

        expect(bodyScroller(element).scrollTop).toBe(50);
    });
});
