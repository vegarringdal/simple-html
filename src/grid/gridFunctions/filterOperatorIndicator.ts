import { html, nothing, type TemplateResult } from 'lit-html';
import type { FilterOperator } from '../../datasource/filterExpression';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuContext, MenuEntry } from '../gridMenus';
import { sectionColumns } from './cellRowKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { headerFilterType, headerOperators } from './columnFilterOptions';
import { matchCaseItem } from './contextmenuFilter';
import { filterOnTypeItem } from './filterOnType';
import { getHeaderFilterOperator, isHeaderFilterCaseSensitive } from './getHeaderFilterOperator';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { HEADER_OPERATOR_TEXTS, headerOperatorItems } from './headerOperatorMenu';
import { isFingerClick } from './lastPress';
import { placeAt, showMenu } from './showMenu';

/**
 * The operator indicator of a header filter (`GridConfig.filterOperatorIndicator`): the symbol of the
 * operator the header filter uses (getHeaderFilterOperator) in its cell, beside the input - on the
 * right of a text filter (a lookup column's too: a value is on the left), on the left of a number or
 * date filter. The input's padding keeps the text typed clear of it (grid.css). Not on a boolean
 * column, its header filter is a checkbox.
 *
 * A click or a tap on it opens the operator choice under it: the items of the filter menu's
 * Filter › Operator ›, the operator in use checked, and picking one does what Operator › does
 * (headerOperatorMenu.ts) - then, under a line, the toggles "Filter as you type" (filterOnType.ts) and,
 * on a text column, "Match case" (matchCaseItem). A header filter that matches case - the column's
 * `filterCaseSensitive`, or Match case on - shows **Aa** before the symbol (`filter.indicator.case`), and
 * its name says so (`filter.indicator.matchCase`): it is seen before anything is typed. F4
 * in the header filter opens it too. A column that offers one operator only shows it, but it can not be
 * clicked: there is nothing to choose.
 */

/**
 * The symbol of each operator the header filter's input takes (HEADER_OPERATOR_TEXTS): the id of its
 * text, `filter.indicator.<FilterOperator>`
 */
const SYMBOL_TEXTS: Partial<Record<FilterOperator, TextId>> = {
    EQUAL: 'filter.indicator.EQUAL',
    NOT_EQUAL_TO: 'filter.indicator.NOT_EQUAL_TO',
    LESS_THAN: 'filter.indicator.LESS_THAN',
    LESS_THAN_OR_EQUAL_TO: 'filter.indicator.LESS_THAN_OR_EQUAL_TO',
    GREATER_THAN: 'filter.indicator.GREATER_THAN',
    GREATER_THAN_OR_EQUAL_TO: 'filter.indicator.GREATER_THAN_OR_EQUAL_TO',
    BETWEEN: 'filter.indicator.BETWEEN',
    CONTAINS: 'filter.indicator.CONTAINS',
    DOES_NOT_CONTAIN: 'filter.indicator.DOES_NOT_CONTAIN',
    BEGIN_WITH: 'filter.indicator.BEGIN_WITH',
    END_WITH: 'filter.indicator.END_WITH'
};

/**
 * px: a column narrower than this shows no indicator, its input keeps the room for the text typed. The
 * indicator takes about 24px; a column is at least 25px wide (a resize stops there)
 */
export const INDICATOR_MIN_COLUMN_WIDTH = 60;

/**
 * The indicator of a header filter cell, see the top of the file
 */
export interface OperatorIndicator {
    /** the side of the input it is on: the input's padding makes room on that side */
    side: 'left' | 'right';
    /** its id: the input is described by it (aria-describedby), a screen reader reads the operator */
    id: string;
    /** the button - a span for a column with one operator - to render after the input */
    template: TemplateResult;
    /** true when the header filter matches case: `Aa` before the symbol, the indicator is wider */
    matchCase: boolean;
}

/**
 * The indicator of a header filter cell, null for none: `GridConfig.filterOperatorIndicator` false, a
 * boolean column, or a column narrower than {@link INDICATOR_MIN_COLUMN_WIDTH}.
 *
 * A click opens the choice under it: `beforeOpen` first - it filters on the text typed in the input,
 * as a right click on the input does. A mouse click puts the focus in the input first (the menu gives
 * it back there when it closes, as the button of a lookup cell does); a tap does not, the phone's
 * keyboard would open. A mousedown on it is canceled: it takes no focus. A right click on it, and a long
 * press, open the filter menu, as on the input: `contextMenu`, which cancels the browser's menu.
 * @param column the column's index in its section (colType)
 */
