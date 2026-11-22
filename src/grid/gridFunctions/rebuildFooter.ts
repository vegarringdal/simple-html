import { html, render } from 'lit-html';
import type { FilterGroupNode, FilterNode } from '../../datasource/dataSource';
import { findText } from '../../texts';
import type { Grid } from '../grid';
import { renderTotalsRow } from './aggregates';
import { clearAllColumnFilters } from './clearAllColumnFilters';
import { findFilterRowsText } from './findBar';
import { getColumnLabel } from './getColumnLabel';
import { getElementByClassName } from './getElementByClassName';
import { gridText } from './gridText';
import { openFilterEditor } from './openFilterEditor';
import { selectionSummary } from './selectionSummary';

/**
 * The footer runs inside every rebuild, so it must never throw - if it does, the rows are not
 * rendered either. A half built filter (a condition added in the filter editor but not filled in,
 * an empty sub group) can reach us without operator/attribute, it is shown as "?".
 */
const UNKNOWN = '?';

/**
 * The short name of an operator on a chip, the text `footer.operator.<operator>`: symbols for the
 * arithmetic ones so a chip stays compact, words for the rest. An operator of plain js that is not
 * one is shown lower cased.
 */
function operatorLabel(ctx: Grid, operator: string | undefined) {
    if (!operator) {
        return UNKNOWN;
    }
    return (
        findText(`footer.operator.${operator}`, ctx.gridInterface.__getGridConfig().texts) ??
        operator.toLowerCase().replace(/_/g, ' ')
    );
}

/** total number of conditions in the tree, used to fall back to a summary when it is too large */
function countConditions(node: FilterNode): number {
    if (node.kind === 'condition') {
        return 1;
    }
    return (node.children || []).reduce((sum, child) => sum + countConditions(child), 0);
}

// the filter editor caps a filter at 5 statements; past that the footer just summarises
const MAX_FOOTER_CONDITIONS = 5;

/**
 * A chip: the label, the operator and the value. A BETWEEN with both ends: `between`, the start, `and`
 * (the text `footer.betweenAnd`) and the end; with one end it is shown as what it is, `≥ 10` or
 * `≤ 20`. A condition that matches case has "Aa" after its value
 */
function renderNode(ctx: Grid, node: FilterNode): unknown {
    if (node.kind === 'condition') {
        const valueSpan = (text: string) => html`<span class="footer-filter-value">${text}</span>`;
        let operator = operatorLabel(ctx, node.operator);
        let value: unknown = node.hasValue ? valueSpan(node.value) : null;
        if (node.operator === 'BETWEEN' && node.value !== '' && node.valueTo) {
            value = html`${valueSpan(node.value)} <span class="footer-filter-op">${gridText(ctx, 'footer.betweenAnd')}</span>
                ${valueSpan(node.valueTo)}`;
        } else if (node.operator === 'BETWEEN') {
            const from = node.value !== '';
            operator = operatorLabel(ctx, from ? 'GREATER_THAN_OR_EQUAL_TO' : 'LESS_THAN_OR_EQUAL_TO');
            value = valueSpan(from ? node.value : (node.valueTo ?? ''));
        }
        return html`
            <span class="footer-filter-chip">
                <span class="footer-filter-attr">${node.label || UNKNOWN}</span>
                <span class="footer-filter-op">${operator}</span>
                ${value}
                ${
                    node.caseSensitive
                        ? html`<span class="footer-filter-case" title=${gridText(ctx, 'footer.matchCase.tooltip')}
                              >${gridText(ctx, 'footer.matchCase')}</span
                          >`
                        : null
                }
            </span>
        `;
    }
    // group - wrap its children in a bracketed cluster so nesting stays visible
    return html`<span class="footer-filter-group">${renderChildren(ctx, node)}</span>`;
}

