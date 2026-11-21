import { html, render } from 'lit-html';
import type { FilterGroupNode, FilterNode } from '../../datasource/dataSource';
import { findText } from '../../texts';
import type { Grid } from '../grid';
import { renderTotalsRow } from './aggregates';
import { clearAllColumnFilters } from './clearAllColumnFilters';
import { getColumnLabel } from './getColumnLabel';
import { getElementByClassName } from './getElementByClassName';
import { gridText } from './gridText';
import { openFilterEditor } from './openFilterEditor';

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

function renderNode(ctx: Grid, node: FilterNode): unknown {
    if (node.kind === 'condition') {
        return html`
            <span class="footer-filter-chip">
                <span class="footer-filter-attr">${node.label || UNKNOWN}</span>
                <span class="footer-filter-op">${operatorLabel(ctx, node.operator)}</span>
                ${node.hasValue ? html`<span class="footer-filter-value">${node.value}</span>` : null}
            </span>
        `;
    }
    // group - wrap its children in a bracketed cluster so nesting stays visible
    return html`<span class="footer-filter-group">${renderChildren(ctx, node)}</span>`;
}

function renderChildren(ctx: Grid, group: FilterGroupNode) {
    const connector = gridText(ctx, group.logicalOperator === 'OR' ? 'footer.or' : 'footer.and');
    return (group.children || []).map(
        (child, i) => html`
            ${i > 0 ? html`<span class="footer-filter-connector">${connector}</span>` : null}
            ${renderNode(ctx, child)}
        `
    );
}

export function rebuildFooter(ctx: Grid) {
    // the totals row over the footer: the filter, the rows and the layout it follows change the footer too
    renderTotalsRow(ctx);

    const footer = getElementByClassName(ctx.element, 'simple-html-grid-footer');
    const totalRows = ctx.gridInterface.getDatasource().getAllData().length;
    const filteredRows = ctx.gridInterface.getDatasource().length();
    const filterTree = ctx.gridInterface.getDatasource().getFilterTree((field) => getColumnLabel(ctx, field));
    const scrollbarHeight = ctx.gridInterface.__getGridConfig().__scrollbarSize;
    // "changed rows only" (datasource.filterChangedOnly()) is not part of the filter: a chip of its own,
    // in front of the filter's. The footer shows the filter row for either
    const changedOnly = ctx.gridInterface.getDatasource().isChangedOnly();
    const filtered = filterTree !== null || changedOnly;

    const conditionCount = filterTree ? countConditions(filterTree) : 0;

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
                      ${changedOnly && filterTree ? html`<span class="footer-filter-connector">${gridText(ctx, 'footer.and')}</span>` : null}
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
                    ${filterRow}
                </div>
            `,
            footer
        );
    };

    const tooMany = conditionCount > MAX_FOOTER_CONDITIONS;
    paint(tooMany);

    // if the chips still overflow the (possibly narrow) grid width, collapse to the summary
    // box rather than hard-clipping a chip mid-word
    if (filterTree && !tooMany) {
        const chips = footer.querySelector('.footer-filter-chips');
        if (chips && chips.scrollWidth - chips.clientWidth > 1) {
            paint(true);
        }
    }
}