export function operatorIndicator(
    ctx: Grid,
    cell: HTMLCellElement,
    colType: ColType,
    column: number,
    attribute: string,
    beforeOpen: () => void,
    contextMenu: (event: MouseEvent) => void
): OperatorIndicator | null {
    const config = ctx.gridInterface.__getGridConfig();
    const type = headerFilterType(ctx.gridInterface, attribute);
    const width = sectionColumns(config, colType)[column]?.width ?? 0;
    const operator = getHeaderFilterOperator(ctx, attribute);
    const symbol = SYMBOL_TEXTS[operator];
    if (!config.filterOperatorIndicator || type === 'boolean' || width < INDICATOR_MIN_COLUMN_WIDTH || !symbol) {
        return null;
    }

    // a number's value is on the right, a date is typed from the left - but it reads "≥ 2026-01-01"
    const side = type === 'text' ? 'right' : 'left';
    const id = `${cell.id}-operator`;
    // matching case (ColumnConfig.filterCaseSensitive, or Match case on): Aa before the symbol
    const matchCase = type === 'text' && isHeaderFilterCaseSensitive(ctx, attribute);
    const className = `simple-html-grid-filter-operator simple-html-grid-filter-operator-${side}${
        matchCase ? ' simple-html-grid-filter-operator-case' : ''
    }`;
    // its name for a screen reader: the operator as Operator › names it - and that it matches case
    const operatorText = matchCase
        ? gridText(ctx, 'filter.indicator.matchCase', { operator: operatorName(ctx, operator) })
        : operatorName(ctx, operator);
    const name = gridText(ctx, 'filter.indicator', { operator: operatorText });
    const content = html`${
        matchCase
            ? html`<span class="simple-html-grid-filter-case" aria-hidden="true">${gridText(ctx, 'filter.indicator.case')}</span>`
            : nothing
    }${gridText(ctx, symbol)}`;

    if (!canChooseOperator(ctx, attribute)) {
        // nothing to choose: the symbol, its name as its tooltip. Hidden from a screen reader, the input
        // is described by it
        return {
            side,
            id,
            matchCase,
            template: html`<span class=${className} id=${id} title=${name} aria-label=${name} aria-hidden="true"
                >${content}</span
            >`
        };
    }

    return {
        side,
        id,
        matchCase,
        template: html`<button
            type="button"
            class=${className}
            id=${id}
            tabindex="-1"
            aria-haspopup="menu"
            aria-label=${name}
            title=${gridText(ctx, 'filter.indicator.tooltip', { operator: operatorText })}
            @mousedown=${(event: MouseEvent) => {
                // the focus stays where it is, the click below puts it in the input
                event.preventDefault();
            }}
            @contextmenu=${contextMenu}
            @click=${(event: MouseEvent) => {
                // the mouse: the focus in the input, the choice gives it back there when it closes. An
                // input that has it already gets no focus event. Not a finger: the phone's keyboard would open
                if (!isFingerClick(ctx, event)) {
                    cell.querySelector<HTMLInputElement>('input.simple-html-grid-cell-filter-input')?.focus({
                        preventScroll: true
                    });
                }
                beforeOpen();
                openOperatorChoice(ctx, cell, attribute, event.currentTarget as HTMLElement);
            }}
        >
            ${content}
        </button>`
    };
}

/**
 * true when the header filter of a column offers more than one operator: a choice to open. Not a
 * boolean column, it has none
 */
export function canChooseOperator(ctx: Grid, attribute: string): boolean {
    const type = headerFilterType(ctx.gridInterface, attribute);
    return type !== 'boolean' && headerOperators(ctx.gridInterface.__getGridConfig().columns[attribute], type).length > 1;
}

/**
 * Opens the operator choice of a column's header filter under `anchor` - the indicator, or the cell
 * when it has none (F4 in a cell without one): a menu of the grid (showMenu) with the items of
 * Filter › Operator › (headerOperatorItems), the operator in use checked, then a line
 * (`filter.filterOnTypeSeparator`) and "Filter as you type" (`filter.filterOnType`, a ✓ while it is on).
 * Its context is the filter menu's, the cell it is in. Opened from the keyboard the focus is on its
 * first item, Esc closes it and the focus goes back where it was
 */
export function openOperatorChoice(ctx: Grid, cell: HTMLCellElement, attribute: string, anchor: HTMLElement) {
    const datasource = ctx.gridInterface.getDatasource();
    const context: MenuContext = {
        menu: 'filter',
        field: attribute,
        // the first displayed row as it is now, as the filter menu has it
        row: datasource.getRow(0),
        rowIndex: 0,
        cell,
        gridInterface: ctx.gridInterface,
        datasource
    };
    const entries: MenuEntry[] = [
        ...headerOperatorItems(ctx, attribute),
        { type: 'separator', id: 'filter.filterOnTypeSeparator' },
        filterOnTypeItem(ctx, attribute),
        // a text column: Match case, as Filter › has it
        matchCaseItem(ctx, attribute)
    ];
    showMenu(ctx, entries, context, placeAt(anchor));
}

/**
 * the name of an operator as Operator › shows it (`filter.operator.*`)
 */
function operatorName(ctx: Grid, operator: FilterOperator): string {
    const id = HEADER_OPERATOR_TEXTS[operator];
    return id ? gridText(ctx, id) : operator;
}
