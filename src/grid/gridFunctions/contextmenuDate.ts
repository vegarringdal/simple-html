import type { FieldType } from '../../datasource/field';
import { type Formatter, parseFilterText } from '../../datasource/formatter';
import type { DateElement } from '../../date/dateElement';
import { DateInterface } from '../../date/dateInterface';
import type { IDateConfig } from '../../date/interfaces';
import type { Grid } from '../grid';
import { createElement } from './createElement';
import type { HTMLCellElement } from './HTMLCellElement';
import { removeContextMenu } from './removeContextMenu';
import { type MenuPlace, moveMenu, openMenuElement, placeMenu } from './showMenu';

/**
 * From and To of a range picker: a day each, null for an end not picked (an open end)
 */
export type DateRange = [Date | null, Date | null];

/** the height of a row of days by default: 22px, 28px on a touch screen - room for a finger */
const ROW_HEIGHT = 22;
const TOUCH_ROW_HEIGHT = 28;
/** the rows of a month that are rowHeight high: the names of the days and six weeks */
const ROWS_OF_A_MONTH = 7;
/** the date picker's height with rows of 22px (277) and a gap of 5 */
const PICKER_HEIGHT = 282;

/** a touch screen: the primary pointer is a finger, as the grid's css `@media (pointer: coarse)` */
function isTouchScreen() {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/**
 * the height of the date picker, to open it above the cell when it does not fit below: `datepickerHeight`
 * when given, else worked out from the height of its rows
 */
export function datePickerHeight(config: Partial<IDateConfig>, rowHeight: number) {
    return config.datepickerHeight || PICKER_HEIGHT + ROWS_OF_A_MONTH * (rowHeight - ROW_HEIGHT);
}

/**
 * A date picker of the grid, not shown yet: a `.simple-html-grid` div with the `<simple-html-date>` in
 * it. Its config is the grid's `datePickerConfig` - only the fields given, every field read here has a
 * default - and its texts, as a date picker; `picker` sets the rest: the date it opens on, or the range
 * of a range picker
 */
function createDatePicker(ctx: Grid, picker: Partial<IDateConfig>) {
    const container = createElement('div', 'simple-html-grid');

    // only the fields given, every field read below has a default
    const config = ctx.gridInterface.__getGridConfig().datePickerConfig ?? {};

    const dateconfig: IDateConfig = {
        monthsToShow: 1, // set automatically when datepicker is true
        monthColumns: 1, // set automatically when datepicker is true
        startMonth: 0, // set automatically when datepicker is true
        startYear: 2023, // set automatically when datepicker is true
        showWeek: config.showWeek !== undefined ? config.showWeek : true,
        isoWeek: config.isoWeek !== undefined ? config.isoWeek : true,
        // the grid's texts: the names of the months and days, the buttons
        texts: ctx.gridInterface.__getGridConfig().texts,
        // ?? and not ||, 0 (sunday) is a valid week start
        weekStart: config.weekStart ?? 1,
        // the app's, else taller on a touch screen
        rowHeight: config.rowHeight || (isTouchScreen() ? TOUCH_ROW_HEIGHT : ROW_HEIGHT),
        monthWidth: config.monthWidth || 230,
        monthMargin: config.monthMargin ?? 10,
        hideDimmedDates: config.hideDimmedDates !== undefined ? config.hideDimmedDates : false,
        showYearInMonth: config.showYearInMonth !== undefined ? config.showYearInMonth : false,
        headerTitle: '', // not shown datepicker is true
        datepicker: true,
        ...picker
    };

    const dateInterface = new DateInterface(dateconfig);
    const dateElement = createElement('simple-html-date', 'simple-html-date') as DateElement;
    container.appendChild(dateElement);
    dateElement.connectInterface(dateInterface);
    dateInterface.render();

    return { container, dateInterface, dateconfig, datePickerConfig: config };
}

/**
 * a copy of `value` when it is a valid Date - the picker edits the date it is given in place (seconds,
 * hours, minutes), and that can be the date object of a cell - else null: the picker opens on today
 */
function validDate(value: unknown): Date | null {
    return value instanceof Date && !Number.isNaN(value.getTime()) ? new Date(value.getTime()) : null;
}

/**
 * opens the date picker under a cell, as the grid's menu (one at a time, closed as the others)
 * @param value the date to open on, anything that is not a valid Date opens on today
 */
export function contextmenuDate(
    ctx: Grid,
    _event: MouseEvent,
    cell: HTMLCellElement,
    value: unknown,
    callback: (value: Date | null) => void
) {
    const {
        container: contextMenu,
        dateInterface,
        dateconfig,
        datePickerConfig: config
    } = createDatePicker(ctx, { datepickerDate: validDate(value) });

    // no need to unsubscribe: removing the menu removes the date element, and that unsubscribes
    dateInterface.on('date-select', (date) => {
        callback(date);
    });

    // in the filter editor's dialog when opened from it: a menu outside a modal dialog can not be
    // clicked, see popoverParent
    openMenuElement(ctx, contextMenu, cell);

    // under the cell; above it when the picker (datepickerHeight) does not fit below, moved left when
    // it sticks out on the right
    const rect = cell.getBoundingClientRect();
    let left = rect.left + 2;
    let top = rect.bottom + 2;
    const width = dateconfig.monthWidth + dateconfig.monthMargin + dateconfig.monthMargin + 10;
    if (rect.left + width > window.innerWidth) {
        left = window.innerWidth - width;
    }
    const height = datePickerHeight(config, dateconfig.rowHeight);
    if (rect.bottom + height > window.innerHeight) {
        top = rect.top - height;
    }
    moveMenu(contextMenu, left, top);
}

/**
 * Opens the range picker (IDateConfig.rangepicker) under a cell, as the grid's menu: the date header
 * filter with the BETWEEN operator. Two months side by side - one in a narrow window - kept in the window
 * (placeMenu: above the cell when there is no room below). Use calls `callback` with From and To, Clear
 * with null, and the menu closes
 * @param range the From and To to open on, an end that is not a valid Date is not picked
 */
export function contextmenuDateRange(
    ctx: Grid,
    cell: HTMLElement,
    range: [unknown, unknown],
    callback: (range: DateRange | null) => void
) {
    const { container, dateInterface } = createDatePicker(ctx, {
        rangepicker: true,
        datepickerRange: [validDate(range[0]), validDate(range[1])]
    });

    // no need to unsubscribe: removing the menu removes the date element, and that unsubscribes
    dateInterface.on('range-select', (picked) => {
        callback(picked);
        removeContextMenu(ctx);
    });

    openMenuElement(ctx, container, cell);
    const rect = cell.getBoundingClientRect();
    placeMenu(container, { left: rect.left + 2, top: rect.bottom + 2, flipTop: rect.top - 2, pointX: rect.left, anchor: cell });
}

/**
 * Opens a date picker of the grid from an element of the open menu - an input of the filter menu's range
 * block - without closing the menu. The picker is a popover of its own put in the menu's popover, as a
 * submenu is (openSubmenu in showMenu.ts): a click in it is a click in the menu, and it closes with the
 * menu. It goes under `anchor` - above it when there is no room below - kept in the window (placeMenu).
 *
 * - The focus stays where it is, in the input: a press in the picker does not take it (but in its hour
 *   and minute inputs). Enter in the input still applies the block
 * - Esc closes the picker only, and so does a press in the menu outside it and outside `anchor`: another
 *   operator, Cancel, Apply. A press in `anchor` leaves it open
 * - its clicks do not reach the page, where a click outside the menu closes the menu (addMenuListeners)
 *
 * @param onClose called when it closes: picked from, Esc, a press outside it, or the function returned
 * @returns a function that closes it. Nothing opens without a menu open: the function does nothing then
 */
function openInMenu(ctx: Grid, anchor: HTMLElement, container: HTMLElement, onClose: () => void): () => void {
    const menu = ctx.contextMenu;
    if (!menu) {
        return () => {};
    }

    const abort = new AbortController();
    const signal = abort.signal;
    const close = () => {
        if (signal.aborted) {
            return;
        }
        abort.abort();
        container.remove();
        onClose();
    };

    container.classList.add('simple-html-grid-popover');
    container.popover = 'manual';
    menu.appendChild(container);
    container.showPopover();

    const rect = anchor.getBoundingClientRect();
    const place: MenuPlace = { left: rect.left, top: rect.bottom + 2, flipTop: rect.top - 2, pointX: rect.right, anchor: null };
    placeMenu(container, place);

    container.addEventListener('click', (event) => event.stopPropagation());
    container.addEventListener('mousedown', (event) => {
        if (!(event.target instanceof HTMLInputElement)) {
            event.preventDefault();
        }
    });
    // on the menu: a key in the input, in the picker (it is in the menu's popover) and on an item. Not an
    // Esc used already - one that closed a submenu
    menu.addEventListener(
        'keydown',
        (event) => {
            if (event.key === 'Escape' && !event.defaultPrevented) {
                // canceled: the menu's Esc leaves it (addMenuListeners)
                event.preventDefault();
                close();
            }
        },
        { signal }
    );
    menu.addEventListener(
        'pointerdown',
        (event) => {
            const target = event.target instanceof Node ? event.target : null;
            if (!target || (!container.contains(target) && !anchor.contains(target))) {
                close();
            }
        },
        { signal }
    );

    return close;
}

/**
 * Opens the date picker from an element of the open menu, see {@link openInMenu}: Use calls `onPick`
 * with the date picked (Clear with null), then it closes
 * @param value the date to open on, null opens on today
 */
export function openDateInMenu(
    ctx: Grid,
    anchor: HTMLElement,
    value: Date | null,
    onPick: (date: Date | null) => void,
    onClose: () => void
): () => void {
    const { container, dateInterface } = createDatePicker(ctx, { datepickerDate: validDate(value) });
    const close = openInMenu(ctx, anchor, container, onClose);
    dateInterface.on('date-select', (date) => {
        onPick(date);
        close();
    });
    return close;
}

/**
 * Opens the range picker (IDateConfig.rangepicker) from an element of the open menu, see
 * {@link openInMenu}: Use calls `onPick` with From and To (Clear with null), then it closes
 * @param range the From and To to open on, null for an end not picked
 */
export function openDateRangeInMenu(
    ctx: Grid,
    anchor: HTMLElement,
    range: DateRange,
    onPick: (range: DateRange | null) => void,
    onClose: () => void
): () => void {
    const { container, dateInterface } = createDatePicker(ctx, { rangepicker: true, datepickerRange: range });
    const close = openInMenu(ctx, anchor, container, onClose);
    dateInterface.on('range-select', (picked) => {
        onPick(picked);
        close();
    });
    return close;
}

/**
 * The text of a date filter input as a date for a picker to open on: parsed with the field's formatter
 * (parseFilter); null when it holds no valid date
 */
export function filterDate(formatter: Formatter, text: string): Date | null {
    return validDate(parseFilterText(formatter, text));
}

/**
 * From and To of a range picked, as the inputs of a filter show them: each formatted with the field's
 * formatter, '' for an end not picked - an open end. The range is whole days: the picker gives days at
 * 00:00, a `datetime`'s To is the end of its day, 23:59:59 - a datetime filter compares to the second
 * (the built-in formatters show the seconds). null (Clear) is two empty ends
 */
export function rangeEndTexts(formatter: Formatter, type: FieldType, range: DateRange | null): [string, string] {
    const [from, to] = range ?? [null, null];
    const end = to && type === 'datetime' ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59) : to;
    return [from ? formatter.format(from) : '', end ? formatter.format(end) : ''];
}

/**
 * A range picked as the text of a BETWEEN header filter: `from..to` (see rangeEndTexts), an open end
 * empty - `2026-11-22..`. '' when neither end is picked, or for Clear: no filter
 */
export function rangeFilterText(formatter: Formatter, type: FieldType, range: DateRange | null): string {
    const [from, to] = rangeEndTexts(formatter, type, range);
    return from || to ? `${from}..${to}` : '';
}
