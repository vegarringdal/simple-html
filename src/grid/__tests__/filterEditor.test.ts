// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPopoverShown } from '../../__tests__/popoverStub';
// the date picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { MAX_FILTER_EDITOR_STEPS } from '../gridFunctions/filterEditorHistory';
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

        // showModal() moves the focus to the element with autofocus, happy-dom does not: Chrome 131
        // gives it to the first button, the grid focuses the dialog itself after showModal()
        expect(container().hasAttribute('autofocus')).toBe(true);
        expect(container().tabIndex).toBe(-1);
        expect(document.activeElement).toBe(container());
    });

    it('expect the dialog to be named by its title', async () => {
        await openEditor();

        const id = container().getAttribute('aria-labelledby') as string;
        expect(document.getElementById(id)?.textContent?.trim()).toEqual('Filter Editor');
        expect(document.getElementById(id)?.closest('.filter-editor-titlebar')).not.toBeNull();
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

    it('expect the footer buttons: Undo, Redo, Cancel, Apply, Apply & close - buttons, the last the primary one', async () => {
        await openEditor();
        const buttons = Array.from(container().querySelectorAll<HTMLButtonElement>('.filter-editor-footer button'));

        // in the order they are shown: Tab goes through them in that order. Undo and Redo are icons
        expect(buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim())).toEqual([
            'Undo',
            'Redo',
            'Cancel',
            'Apply',
            'Apply & close'
        ]);
        expect(buttons.map((button) => button.type)).toEqual(['button', 'button', 'button', 'button', 'button']);
        expect(buttons.map((button) => button.classList.contains('simple-html-grid-button-primary'))).toEqual([
            false,
            false,
            false,
            false,
            true
        ]);
    });

    it('expect the ✕ of the titlebar to be a button named for a screen reader', async () => {
        await openEditor();
        const close = container().querySelector('.filter-editor-close') as HTMLButtonElement;

        expect(close.tagName).toEqual('BUTTON');
        expect(close.getAttribute('aria-label')).toEqual('Close without filtering');
    });
});

describe('filter editor - tooltips', () => {
    it('expect every footer button to carry a data-tooltip', async () => {
        await openEditor();
        const buttons = Array.from(container().querySelectorAll('.filter-editor-footer button'));
        expect(buttons.length).toEqual(5);
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

        menuItem('Cancel').click();

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
        expect(dialog.querySelectorAll('.filter-editor-condition')).toHaveLength(1);
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
        expect(container().querySelectorAll('.filter-editor-condition')).toHaveLength(2);
    });

    it('expect openFilterEditor() while it is open to start again in the same dialog', async () => {
        const { gridInterface } = await openEditor();
        const dialog = container();
        addCondition();

        gridInterface.openFilterEditor();

        expect(container()).toBe(dialog);
        expect(dialog.querySelectorAll('.filter-editor-condition')).toHaveLength(0);
    });

    it('expect a typed value to be shown again after a render that does not change it', async () => {
        const { gridInterface, datasource } = await mountGrid();
        datasource.filter({ group: 'AND', children: [{ field: 'firstname', operator: 'EQUAL', value: 'a' }] });
        gridInterface.openFilterEditor();
        const input = container().querySelector('.filter-editor-value') as HTMLInputElement;
        // the user types, then something else in the editor renders it again
        input.value = 'typed';
        input.dispatchEvent(new Event('input'));
        input.value = 'typed, not sent';

        addCondition();

        // the model says 'typed': a kept element shows the model, not what lit rendered last
        expect((container().querySelector('.filter-editor-value') as HTMLInputElement).value).toEqual('typed');
    });
});

describe('filter editor - closing', () => {
    it('expect the Cancel button to close the dialog and take it off the page', async () => {
        const { element } = await openEditor();
        const dialog = container();
        const close = vi.spyOn(dialog, 'close');

        menuItem('Cancel').click();

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
        menuItem('Cancel').click();

        gridInterface.openFilterEditor();

        expect([container().style.left, container().style.top]).toEqual([left, top]);
    });

    it('expect removing the grid to close it, and its menu', async () => {
        const { element } = await openEditor();
        const dialog = container();
        addCondition();
        (container().querySelector('.filter-editor-pick-field') as HTMLElement).click();
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

        (container().querySelector('.filter-editor-pick-field') as HTMLElement).click();

        const picker = openMenuElement();
        expect(picker.parentElement).toBe(container());
        expect(picker.popover).toEqual('manual');
        expect(isPopoverShown(picker)).toBe(true);
    });

    it('expect the operator picker in the dialog too, and a pick to close it', async () => {
        await openEditor();
        addCondition();

        (container().querySelector('.filter-editor-pick-operator') as HTMLElement).click();
        expect(openMenuElement().parentElement).toBe(container());
        menuItem('Equal').click();

        expect(openMenuElement()).toBeUndefined();
        expect(container().querySelector('.filter-editor-pick-operator')?.textContent?.trim()).toEqual('Equal');
    });

    it('expect Esc to close the picker only, not the editor', async () => {
        await openEditor();
        addCondition();
        (container().querySelector('.filter-editor-pick-field') as HTMLElement).click();

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

        (container().querySelector('.filter-editor-value') as HTMLInputElement).click();
        vi.runOnlyPendingTimers();
        vi.useRealTimers();

        const picker = document.querySelector('simple-html-date')?.parentElement as HTMLElement;
        expect(picker.parentElement).toBe(container());
        expect(isPopoverShown(picker)).toBe(true);
    });
});

/** a keydown as the browser sends it: the grid's menus take the focus when the last input was a key */
const press = (target: Element, key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
};

/** the class names of the children of an element, the first class of each */
const parts = (element: Element) => Array.from(element.children, (child) => child.classList[0]);

