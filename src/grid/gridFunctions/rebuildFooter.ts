import { html, render } from 'lit-html';
import type { FilterGroupNode, FilterNode } from '../../datasource/dataSource';
import type { Grid } from '../grid';
import { clearAllColumnFilters } from './clearAllColumnFilters';
import { getElementByClassName } from './getElementByClassName';
import { openFilterEditor } from './openFilterEditor';

/**
 * Short, readable label for each comparison operator. Symbols for the arithmetic ones so a
 * chip stays compact, words for the rest. Falls back to the raw key lowercased.
 */
const OPERATOR_LABELS: Record<string, string> = {
    EQUAL: '=',
    NOT_EQUAL_TO: '≠',
    LESS_THAN: '<',
    LESS_THAN_OR_EQUAL_TO: '≤',
    GREATER_THAN: '>',
    GREATER_THAN_OR_EQUAL_TO: '≥',
    CONTAINS: 'contains',
    DOES_NOT_CONTAIN: 'does not contain',
    BEGIN_WITH: 'starts with',
    END_WITH: 'ends with',
    IN: 'in',
    NOT_IN: 'not in',
    IS_BLANK: 'is blank',
    IS_NOT_BLANK: 'is not blank'
};

function operatorLabel(operator: string) {
    return OPERATOR_LABELS[operator] ?? operator.toLowerCase().replace(/_/g, ' ');
}

/** total number of conditions in the tree, used to fall back to a summary when it is too large */
function countConditions(node: FilterNode): number {
    if (node.kind === 'condition') {
        return 1;
    }
    return node.children.reduce((sum, child) => sum + countConditions(child), 0);
}

// the filter editor caps a filter at 5 statements; past that the footer just summarises
const MAX_FOOTER_CONDITIONS = 5;

function renderNode(node: FilterNode): unknown {
    if (node.kind === 'condition') {
        return html`
            <span class="footer-filter-chip">
                <span class="footer-filter-attr">${node.label}</span>
                <span class="footer-filter-op">${operatorLabel(node.operator)}</span>
                ${node.hasValue ? html`<span class="footer-filter-value">${node.value}</span>` : null}
            </span>
        `;
    }
    // group - wrap its children in a bracketed cluster so nesting stays visible
    return html`<span class="footer-filter-group">${renderChildren(node)}</span>`;
}

function renderChildren(group: FilterGroupNode) {
    return group.children.map(
        (child, i) => html`
            ${i > 0 ? html`<span class="footer-filter-connector">${group.logicalOperator}</span>` : null}
            ${renderNode(child)}
        `
    );
}

export function rebuildFooter(ctx: Grid) {
    const footer = getElementByClassName(ctx.element, 'simple-html-grid-footer');
    const totalRows = ctx.gridInterface.getDatasource().getAllData().length;
    const filteredRows = ctx.gridInterface.getDatasource().length();
    const filterTree = ctx.gridInterface.getDatasource().getFilterTree(ctx);
    const scrollbarHeight = ctx.gridInterface.__getGridConfig().__scrollbarSize;

    const conditionCount = filterTree ? countConditions(filterTree) : 0;

    // `collapse` replaces the chips with a single summary box - used both when there are more
    // conditions than the cap and (see below) when the chips do not fit the grid width.
    const paint = (collapse: boolean) => {
        const filterRow = filterTree
            ? html`
                  <div class="footer-filter">
                      <button
                          class="footer-filter-clear"
                          title="Clear filter"
                          @click=${(e: MouseEvent) => {
                              e.stopPropagation();
                              clearAllColumnFilters(ctx);
                          }}
                      >
                          ✕ Clear
                      </button>
                      <div class="footer-filter-chips" title="Edit filter" @click=${() => openFilterEditor(ctx)}>
                          ${
                              collapse
                                  ? html`<span class="footer-filter-toomany"
                                    >${conditionCount} filter${conditionCount === 1 ? '' : 's'} — click to edit</span
                                >`
                                  : renderChildren(filterTree)
}
                      </div>
                  </div>
              `
            : null;

        // with a filter the count floats in the scrollbar band at the very top (painted in
        // front of the scrollbar via z-index), so it costs no vertical space and the chips
        // only have to clear the scrollbar. without a filter it just centers.
        render(
            html`
                <div
                    class="footer-inner ${filterTree ? 'has-filter' : ''}"
                    style=${filterTree ? `padding-top:${scrollbarHeight}px;` : ''}
                >
                    <span
                        class="footer-count"
                        style=${filterTree ? `height:${scrollbarHeight}px;line-height:${scrollbarHeight}px;` : ''}
                        >${filteredRows}/${totalRows}</span
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