function renderChildren(ctx: Grid, group: FilterGroupNode) {
    const connector = gridText(ctx, group.group === 'OR' ? 'footer.or' : 'footer.and');
    return (group.children || []).map(
        (child, i) => html`
            ${i > 0 ? html`<span class="footer-filter-connector">${connector}</span>` : null}
            ${renderNode(ctx, child)}
        `
    );
}

/**
 * The summary of the selected cells at the footer's right (selectionSummary.ts): how many have a value,
 * and of the numbers the sum, average, smallest and largest - shown with the formatter of the first
 * number field, two decimals at most. All of it in its tooltip too, when it is cut. null when the
 * ranges are one cell or none
 * @param top where it starts: on the line of the filter chips under the horizontal scrollbar's band
 *   when there is a filter, else the whole height - in the middle, like the row count
 */
function summaryTemplate(ctx: Grid, top: number) {
    const summary = selectionSummary(ctx);
    if (!summary) {
        return null;
    }
    const parts = [gridText(ctx, 'footer.summary.count', { count: summary.count })];
    if (summary.numberField && summary.sum !== null && summary.avg !== null && summary.min !== null && summary.max !== null) {
        const formatter = ctx.gridInterface.getDatasource().getFormatter(summary.numberField);
        const shown = (value: number) => formatter.format(Math.round(value * 100) / 100);
        parts.push(
            gridText(ctx, 'footer.summary.sum', { sum: shown(summary.sum) }),
            gridText(ctx, 'footer.summary.avg', { avg: shown(summary.avg) }),
            gridText(ctx, 'footer.summary.min', { min: shown(summary.min) }),
            gridText(ctx, 'footer.summary.max', { max: shown(summary.max) })
        );
    }
    return html`<div
        class="footer-summary"
        role="group"
        aria-label=${gridText(ctx, 'footer.summary')}
        title=${parts.join('\n')}
        style="top:${top}px"
    >
        ${parts.map((part) => html`<span class="footer-summary-item">${part}</span>`)}
    </div>`;
}

/**
 * true when the filter chips reach under the summary of the selected cells: the chips are centered, the
 * summary is at the right
 */
function chipsUnderSummary(footer: HTMLElement): boolean {
    const chips = footer.querySelector('.footer-filter-chips');
    const summary = footer.querySelector('.footer-summary');
    if (!chips || !summary) {
        return false;
    }
    const chipsRect = chips.getBoundingClientRect();
    const summaryRect = summary.getBoundingClientRect();
    return chipsRect.left < summaryRect.left && chipsRect.right > summaryRect.left;
}

/**
 * The totals row and the footer, for a rebuild
 */
export function rebuildFooter(ctx: Grid) {
    // the totals row over the footer: the filter, the rows and the layout it follows change the footer too
    renderTotalsRow(ctx);
    renderFooter(ctx);
}

/**
 * The footer: the row count, the filter, the summary of the selected cells. On its own when the ranges
 * or the values in them change (see GridInterface.__setRanges, renderChangedRows)
 */