describe('filter editor - a condition is one row', () => {
    /** the editor with these conditions in an AND group */
    async function openWith(...conditions: object[]) {
        const mounted = await mountGrid();
        mounted.datasource.filter({ group: 'AND', children: conditions as any });
        mounted.gridInterface.openFilterEditor();
        return mounted;
    }
    const rows = () => Array.from(container().querySelectorAll('.filter-editor-condition'));

    it('expect field, operator, value, match case (text), switch and delete in one row, no label row', async () => {
        await openWith(
            { field: 'firstname', operator: 'EQUAL', value: 'first1' },
            { field: 'age', operator: 'EQUAL', value: 10 }
        );

        expect(rows()).toHaveLength(2);
        expect(parts(rows()[0])).toEqual([
            'filter-editor-pick',
            'filter-editor-pick',
            'filter-editor-value-slot',
            'filter-editor-icon',
            'filter-editor-icon',
            'filter-editor-icon'
        ]);
        expect(rows()[0].children[3].classList.contains('filter-editor-case')).toBe(true);
        // a number has no case: the room of the toggle, so the rows line up
        expect(parts(rows()[1])).toEqual([
            'filter-editor-pick',
            'filter-editor-pick',
            'filter-editor-value-slot',
            'filter-editor-icon-space',
            'filter-editor-icon',
            'filter-editor-icon'
        ]);
        // the labels are names of the controls now, not a line of text over every condition
        expect(container().textContent).not.toContain('Query Field');
        expect(container().textContent).not.toContain('Filter value');
    });

    it('expect the pickers to be buttons that open a menu, named "label: what is picked"', async () => {
        await openWith({ field: 'firstname', operator: 'EQUAL', value: 'first1' });
        const [field, operator] = Array.from(rows()[0].querySelectorAll<HTMLButtonElement>('.filter-editor-pick'));

        expect([field.tagName, field.type, field.getAttribute('aria-haspopup')]).toEqual(['BUTTON', 'button', 'menu']);
        expect(field.getAttribute('aria-label')).toEqual('Field: Firstname');
        expect(field.textContent?.trim()).toEqual('Firstname');
        expect(operator.getAttribute('aria-label')).toEqual('Operator: Equal');
        expect(operator.textContent?.trim()).toEqual('Equal');
        expect(field.classList.contains('filter-editor-pick-empty')).toBe(false);
    });

    it('expect a new condition to show the placeholders, quiet, and the labels alone as names', async () => {
        await openWith();
        addCondition();
        const [field, operator] = Array.from(rows()[0].querySelectorAll<HTMLButtonElement>('.filter-editor-pick'));

        expect([field.textContent?.trim(), operator.textContent?.trim()]).toEqual(['Field', 'Operator']);
        expect([field.getAttribute('aria-label'), operator.getAttribute('aria-label')]).toEqual(['Field', 'Operator']);
        expect(field.classList.contains('filter-editor-pick-empty')).toBe(true);
        expect(operator.classList.contains('filter-editor-pick-empty')).toBe(true);
    });

    it('expect the value input to be named and to have a placeholder', async () => {
        await openWith({ field: 'firstname', operator: 'EQUAL', value: 'first1' });
        const input = rows()[0].querySelector('.filter-editor-value') as HTMLInputElement;

        expect([input.tagName, input.value]).toEqual(['INPUT', 'first1']);
        expect([input.getAttribute('aria-label'), input.placeholder]).toEqual(['Value', 'Value']);
    });

    it('expect IN to have a textarea, a value per line', async () => {
        await openWith({ field: 'firstname', operator: 'IN', value: ['first1', 'first2'] });
        const textarea = rows()[0].querySelector('.filter-editor-value') as HTMLTextAreaElement;

        expect([textarea.tagName, textarea.value, textarea.getAttribute('aria-label')]).toEqual([
            'TEXTAREA',
            'first1\nfirst2',
            'Value'
        ]);
    });

    it('expect no value input for "is blank" and "is not blank": they take none', async () => {
        await openWith({ field: 'firstname', operator: 'IS_BLANK' }, { field: 'lastname', operator: 'IS_NOT_BLANK' });

        expect(rows().map((row) => row.querySelector('.filter-editor-value-slot')?.children.length)).toEqual([0, 0]);
    });

    it('expect a condition compared with a column to show a column picker as its value', async () => {
        await openWith({ field: 'firstname', operator: 'EQUAL', valueField: 'lastname' });
        const column = rows()[0].querySelector('.filter-editor-value-slot .filter-editor-pick') as HTMLButtonElement;

        expect(column.textContent?.trim()).toEqual('Lastname');
        expect(column.getAttribute('aria-label')).toEqual('Value: Lastname');

        // switched to a value and back: the column is not picked yet
        clickIcon('Compare against a typed in value instead of another column');
        expect(rows()[0].querySelector('.filter-editor-value-slot input')).not.toBeNull();
        clickIcon('Compare against another column instead of a typed in value');
        const empty = rows()[0].querySelector('.filter-editor-value-slot .filter-editor-pick') as HTMLButtonElement;
        expect([empty.textContent?.trim(), empty.getAttribute('aria-label')]).toEqual(['Column', 'Value']);
    });

    it('expect the icon buttons to be named by their tooltip', async () => {
        await openWith({ field: 'firstname', operator: 'EQUAL', value: 'first1' });
        const icons = Array.from(rows()[0].querySelectorAll<HTMLButtonElement>('.filter-editor-icon'));

        expect(
            icons.map((icon) => [icon.tagName, icon.getAttribute('aria-label') === icon.getAttribute('data-tooltip')])
        ).toEqual([
            ['BUTTON', true],
            ['BUTTON', true],
            ['BUTTON', true]
        ]);
        expect(icons.map((icon) => icon.getAttribute('aria-label'))).toEqual([
            'Match case',
            'Compare against another column instead of a typed in value',
            'Delete this condition'
        ]);
        // the icon is decoration, the button has the name
        expect(icons[1].querySelector('svg')?.getAttribute('aria-hidden')).toEqual('true');
    });

    it('expect delete to take the condition out, the focus kept on the delete of the next one', async () => {
        await openWith(
            { field: 'firstname', operator: 'EQUAL', value: 'first1' },
            { field: 'age', operator: 'EQUAL', value: 10 }
        );
        const trash = () =>
            rows()[0].querySelector<HTMLButtonElement>('[aria-label="Delete this condition"]') as HTMLButtonElement;
        trash().focus();

        trash().click();

        expect(rows()).toHaveLength(1);
        expect((rows()[0].querySelector('.filter-editor-pick') as HTMLElement).textContent?.trim()).toEqual('Age');
        // lit keeps the elements of the rows by their place: the next condition's delete has the focus
        expect(document.activeElement).toBe(trash());
    });

    it('expect the focus to go to the dialog when the last condition is deleted: Tab goes on from there', async () => {
        await openWith({ field: 'firstname', operator: 'EQUAL', value: 'first1' });
        const trash = rows()[0].querySelector<HTMLButtonElement>('[aria-label="Delete this condition"]') as HTMLButtonElement;
        trash.focus();

        trash.click();

        expect(rows()).toHaveLength(0);
        // the button with the focus is gone: not left on the body
        expect(document.activeElement).toBe(container());
    });
});

