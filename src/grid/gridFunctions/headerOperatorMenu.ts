import type { FilterOperator } from '../../datasource/filterExpression';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuItem } from '../gridMenus';
import { headerFilterType, headerOperators, isClobField } from './columnFilterOptions';
import { filterCallback } from './filterCallback';
import { getHeaderFilterOperator } from './getHeaderFilterOperator';
import { gridText } from './gridText';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';

/**
 * The operators a header filter can be switched to, one code for the places that switch it: the filter
 * menu's Filter › Operator › and its range block (contextmenuFilter.ts), and the operator indicator of
 * the header filter cell (filterOperatorIndicator.ts).
 */

/**
 * The text of each operator of the header filter's Operator ›, its id in MENU_IDS.filter too, in the
 * order of the menu. The operators the header filter's input takes (isHeaderOperator)
 */
export const HEADER_OPERATOR_TEXTS: Partial<Record<FilterOperator, TextId>> = {
    EQUAL: 'filter.operator.equal',
    NOT_EQUAL_TO: 'filter.operator.notEqualTo',
    LESS_THAN: 'filter.operator.lessThan',
    LESS_THAN_OR_EQUAL_TO: 'filter.operator.lessThanOrEqualTo',
    GREATER_THAN: 'filter.operator.greaterThan',
    GREATER_THAN_OR_EQUAL_TO: 'filter.operator.greaterThanOrEqualTo',
    BETWEEN: 'filter.operator.between',
    CONTAINS: 'filter.operator.contains',
    DOES_NOT_CONTAIN: 'filter.operator.doesNotContain',
    BEGIN_WITH: 'filter.operator.beginWith',
    END_WITH: 'filter.operator.endWith'
};

/**
 * The items of Operator ›, new objects every call: one per operator of HEADER_OPERATOR_TEXTS, shown
 * when the column offers it (headerOperators: its type's, or its `filterOperators`) - none on a boolean
 * column, its header filter is a checkbox. The operator in use (getHeaderFilterOperator) has a ✓, an
 * item switches to its operator (setHeaderFilterOperator). The id of an item is the id of its text
 */
export function headerOperatorItems(ctx: Grid, attribute: string): MenuItem[] {
    // a lookup column filters on its labels: the operators of a text (filterCallback)
    const type = headerFilterType(ctx.gridInterface, attribute);
    const offered = headerOperators(
        ctx.gridInterface.__getGridConfig().columns[attribute],
        type,
        isClobField(ctx.gridInterface, attribute)
    );
    // the operator picked before (state), else the column's, else the type's default
    const current = getHeaderFilterOperator(ctx, attribute);

    return Object.entries(HEADER_OPERATOR_TEXTS).map(
        ([operator, id]): MenuItem => ({
            id,
            label: gridText(ctx, id),
            visible: () => type !== 'boolean' && offered.includes(operator as FilterOperator),
            selected: () => current === operator,
            action: () => setHeaderFilterOperator(ctx, attribute, operator as FilterOperator)
        })
    );
}

/**
 * Switches a column's header filter to `picked`: the operator is state
 * (`GridState.headerFilters[field].operator`), the filter runs again with the value the cell has, the
 * header is rendered again - the cell shows its value for the operator (a BETWEEN's from..to), its
 * placeholder and its operator indicator - and the grid sends `filter-operator-change`.
 *
 * The header filter that had the focus has it again after: rendering the header makes its input anew.
 * Picked from the keyboard (Enter in the menu) the menu gave the focus back to it before.
 */
export function setHeaderFilterOperator(ctx: Grid, attribute: string, picked: FilterOperator) {
    const refocus = keepHeaderFilterFocus(ctx);
    ctx.gridInterface.__setHeaderFilterOperator(attribute, picked);
    filterCallback(ctx, ctx.gridInterface.__getHeaderFilter(attribute)?.value ?? null, attribute);
    rebuildHeaderColumns(ctx);
    operatorPicked(ctx, attribute, picked);
    // after the handlers: one can render the header again (rebuildHeader)
    refocus();
}

/**
 * The `filter-operator-change` event: an operator picked in Operator › or the operator indicator's
 * choice (setHeaderFilterOperator), or applied with the range block of the filter menu (rangeBlock in
 * contextmenuFilter.ts). After the filter ran with it and the header was rendered again
 */
export function operatorPicked(ctx: Grid, attribute: string, operator: FilterOperator) {
    ctx.gridInterface.__callSubscribers('filter-operator-change', {
        field: attribute,
        operator,
        column: ctx.gridInterface.__getGridConfig().columns[attribute],
        rebuildHeader: () => rebuildHeaderColumns(ctx)
    });
}

/**
 * For a render of the header, or of the rows after a filter: the header filter input with the focus now
 * - the document's, or the shadow root's the grid is in - gets it back after, the input in its place
 * (its `filter-cellpos-` class) when it was made anew, its caret (or the text selected) where it was when
 * it has the same text - filter as you type renders the rows while the user types (filterOnType.ts).
 * Nothing when the focus is elsewhere, or stayed on its input
 * @returns call it after the render
 */
export function keepHeaderFilterFocus(ctx: Grid): () => void {
    const root = ctx.element.getRootNode() as Partial<DocumentOrShadowRoot>;
    const focused = root.activeElement;
    if (
        !(focused instanceof HTMLInputElement) ||
        !focused.classList.contains('simple-html-grid-cell-filter-input') ||
        !ctx.element.contains(focused)
    ) {
        return () => {};
    }
    const place = Array.from(focused.classList).find((name) => name.startsWith('filter-cellpos-'));
    const { value, selectionStart, selectionEnd } = focused;
    return () => {
        if (focused.isConnected || !place) {
            return;
        }
        // the cell is where it was, the grid must not scroll to it
        const input = ctx.element.getElementsByClassName(place)[0];
        if (input instanceof HTMLInputElement) {
            input.focus({ preventScroll: true });
            if (input.value === value && selectionStart !== null && selectionEnd !== null) {
                input.setSelectionRange(selectionStart, selectionEnd);
            }
        }
    };
}