export function renderFooter(ctx: Grid) {
    const footer = getElementByClassName(ctx.element, 'simple-html-grid-footer');
    const totalRows = ctx.gridInterface.getDatasource().getAllData().length;
    const filteredRows = ctx.gridInterface.getDatasource().length();
    // a lookup column (ColumnConfig.editor) shows the labels of its values, as its cells do
    const filterTree = ctx.gridInterface.getDatasource().getFilterTree(
        (field) => getColumnLabel(ctx, field),
        (field) => ctx.gridInterface.__getLookupColumn(field)?.formatter
    );
    const scrollbarHeight = ctx.gridInterface.__getGridConfig().__scrollbarSize;
    // "changed rows only" (datasource.filterChangedOnly()) is not part of the filter: a chip of its own,
    // in front of the filter's. The footer shows the filter row for either
    const changedOnly = ctx.gridInterface.getDatasource().isChangedOnly();
    // and Find's "Filter rows" (findBar.ts) while it hides rows: a chip with its text, after that one.
    // The text can be long: cut with an ellipsis, all of it in the tooltip
    const findFilterText = findFilterRowsText(ctx);
    const findChip = findFilterText === null ? null : gridText(ctx, 'footer.findFilter', { text: findFilterText });
    const filtered = filterTree !== null || changedOnly || findChip !== null;
    const and = html`<span class="footer-filter-connector">${gridText(ctx, 'footer.and')}</span>`;

    const conditionCount = filterTree ? countConditions(filterTree) : 0;
    const summary = summaryTemplate(ctx, filtered ? scrollbarHeight : 0);

    // `collapse` replaces the chips with a single summary box - used both when there are more
    // conditions than the cap and (see below) when the chips do not fit the grid width.
    const paint = (collapse: boolean) => {
        const filterRow = filtered
            ? html`
                  <div class="footer-filter">
                      <button
                          class="footer-filter-clear"
                          title=${gridText(ctx, 'footer.clear.tooltip')}
                          @click=${(e: MouseEvent) => {
                              e.stopPropagation();
                              clearAllColumnFilters(ctx);
                          }}
                      >
                          ${gridText(ctx, 'footer.clear')}
                      </button>
                      ${changedOnly ? html`<span class="footer-filter-chip footer-filter-changed-only">${gridText(ctx, 'footer.changedOnly')}</span>` : null}
                      ${changedOnly && (findChip !== null || filterTree) ? and : null}
                      ${
                          findChip !== null
                              ? html`<span class="footer-filter-chip footer-filter-find" title=${findChip}
                                    ><span class="footer-filter-find-text">${findChip}</span></span
                                >`
                              : null
}
                      ${findChip !== null && filterTree ? and : null}
                      ${
                          filterTree
                              ? html`<div
                          class="footer-filter-chips"
                          role="button"
                          tabindex="0"
                          title=${gridText(ctx, 'footer.filter.tooltip')}
                          @click=${() => openFilterEditor(ctx)}
                          @keydown=${(e: KeyboardEvent) => {
                              // a button: Enter and Space open the filter editor too
                              if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  openFilterEditor(ctx);
                              }
                          }}
                      >
                          ${
                              collapse
                                  ? html`<span class="footer-filter-toomany"
                                    >${gridText(ctx, conditionCount === 1 ? 'footer.collapsed.one' : 'footer.collapsed.other', {
                                        count: conditionCount
                                    })}</span
                                >`
                                  : renderChildren(ctx, filterTree)
}
                      </div>`
                              : null
}
                  </div>
              `
            : null;

        // with a filter the count floats in the scrollbar band at the very top (painted in
        // front of the scrollbar via z-index), so it costs no vertical space and the chips
        // only have to clear the scrollbar. without a filter it just centers.
        // The count is a status (a polite live region): a screen reader reads it out when it
        // changes, after a filter or when a group is expanded or collapsed
        render(
            html`
                <div
                    class="footer-inner ${filtered ? 'has-filter' : ''}"
                    style=${filtered ? `padding-top:${scrollbarHeight}px;` : ''}
                >
                    <span
                        class="footer-count"
                        role="status"
                        style=${filtered ? `height:${scrollbarHeight}px;line-height:${scrollbarHeight}px;` : ''}
                        >${gridText(ctx, 'footer.rowCount', { shown: filteredRows, total: totalRows })}</span
                    >
                    ${filterRow} ${summary}
                </div>
            `,
            footer
        );
    };

    const tooMany = conditionCount > MAX_FOOTER_CONDITIONS;
    paint(tooMany);

    // if the chips still overflow the (possibly narrow) grid width, or reach under the summary of the
    // selected cells, collapse to one box ("2 filters - click to edit") rather than hard-clipping a chip mid-word
    if (filterTree && !tooMany) {
        const chips = footer.querySelector('.footer-filter-chips');
        if ((chips && chips.scrollWidth - chips.clientWidth > 1) || chipsUnderSummary(footer)) {
            paint(true);
        }
    }
}