describe('filter editor - groups', () => {
    const groups = () => Array.from(container().querySelectorAll<HTMLElement>('.filter-editor-group'));
    const header = (group: Element) => group.querySelector('.filter-editor-group-header') as HTMLElement;
    const segments = (group: Element) =>
        Array.from(header(group).querySelectorAll<HTMLButtonElement>('.filter-editor-segment-button'));
    const pressed = (group: Element) =>
        segments(group).map((button) => [button.textContent?.trim(), button.getAttribute('aria-pressed')]);

    it('expect AND / OR as two buttons, the one in use pressed', async () => {
        const { datasource, gridInterface } = await mountGrid();
        datasource.filter({ group: 'AND', children: [{ group: 'OR', children: [] }] });
        gridInterface.openFilterEditor();

        expect(pressed(groups()[0])).toEqual([
            ['AND', 'true'],
            ['OR', 'false']
        ]);
        expect(pressed(groups()[1])).toEqual([
            ['AND', 'false'],
            ['OR', 'true']
        ]);
        expect(segments(groups()[0]).map((button) => button.getAttribute('data-tooltip'))).toEqual([
            'All conditions in this group must match',
            'Any condition in this group may match'
        ]);
    });

    it('expect a click on OR to make the group OR, and on the one in use to keep it', async () => {
        const { datasource, gridInterface } = await mountGrid();
        gridInterface.openFilterEditor();

        segments(groups()[0])[1].click();
        expect(pressed(groups()[0])).toEqual([
            ['AND', 'false'],
            ['OR', 'true']
        ]);
        segments(groups()[0])[1].click();
        expect(pressed(groups()[0])[1]).toEqual(['OR', 'true']);

        addCondition();
        // a condition on age that every row passes: what is applied is the OR group
        (container().querySelector('.filter-editor-condition .filter-editor-pick') as HTMLElement).click();
        menuItem('Age').click();
        (container().querySelector('.filter-editor-condition .filter-editor-pick-operator') as HTMLElement).click();
        menuItem('Is Not Blank').click();
        menuItem('Apply').click();
        expect(datasource.getFilter()).toEqual({ group: 'OR', children: [{ field: 'age', operator: 'IS_NOT_BLANK' }] });
    });

    it('expect the header: AND / OR, "+ Condition", "+ Group", then wrap and delete', async () => {
        await openEditor();
        const buttons = Array.from(header(groups()[0]).querySelectorAll<HTMLButtonElement>('button'));

        expect(buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim())).toEqual([
            'AND',
            'OR',
            '+ Condition',
            '+ Group',
            'Wrap everything in this group inside a new parent group',
            'Clear all conditions'
        ]);
        expect(buttons.every((button) => button.type === 'button')).toBe(true);
        expect(buttons.map((button) => button.getAttribute('data-tooltip'))).toContain('Add a sub group inside this group');
    });

    it('expect "+ Group" to add a sub group in the bracket of its group, its delete to remove it', async () => {
        await openEditor();
        clickIcon('Add a sub group inside this group');

        expect(groups()).toHaveLength(2);
        // the sub group is in the body of the root group: indented behind its line
        expect(groups()[1].parentElement?.classList.contains('filter-editor-group-body')).toBe(true);
        expect(groups()[1].parentElement?.closest('.filter-editor-group')).toBe(groups()[0]);
        expect(
            (header(groups()[1]).querySelector('.filter-editor-group-tools button:last-child') as HTMLElement).getAttribute(
                'aria-label'
            )
        ).toEqual('Delete this group and everything in it');

        clickIcon('Delete this group and everything in it');
        expect(groups()).toHaveLength(1);
    });

    it('expect wrap to put what the group has in a new group in it', async () => {
        const { datasource, gridInterface } = await mountGrid();
        datasource.filter({ group: 'OR', children: [{ field: 'age', operator: 'EQUAL', value: 10 }] });
        gridInterface.openFilterEditor();

        clickIcon('Wrap everything in this group inside a new parent group');
        menuItem('Apply').click();

        expect(datasource.getFilter()).toEqual({
            group: 'OR',
            children: [{ group: 'AND', children: [{ field: 'age', operator: 'EQUAL', value: 10 }] }]
        });
    });

    it('expect an empty filter to say so, the hint gone with the first condition', async () => {
        await openEditor();
        const hint = () => container().querySelector('.filter-editor-empty');

        expect(hint()?.textContent?.trim()).toEqual('No conditions: every row is shown');
        addCondition();
        expect(hint()).toBeNull();
    });

    it('expect no hint in an empty sub group, only in the root group', async () => {
        await openEditor();
        clickIcon('Add a sub group inside this group');

        expect(container().querySelectorAll('.filter-editor-empty')).toHaveLength(0);
    });
});

describe('filter editor - the keyboard', () => {
    it('expect every control to be a button or an input, in the order they are shown: the Tab order', async () => {
        const { datasource, gridInterface } = await mountGrid();
        datasource.filter({ group: 'AND', children: [{ field: 'age', operator: 'EQUAL', value: 10 }] });
        gridInterface.openFilterEditor();

        const controls = Array.from(container().querySelectorAll<HTMLElement>('button, input, textarea, [tabindex]'))
            .filter((element) => element !== container())
            .map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim());
        expect(controls).toEqual([
            'Close without filtering',
            'AND',
            'OR',
            '+ Condition',
            '+ Group',
            'Wrap everything in this group inside a new parent group',
            'Clear all conditions',
            'Field: Age',
            'Operator: Equal',
            'Value',
            'Compare against another column instead of a typed in value',
            'Delete this condition',
            'Undo',
            'Redo',
            'Cancel',
            'Apply',
            'Apply & close'
        ]);
        // none taken out of the Tab order
        expect(container().querySelectorAll('button[tabindex="-1"], input[tabindex="-1"]')).toHaveLength(0);
    });

    it('expect the operator picker opened from the keyboard: the focus in its menu, the arrows, Enter picks', async () => {
        const { datasource, gridInterface } = await mountGrid();
        datasource.filter({ group: 'AND', children: [{ field: 'age', operator: 'EQUAL', value: 10 }] });
        gridInterface.openFilterEditor();
        const operator = container().querySelector('.filter-editor-pick-operator') as HTMLButtonElement;
        operator.focus();

        // Enter on a button is a click in the browser
        press(operator, 'Enter');
        operator.click();

        const menu = container().querySelector('.simple-html-grid-menu[role="menu"]') as HTMLElement;
        expect(menu).not.toBeNull();
        // the one in use is checked
        const checked = Array.from(menu.querySelectorAll('[aria-checked="true"]'), (item) => item.textContent?.trim());
        expect(checked).toEqual(['Equal']);
        expect(document.activeElement?.textContent?.trim()).toEqual('Equal');

        // the operators of a number, in their order: Equal, Not Equal To, Less Than ...
        press(document.activeElement as HTMLElement, 'ArrowDown');
        press(document.activeElement as HTMLElement, 'ArrowDown');
        expect(document.activeElement?.textContent?.trim()).toEqual('Less Than');
        press(document.activeElement as HTMLElement, 'Enter');

        expect(container().querySelector('.simple-html-grid-menu')).toBeNull();
        expect(operator.textContent?.trim()).toEqual('Less Than');
        // the menu gives the focus back to its picker, which is kept
        expect(document.activeElement).toBe(operator);
    });

    it('expect the field picker opened from the keyboard: the focus in its search, which hides fields', async () => {
        await openEditor();
        addCondition();
        const field = container().querySelector('.filter-editor-pick-field') as HTMLButtonElement;
        field.focus();

        press(field, 'Enter');
        field.click();

        const search = container().querySelector('.simple-html-grid-menu-search') as HTMLInputElement;
        expect(document.activeElement).toBe(search);
        expect([search.placeholder, search.getAttribute('aria-label')]).toEqual(['Search fields', 'Search fields']);
        const shown = () =>
            Array.from(container().querySelectorAll<HTMLElement>('.simple-html-grid-menu [role^="menuitem"]'))
                .filter((item) => !item.hidden)
                .map((item) => item.textContent?.trim());
        // by their labels, in order
        expect(shown()).toEqual(['Age', 'Firstname', 'Lastname']);

        search.value = 'NAME';
        search.dispatchEvent(new Event('input'));
        expect(shown()).toEqual(['Firstname', 'Lastname']);

        // ArrowDown: the first field shown, the hidden one is passed by
        press(search, 'ArrowDown');
        expect(document.activeElement?.textContent?.trim()).toEqual('Firstname');
        press(document.activeElement as HTMLElement, 'ArrowUp');
        expect(document.activeElement?.textContent?.trim()).toEqual('Lastname');

        // Enter in the search: the first field shown
        search.focus();
        press(search, 'Enter');
        expect(field.textContent?.trim()).toEqual('Firstname');
        expect(container().querySelector('.simple-html-grid-menu')).toBeNull();
    });

    it('expect the field picker opened with the mouse to leave the focus, and to check the field picked', async () => {
        const { datasource, gridInterface } = await mountGrid();
        datasource.filter({ group: 'AND', children: [{ field: 'lastname', operator: 'EQUAL', value: 'x' }] });
        gridInterface.openFilterEditor();
        const field = container().querySelector('.filter-editor-pick-field') as HTMLButtonElement;

        field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        field.click();

        expect(document.activeElement).not.toBe(container().querySelector('.simple-html-grid-menu-search'));
        const checked = Array.from(container().querySelectorAll('.simple-html-grid-menu [aria-checked="true"]'), (item) =>
            item.textContent?.trim()
        );
        expect(checked).toEqual(['Lastname']);
    });
});

describe('filter editor - kept in the window', () => {
    it('expect it to move up when it grows past the bottom of the window', async () => {
        await openEditor();
        container().style.top = '500px';
        // as high as it is after the edit: its bottom 100px under the window
        const height = window.innerHeight - 400;
        vi.spyOn(container(), 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 500, 650, height));

        addCondition();

        expect(container().style.top).toEqual(`${window.innerHeight - height}px`);
    });

    it('expect it to stay where it is while it fits', async () => {
        await openEditor();
        container().style.top = '44px';
        vi.spyOn(container(), 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 44, 650, 300));

        addCondition();

        expect(container().style.top).toEqual('44px');
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

/**
 * What the editor shows, as text, to compare before and after an edit: each group its AND / OR in use
 * and what is in it - the conditions first, then the sub groups, as shown - each condition its field,
 * its operator and its value: "the text" of an input, [the column] of a column picker, - for none
 */
function shown(group: Element = container().querySelector('.filter-editor-group') as Element): string {
    const [header, body] = Array.from(group.children);
    const pressed = header.querySelector('[aria-pressed="true"]')?.textContent?.trim();
    const parts = Array.from(body.children)
        .filter((child) => !child.classList.contains('filter-editor-empty'))
        .map((child) => {
            if (child.classList.contains('filter-editor-group')) {
                return shown(child);
            }
            const [field, operator] = Array.from(child.querySelectorAll('.filter-editor-pick'), (pick) =>
                pick.textContent?.trim()
            );
            const value = child.querySelector('.filter-editor-value-slot > *');
            if (value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement) {
                return `${field} ${operator} "${value.value}"`;
            }
            return `${field} ${operator} ${value ? `[${value.textContent?.trim()}]` : '-'}`;
        });
    return `${pressed}(${parts.join(', ')})`;
}

/** an undo / redo key as the browser sends it: Ctrl and Z by default, on the element with the focus */
function key(init: KeyboardEventInit = {}, target: Element = document.activeElement as Element) {
    const event = new KeyboardEvent('keydown', {
        key: 'z',
        code: 'KeyZ',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        ...init
    });
    target.dispatchEvent(event);
    return event;
}
const undoKey = (target?: Element) => key({}, target);
const redoKey = (target?: Element) => key({ key: 'y', code: 'KeyY' }, target);

const undoButton = () => container().querySelector('.filter-editor-undo') as HTMLButtonElement;
const redoButton = () => container().querySelector('.filter-editor-redo') as HTMLButtonElement;
/** aria-disabled of Undo and Redo: 'true' when greyed out, null when not */
const greyedOut = () => [undoButton().getAttribute('aria-disabled'), redoButton().getAttribute('aria-disabled')];
/** the value inputs, in the order they are shown */
const valueInputs = () => Array.from(container().querySelectorAll<HTMLInputElement>('.filter-editor-value'));

/**
 * types `text` at the end of a value input as the browser does: the focus in it, an input event per
 * key. happy-dom sends no change event, a browser sends it when the focus leaves the input
 */
function type(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
    input.focus();
    for (const char of text) {
        input.value += char;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/** the browser's own undo (or redo) of the typing in an input: its text, an input event */
function browserUndo(input: HTMLInputElement, text: string) {
    input.value = text;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'historyUndo' }));
}

/** a condition on firstname and an OR group with one on age */
const NESTED = {
    group: 'AND',
    children: [
        { field: 'firstname', operator: 'EQUAL', value: 'a' },
        { group: 'OR', children: [{ field: 'age', operator: 'GREATER_THAN', value: 10 }] }
    ]
};

/** what NESTED is shown as */
const NESTED_SHOWN = 'AND(Firstname Equal "a", OR(Age Greater Than "10"))';

/** the editor with this filter */
async function openWith(filter: object = NESTED) {
    const mounted = await mountGrid();
    mounted.datasource.filter(structuredClone(filter) as any);
    mounted.gridInterface.openFilterEditor();
    return mounted;
}

describe('filter editor - undo and redo, the buttons', () => {
    it('expect Undo and Redo at the start of the footer: icons, named, the tooltips with the keys', async () => {
        await openEditor();
        const [undo, redo] = Array.from(container().querySelectorAll<HTMLButtonElement>('.filter-editor-footer button'));

        expect([undo, redo]).toEqual([undoButton(), redoButton()]);
        expect([undo.type, undo.getAttribute('aria-label'), undo.getAttribute('data-tooltip')]).toEqual([
            'button',
            'Undo',
            'Undo (Ctrl+Z)'
        ]);
        expect([redo.type, redo.getAttribute('aria-label'), redo.getAttribute('data-tooltip')]).toEqual([
            'button',
            'Redo',
            'Redo (Ctrl+Y)'
        ]);
        // the keys for a screen reader, the ones undoRedoAction takes
        expect(undo.getAttribute('aria-keyshortcuts')).toEqual('Control+Z Meta+Z');
        expect(redo.getAttribute('aria-keyshortcuts')).toEqual('Control+Y Control+Shift+Z Meta+Y Meta+Shift+Z');
        // the icon is decoration, the button has the name
        expect(undo.querySelector('svg')?.getAttribute('aria-hidden')).toEqual('true');
        // in a box of their own, before Cancel
        expect(undo.parentElement?.className).toEqual('filter-editor-undo-redo');
        expect(undo.parentElement?.nextElementSibling?.textContent?.trim()).toEqual('Cancel');
    });

    it('expect them greyed out with aria-disabled while there is nothing to undo or redo - not disabled', async () => {
        await openEditor();
        expect(greyedOut()).toEqual(['true', 'true']);
        // they keep the focus: a disabled button would lose it
        expect([undoButton().disabled, redoButton().disabled]).toEqual([false, false]);

        addCondition();
        expect(greyedOut()).toEqual([null, 'true']);

        undoButton().click();
        expect(greyedOut()).toEqual(['true', null]);

        redoButton().click();
        expect(greyedOut()).toEqual([null, 'true']);
    });

    it('expect a click on a greyed out one to do nothing', async () => {
        await openWith();

        undoButton().click();
        redoButton().click();

        expect(shown()).toEqual(NESTED_SHOWN);
        expect(greyedOut()).toEqual(['true', 'true']);
    });

    it('expect a click on Undo to keep the focus on it, also when nothing is left to undo', async () => {
        await openEditor();
        addCondition();
        addCondition();
        undoButton().focus();

        undoButton().click();
        expect(document.activeElement).toBe(undoButton());
        undoButton().click();

        expect(container().querySelectorAll('.filter-editor-condition')).toHaveLength(0);
        expect(document.activeElement).toBe(undoButton());
        expect(greyedOut()).toEqual(['true', null]);
    });

    it('expect the tooltips to say ⌘Z and ⇧⌘Z on a Mac, the `.mac` texts - translated by the texts of the grid', async () => {
        // the platform the browser says it runs on, see isMacPlatform. Restored after each test
        vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
        const tooltips = () => [undoButton().getAttribute('data-tooltip'), redoButton().getAttribute('data-tooltip')];
        await openEditor();
        expect(tooltips()).toEqual(['Undo (⌘Z)', 'Redo (⇧⌘Z)']);
        menuItem('Cancel').click();

        const config = simpleConfig();
        config.texts = { 'filterEditor.undo.tooltip.mac': 'Angre (⌘Z)', 'filterEditor.redo.tooltip.mac': 'Gjør om (⇧⌘Z)' };
        await openEditor(config);

        expect(tooltips()).toEqual(['Angre (⌘Z)', 'Gjør om (⇧⌘Z)']);
        // the name is the same on every platform
        expect(undoButton().getAttribute('aria-label')).toEqual('Undo');
    });
});

describe('filter editor - undo and redo, a step', () => {
    /** [what, the edit]: each is one step */
    const edits: [string, () => void][] = [
        ['a condition added', () => addCondition()],
        ['a sub group added', () => clickIcon('Add a sub group inside this group')],
        ['a condition deleted', () => clickIcon('Delete this condition')],
        ['a sub group deleted', () => clickIcon('Delete this group and everything in it')],
        ['the group wrapped', () => clickIcon('Wrap everything in this group inside a new parent group')],
        ['AND / OR', () => container().querySelectorAll<HTMLElement>('.filter-editor-segment-button')[1].click()],
        [
            'a field picked',
            () => {
                (container().querySelector('.filter-editor-pick-field') as HTMLElement).click();
                menuItem('Lastname').click();
            }
        ],
        [
            'an operator picked',
            () => {
                (container().querySelector('.filter-editor-pick-operator') as HTMLElement).click();
                menuItem('Contains').click();
            }
        ],
        ['value / column switched', () => clickIcon('Compare against another column instead of a typed in value')],
        ['clear all', () => clickIcon('Clear all conditions')]
    ];

    it.each(edits)('expect %s to be undone and redone, with the buttons', async (_, edit) => {
        await openWith();
        edit();
        const after = shown();
        expect(after).not.toEqual(NESTED_SHOWN);

        undoButton().click();
        expect(shown()).toEqual(NESTED_SHOWN);
        expect(greyedOut()).toEqual(['true', null]);

        redoButton().click();
        expect(shown()).toEqual(after);
        expect(greyedOut()).toEqual([null, 'true']);
    });

    it.each(edits)('expect %s to be undone and redone, with Ctrl+Z and Ctrl+Y', async (_, edit) => {
        await openWith();
        edit();
        const after = shown();

        expect(undoKey(container()).defaultPrevented).toBe(true);
        expect(shown()).toEqual(NESTED_SHOWN);

        expect(redoKey(container()).defaultPrevented).toBe(true);
        expect(shown()).toEqual(after);
    });

    it('expect a column picked to be a step', async () => {
        await openWith({ group: 'AND', children: [{ field: 'firstname', operator: 'EQUAL', valueField: '' }] });
        expect(shown()).toEqual('AND(Firstname Equal [Column])');

        (container().querySelector('.filter-editor-pick-column') as HTMLElement).click();
        menuItem('Lastname').click();
        expect(shown()).toEqual('AND(Firstname Equal [Lastname])');

        undoButton().click();
        expect(shown()).toEqual('AND(Firstname Equal [Column])');
        redoButton().click();
        expect(shown()).toEqual('AND(Firstname Equal [Lastname])');
    });

    it('expect steps to be undone last first, and redone in the order they were made', async () => {
        await openEditor();
        const states = [shown()];
        addCondition();
        states.push(shown());
        (container().querySelector('.filter-editor-pick-field') as HTMLElement).click();
        menuItem('Age').click();
        states.push(shown());
        clickIcon('Add a sub group inside this group');
        states.push(shown());
        expect(states).toEqual(['AND()', 'AND(Field Operator "")', 'AND(Age Operator "")', 'AND(Age Operator "", AND())']);

        for (const state of states.slice(0, -1).reverse()) {
            undoButton().click();
            expect(shown()).toEqual(state);
        }
        for (const state of states.slice(1)) {
            redoButton().click();
            expect(shown()).toEqual(state);
        }
    });

    it('expect an edit that changes nothing to be no step: the AND in use, the field that is picked', async () => {
        await openWith();

        (container().querySelector('.filter-editor-segment-button') as HTMLElement).click();
        (container().querySelector('.filter-editor-pick-field') as HTMLElement).click();
        menuItem('Firstname').click();

        expect(greyedOut()).toEqual(['true', 'true']);
    });

    it('expect a new edit to empty redo', async () => {
        await openWith();
        addCondition();
        undoButton().click();
        expect(greyedOut()).toEqual(['true', null]);

        clickIcon('Add a sub group inside this group');

        expect(greyedOut()).toEqual([null, 'true']);
        const after = shown();
        expect(redoKey(container()).defaultPrevented).toBe(true);
        expect(shown()).toEqual(after);
    });

    it(`expect the history to keep the last ${MAX_FILTER_EDITOR_STEPS} steps`, async () => {
        await openEditor();
        const segment = (index: number) => container().querySelectorAll<HTMLElement>('.filter-editor-segment-button')[index];
        // OR, AND, OR ...: a step each, one more than it keeps
        for (let i = 0; i <= MAX_FILTER_EDITOR_STEPS; i++) {
            segment(i % 2 === 0 ? 1 : 0).click();
        }
        expect(shown()).toEqual('OR()');

        for (let i = 0; i < MAX_FILTER_EDITOR_STEPS; i++) {
            undoButton().click();
        }

        // the first step is gone: the group is OR, as after it
        expect(greyedOut()).toEqual(['true', null]);
        expect(shown()).toEqual('OR()');
    });
});

describe('filter editor - undo and redo, a typed value', () => {
    it('expect what is typed in a value input to be one step, until the focus leaves it', async () => {
        await openWith();
        const input = valueInputs()[0];

        type(input, 'bcd');
        // the editor is not rendered again while typing: Undo is updated by hand
        expect(greyedOut()).toEqual([null, 'true']);
        container().focus();

        undoButton().click();
        expect(valueInputs()[0].value).toEqual('a');
        expect(greyedOut()).toEqual(['true', null]);

        redoButton().click();
        expect(valueInputs()[0].value).toEqual('abcd');
    });

    it('expect typing again after the focus left the input to be a step of its own', async () => {
        await openWith();
        const input = valueInputs()[0];
        type(input, 'b');
        container().focus();
        type(input, 'c');
        container().focus();

        undoButton().click();
        expect(valueInputs()[0].value).toEqual('ab');
        undoButton().click();
        expect(valueInputs()[0].value).toEqual('a');
    });

    it('expect the change event (Enter) to end the step: what is typed after it is a step of its own', async () => {
        await openWith();
        const input = valueInputs()[0];
        type(input, 'b');
        input.dispatchEvent(new Event('change', { bubbles: true }));
        type(input, 'c');

        undoButton().click();
        expect(valueInputs()[0].value).toEqual('ab');
        undoButton().click();
        expect(valueInputs()[0].value).toEqual('a');
    });

    it('expect an edit while the focus is still in the input (Safari: a click does not move it) to end the step', async () => {
        await openWith();
        const input = valueInputs()[0];
        type(input, 'b');
        addCondition();
        type(input, 'c');

        undoButton().click();
        expect(shown()).toEqual('AND(Firstname Equal "ab", Field Operator "", OR(Age Greater Than "10"))');
        undoButton().click();
        undoButton().click();
        expect(shown()).toEqual(NESTED_SHOWN);
    });

    it('expect typed back to where it started to be no step', async () => {
        await openWith();
        const input = valueInputs()[0];
        type(input, 'b');
        expect(greyedOut()).toEqual([null, 'true']);

        input.value = 'a';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(greyedOut()).toEqual(['true', 'true']);
    });

    it('expect the text of IN, a value per line, to be one step too', async () => {
        await openWith({ group: 'AND', children: [{ field: 'firstname', operator: 'IN', value: ['first1'] }] });
        const textarea = container().querySelector('textarea') as HTMLTextAreaElement;

        type(textarea, '\nfirst2');
        container().focus();
        undoButton().click();

        expect(shown()).toEqual('AND(Firstname In "first1")');
        redoButton().click();
        expect(shown()).toEqual('AND(Firstname In "first1\nfirst2")');
    });
});

describe('filter editor - undo and redo, the keys', () => {
    it.each([
        ['Ctrl+Z', 'undo', { key: 'z' }],
        ['Cmd+Z', 'undo', { key: 'z', ctrlKey: false, metaKey: true }],
        ['Ctrl+Z on a layout without latin letters (by where the key is)', 'undo', { key: 'я' }],
        ['Ctrl+Y', 'redo', { key: 'y', code: 'KeyY' }],
        ['Ctrl+Shift+Z', 'redo', { key: 'Z', shiftKey: true }],
        ['Cmd+Shift+Z', 'redo', { key: 'Z', shiftKey: true, ctrlKey: false, metaKey: true }],
        ['Cmd+Y', 'redo', { key: 'y', code: 'KeyY', ctrlKey: false, metaKey: true }]
    ])('expect %s to %s', async (_, action, init) => {
        await openEditor();
        addCondition();
        const added = shown();
        if (action === 'redo') {
            undoButton().click();
        }

        expect(key(init, container()).defaultPrevented).toBe(true);

        expect(shown()).toEqual(action === 'undo' ? 'AND()' : added);
    });

    it('expect Ctrl+Alt+Z (AltGr on Windows types characters) and Z alone to be left alone', async () => {
        await openEditor();
        addCondition();

        expect(key({ altKey: true }, container()).defaultPrevented).toBe(false);
        expect(key({ ctrlKey: false }, container()).defaultPrevented).toBe(false);

        expect(shown()).toEqual('AND(Field Operator "")');
    });

    it("expect the keys to be canceled also when there is nothing to undo: the browser's own undo is the page's", async () => {
        await openWith();
        (container().querySelector('.filter-editor-add') as HTMLElement).focus();

        expect(undoKey().defaultPrevented).toBe(true);
        expect(redoKey().defaultPrevented).toBe(true);
        expect(undoKey(container()).defaultPrevented).toBe(true);
    });

    it("expect Ctrl+Z in a value input typed in to be the input's own, the editor's once it is undone back", async () => {
        await openWith();
        addCondition();
        const input = valueInputs()[0];
        type(input, 'b');

        // the browser undoes the typing in the input, the editor leaves it
        expect(undoKey(input).defaultPrevented).toBe(false);
        expect(shown()).toEqual('AND(Firstname Equal "ab", Field Operator "", OR(Age Greater Than "10"))');
        browserUndo(input, 'a');

        // back where it started: the editor's, it takes the condition added back
        expect(undoKey(input).defaultPrevented).toBe(true);
        expect(shown()).toEqual(NESTED_SHOWN);
    });

    it("expect Ctrl+Y in a value input typed in to be the input's own: the browser redoes the typing it undid", async () => {
        await openWith();
        const input = valueInputs()[0];
        type(input, 'b');
        expect(redoKey(input).defaultPrevented).toBe(false);

        browserUndo(input, 'a');
        expect(greyedOut()).toEqual(['true', 'true']);
        expect(redoKey(input).defaultPrevented).toBe(false);

        // the browser's redo: the typing is a step again
        browserUndo(input, 'ab');
        expect(greyedOut()).toEqual([null, 'true']);
    });

    it("expect Ctrl+Z in a value input that was not typed in since it got the focus to be the editor's", async () => {
        await openWith();
        type(valueInputs()[0], 'b');
        container().focus();
        valueInputs()[0].focus();

        expect(undoKey(valueInputs()[0]).defaultPrevented).toBe(true);

        expect(valueInputs()[0].value).toEqual('a');
    });

    it('expect undo to close a menu open in the editor', async () => {
        await openWith();
        addCondition();
        (container().querySelector('.filter-editor-pick-operator') as HTMLElement).click();
        const menu = document.querySelector('.simple-html-grid-menu') as HTMLElement;

        expect(undoKey(menu.querySelector('[role^="menuitem"]') as HTMLElement).defaultPrevented).toBe(true);

        expect(menu.isConnected).toBe(false);
        expect(shown()).toEqual(NESTED_SHOWN);
    });

    it("expect Ctrl+Z in the field menu's search box to be its own while it has text", async () => {
        await openWith();
        addCondition();
        (container().querySelector('.filter-editor-pick-field') as HTMLElement).click();
        const search = container().querySelector('.simple-html-grid-menu-search') as HTMLInputElement;
        search.value = 'age';

        expect(undoKey(search).defaultPrevented).toBe(false);
        expect(search.isConnected).toBe(true);

        // empty: the editor's
        search.value = '';
        expect(undoKey(search).defaultPrevented).toBe(true);
        expect(search.isConnected).toBe(false);
        expect(shown()).toEqual(NESTED_SHOWN);
    });

    it("expect the keys in the editor never to reach the grid's undo", async () => {
        const { datasource, gridInterface } = await mountGrid({ ...simpleConfig(), readonly: false });
        // a step of the grid's history: an edit of a row
        datasource.getAllData()[0].firstname = 'changed';
        expect(datasource.canUndo()).toBe(true);
        const undo = vi.spyOn(datasource, 'undo');
        const redo = vi.spyOn(datasource, 'redo');
        datasource.filter({ group: 'AND', children: [{ field: 'firstname', operator: 'EQUAL', value: 'a' }] });
        gridInterface.openFilterEditor();

        // nothing to undo in the editor; in a value input typed in, and not typed in; something to undo
        undoKey(container());
        redoKey(container());
        type(valueInputs()[0], 'b');
        undoKey(valueInputs()[0]);
        container().focus();
        undoKey(valueInputs()[0]);
        undoKey(container());

        expect(undo).not.toHaveBeenCalled();
        expect(redo).not.toHaveBeenCalled();
        expect(datasource.getAllData()[0].firstname).toEqual('changed');
        expect(datasource.canUndo()).toBe(true);
    });
});

describe('filter editor - undo and redo, the focus', () => {
    it('expect Ctrl+Z to put the focus on the control the edit was made with, as Ctrl+Y does', async () => {
        await openWith();
        const operator = () => container().querySelectorAll<HTMLElement>('.filter-editor-pick-operator')[1];
        operator().click();
        menuItem('Less Than').click();
        container().focus();

        undoKey(container());
        expect(document.activeElement).toBe(operator());
        expect(operator().textContent?.trim()).toEqual('Greater Than');

        container().focus();
        redoKey(container());
        expect(document.activeElement).toBe(operator());
        expect(operator().textContent?.trim()).toEqual('Less Than');
    });

    it('expect a condition deleted and undone to get the focus on its delete again', async () => {
        await openWith();
        const trash = () => container().querySelectorAll<HTMLElement>('[aria-label="Delete this condition"]')[0];
        trash().focus();
        trash().click();
        expect(shown()).toEqual('AND(OR(Age Greater Than "10"))');

        undoKey();

        expect(shown()).toEqual(NESTED_SHOWN);
        expect(document.activeElement).toBe(trash());
    });

    it('expect the focus on the dialog when the control is not there any more: the last condition deleted again', async () => {
        await openWith({ group: 'AND', children: [{ field: 'firstname', operator: 'EQUAL', value: 'a' }] });
        clickIcon('Delete this condition');
        undoKey(container());

        redoKey(container());

        expect(container().querySelectorAll('.filter-editor-condition')).toHaveLength(0);
        // not on the body: Tab goes on from the start of the dialog
        expect(document.activeElement).toBe(container());
    });

    it('expect a typed value undone from the keyboard to get the focus in its input', async () => {
        await openWith();
        type(valueInputs()[1], '0');
        container().focus();

        undoKey(container());

        expect(document.activeElement).toBe(valueInputs()[1]);
        expect(valueInputs()[1].value).toEqual('10');
    });
});

describe('filter editor - undo and redo, a new history each time it opens', () => {
    it('expect the editor opened again to start with nothing to undo', async () => {
        const { gridInterface } = await openEditor();
        addCondition();
        menuItem('Cancel').click();

        gridInterface.openFilterEditor();

        expect(greyedOut()).toEqual(['true', 'true']);
        expect(undoKey(container()).defaultPrevented).toBe(true);
        expect(shown()).toEqual('AND()');
    });

    it('expect openFilterEditor() while it is open to start a new history too', async () => {
        const { gridInterface } = await openEditor();
        addCondition();

        gridInterface.openFilterEditor();

        expect(greyedOut()).toEqual(['true', 'true']);
        undoKey(container());
        expect(shown()).toEqual('AND()');
    });
});
