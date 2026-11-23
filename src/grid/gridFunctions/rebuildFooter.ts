import { html, render, svg } from 'lit-html';
import type { FilterGroupNode, FilterNode } from '../../datasource/dataSource';
import { findText } from '../../texts';
import type { Grid } from '../grid';
import { renderTotalsRow } from './aggregates';
import { clearAllColumnFilters } from './clearAllColumnFilters';
import { openColumnSettings } from './columnSettings';
import { findFilterRowsCaseSensitive, findFilterRowsText } from './findBar';
import { getColumnLabel } from './getColumnLabel';
import { getElementByClassName } from './getElementByClassName';
import { gridText } from './gridText';
import { activeCellOfMenu } from './lastPress';
import { openFilterEditor } from './openFilterEditor';
import { selectionSummary } from './selectionSummary';
import { viewsButtonTemplate } from './viewsMenu';

/**
 * The footer runs inside every rebuild, so it must never throw - if it does, the rows are not
 * rendered either. A half built filter (a condition added in the filter editor but not filled in,
 * an empty sub group) can reach us without operator/attribute, it is shown as "?".
 */
const UNKNOWN = '?';

/**
 * the settings button's icon: a gear of eight square teeth around a hole, the text colour - drawn at
 * 16px in a 24px box, as the icons of the filter editor
 */
const GEAR_ICON = svg`<svg class="footer-settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="miter" aria-hidden="true" focusable="false">
    <path d="M9.7 4.8 10.2 2h3.6l.5 2.8 1.2.4 2.4-1.6 2.5 2.5-1.6 2.4.4 1.2 2.8.5v3.6l-2.8.5-.4 1.2 1.6 2.4-2.5 2.5-2.4-1.6-1.2.4-.5 2.8h-3.6l-.5-2.8-1.2-.4-2.4 1.6-2.5-2.5 1.6-2.4-.4-1.2-2.8-.5v-3.6l2.8-.5.4-1.2-1.6-2.4 2.5-2.5 2.4 1.6z" />
    <circle cx="12" cy="12" r="3.2" />
</svg>`;

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
 * and of the numbers the sum, average, smallest and largest - shown as the cells of the first number
 * field show a value (its formatter, with its display format), two decimals at most - the decimals of
 * the display format when it has them. All of it in its tooltip too, when it is cut. null when the
 * ranges are one cell or none
 * @param top where it starts: on the line of the filter's row (Clear and the chips, or "No filter")
 *   under the horizontal scrollbar's band, else the whole height - in the middle, like the row count
 */
function summaryTemplate(ctx: Grid, top: number) {
    const summary = selectionSummary(ctx);
    if (!summary) {
        return null;
    }
    const parts = [gridText(ctx, 'footer.summary.count', { count: summary.count })];
    if (summary.numberField && summary.sum !== null && summary.avg !== null && summary.min !== null && summary.max !== null) {
        const formatter = ctx.gridInterface.__getCellFormatter(summary.numberField);
        const decimals = ctx.gridInterface.__getGridConfig().columns[summary.numberField]?.format?.number?.decimals;
        const shown = (value: number) => formatter.format(decimals === undefined ? Math.round(value * 100) / 100 : value);
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
    // overlapping: the chips reach into the summary from its left, or are under it (the footer keeps room for
    // the settings button on both sides, the summary starts further left)
    return chipsRect.right > summaryRect.left && chipsRect.left < summaryRect.right;
}

// the space in px between the filter's row and the summary of the selected cells, as between the summary's items
const SUMMARY_GAP = 12;

/**
 * The summary of the selected cells is cut where the filter's row ends - the button "No filter", or
 * Clear and the chips (collapsed by then) - so it is never painted over them on a narrow grid. Its
 * tooltip has all of it. renderFooter gives it its width from the css back before it paints: lit keeps
 * the element, and the chips are measured against the summary as wide as the css makes it
 */
function fitSummary(footer: HTMLElement) {
    const row = footer.querySelector('.footer-filter');
    const summary = footer.querySelector<HTMLElement>('.footer-summary');
    if (!row || !summary) {
        return;
    }
    const rowRight = row.getBoundingClientRect().right;
    const summaryRect = summary.getBoundingClientRect();
    if (rowRight + SUMMARY_GAP > summaryRect.left) {
        summary.style.maxWidth = `${Math.max(0, summaryRect.right - rowRight - SUMMARY_GAP)}px`;
    }
}

// the space in px between the views button and the filter's row - which has 6px of its own before Clear
const VIEWS_GAP = 4;

// the least width in px of the name on a cut views button: two letters and the ellipsis, else none
const MIN_VIEW_NAME = 16;

/**
 * The name on the views button (viewsMenu.ts) is cut where the filter's row starts - Clear and the chips,
 * or "No filter" - so the button is never painted over them on a narrow grid: the filter goes first. Its
 * `*` and chevron stay, in the room the footer keeps at its left end (has-views); its tooltip has the
 * whole name. renderFooter gives it its width from the css back before it paints, as the summary's
 */
function fitViews(footer: HTMLElement) {
    const row = footer.querySelector('.footer-filter');
    const views = footer.querySelector<HTMLElement>('.footer-views');
    if (!row || !views) {
        return;
    }
    const rowLeft = row.getBoundingClientRect().left;
    const viewsRect = views.getBoundingClientRect();
    if (viewsRect.right + VIEWS_GAP > rowLeft) {
        views.style.maxWidth = `${Math.max(0, rowLeft - VIEWS_GAP - viewsRect.left)}px`;
        // a sliver of the name is no name: the * and the chevron alone then
        const name = views.querySelector<HTMLElement>('.footer-views-name');
        if (name && name.getBoundingClientRect().width < MIN_VIEW_NAME) {
            name.style.display = 'none';
        }
    }
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
 * or the values in them change (see GridInterface.__setRanges, renderChangedRows).
 *
 * The count is in the band of the horizontal scrollbar at its top, the filter's row under it: "✕ Clear"
 * and the filter as chips while the rows are filtered, else a button "No filter" in Clear's place that
 * opens the filter editor - as a click on the chips and the filter menu's "Advanced Filter…" do. The same
 * layout with and without a filter: nothing moves when a filter comes or goes. A footer of no height
 * (`footerHeight: 0`, the dropdown grid of a lookup column) has no "No filter": nothing would show it,
 * and Tab skips its buttons (tabExit.ts). Its count is alone then, in the middle.
 *
 * The settings button (`GridConfig.settingsButton`), a gear, is at the right end on the line of the
 * filter's row - the last stop of Tab in the footer. It opens the grid config dialog
 * (columnSettings.ts) on the column of the cell that had the focus. With it the footer keeps its room on
 * both sides (`has-settings`): the filter's row stays in the middle and never reaches under it, the
 * summary of the selected cells ends left of it.
 *
 * The views button (`GridConfig.viewsButton`, viewsMenu.ts) is at the left end on that line, the first
 * stop of Tab in the footer: the name of the view shown, a click opens the views menu. With it the
 * footer keeps the same room on both sides (`has-views`), and its name is cut where the filter's row
 * starts (fitViews)
 */
export function renderFooter(ctx: Grid) {
    const footer = getElementByClassName(ctx.element, 'simple-html-grid-footer');
    const config = ctx.gridInterface.__getGridConfig();
    const totalRows = ctx.gridInterface.getDatasource().getAllData().length;
    const filteredRows = ctx.gridInterface.getDatasource().length();
    // a lookup column (ColumnConfig.editor) shows the labels of its values, as its cells do
    const filterTree = ctx.gridInterface.getDatasource().getFilterTree(
        (field) => getColumnLabel(ctx, field),
        (field) => ctx.gridInterface.__getLookupColumn(field)?.formatter
    );
    const scrollbarHeight = config.__scrollbarSize;
    // "changed rows only" (datasource.filterChangedOnly()) is not part of the filter: a chip of its own,
    // in front of the filter's. The footer shows the filter row for either
    const changedOnly = ctx.gridInterface.getDatasource().isChangedOnly();
    // and Find's "Filter rows" (findBar.ts) while it hides rows: a chip with its text, after that one.
    // The text can be long: cut with an ellipsis, all of it in the tooltip
    const findFilterText = findFilterRowsText(ctx);
    const findChip = findFilterText === null ? null : gridText(ctx, 'footer.findFilter', { text: findFilterText });
    const filtered = filterTree !== null || changedOnly || findChip !== null;
    // the filter's row: Clear and the chips, or the button "No filter"
    const hasRow = filtered || config.footerHeight > 0;
    const and = html`<span class="footer-filter-connector">${gridText(ctx, 'footer.and')}</span>`;

    // the gear at the right end, in a footer that shows the filter's row
    const settings = config.settingsButton && config.footerHeight > 0;
    const settingsButton = settings
        ? html`<button
              type="button"
              class="footer-settings"
              style="top:${scrollbarHeight}px"
              aria-label=${gridText(ctx, 'footer.settings')}
              aria-haspopup="dialog"
              title=${gridText(ctx, 'footer.settings')}
              @click=${(e: MouseEvent) => {
                  e.stopPropagation();
                  // the column of the cell that had the focus when it was pressed (or now, from a key)
                  openColumnSettings(ctx, activeCellOfMenu(ctx)?.field);
              }}
          >
              ${GEAR_ICON}
          </button>`
        : null;

    const conditionCount = filterTree ? countConditions(filterTree) : 0;
    const summary = summaryTemplate(ctx, hasRow ? scrollbarHeight : 0);
    // the summary of the last render is kept by lit: as wide as the css makes it again, fitSummary cuts it below
    const shownSummary = footer.querySelector<HTMLElement>('.footer-summary');
    if (shownSummary) {
        shownSummary.style.maxWidth = '';
    }
    // the views button at the left end, null when it is not shown. Kept by lit too: fitViews cuts it below
    const viewsButton = viewsButtonTemplate(ctx, scrollbarHeight);
    const shownViews = footer.querySelector<HTMLElement>('.footer-views');
    if (shownViews) {
        shownViews.style.maxWidth = '';
        const shownName = shownViews.querySelector<HTMLElement>('.footer-views-name');
        if (shownName) {
            shownName.style.display = '';
        }
    }

    // `collapse` replaces the chips with a single summary box - used both when there are more
    // conditions than the cap and (see below) when the chips do not fit the grid width.
    const paint = (collapse: boolean) => {
        // the first button is "✕ Clear" with a filter, "No filter" without one: one element, its class,
        // text and click change. So the focus stays on it when the filter comes or goes - the filter
        // editor opened with it gives the focus back to it when it closes, after its filter is applied
        const filterRow = hasRow
            ? html`
                  <div class="footer-filter">
                      <button
                          type="button"
                          class=${filtered ? 'footer-filter-clear' : 'footer-filter-none'}
                          title=${gridText(ctx, filtered ? 'footer.clear.tooltip' : 'footer.noFilter.tooltip')}
                          @click=${(e: MouseEvent) => {
                              e.stopPropagation();
                              if (filtered) {
                                  clearAllColumnFilters(ctx);
                              } else {
                                  openFilterEditor(ctx);
                              }
                          }}
                      >
                          ${gridText(ctx, filtered ? 'footer.clear' : 'footer.noFilter')}
                      </button>
                      ${changedOnly ? html`<span class="footer-filter-chip footer-filter-changed-only">${gridText(ctx, 'footer.changedOnly')}</span>` : null}
                      ${changedOnly && (findChip !== null || filterTree) ? and : null}
                      ${
                          findChip !== null
                              ? html`<span class="footer-filter-chip footer-filter-find" title=${findChip}
                                    ><span class="footer-filter-find-text">${findChip}</span>${
                                        // Match case: the marker of a condition that matches case
                                        findFilterRowsCaseSensitive(ctx)
                                            ? html`<span
                                                  class="footer-filter-case"
                                                  title=${gridText(ctx, 'footer.matchCase.tooltip')}
                                                  >${gridText(ctx, 'footer.matchCase')}</span
                                              >`
                                            : null
                                    }</span
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

        // with the filter's row the count floats in the scrollbar band at the very top (painted in
        // front of the scrollbar via z-index), so it costs no vertical space and the row only has
        // to clear the scrollbar. without it (a footer of no height) it just centers.
        // The count is a status (a polite live region): a screen reader reads it out when it
        // changes, after a filter or when a group is expanded or collapsed
        render(
            html`
                <div
                    class="footer-inner ${filtered ? 'has-filter' : ''} ${hasRow && !filtered ? 'no-filter' : ''} ${settings ? 'has-settings' : ''} ${viewsButton ? 'has-views' : ''}"
                    style=${hasRow ? `padding-top:${scrollbarHeight}px;` : ''}
                >
                    ${viewsButton}
                    <span
                        class="footer-count"
                        role="status"
                        style=${hasRow ? `height:${scrollbarHeight}px;line-height:${scrollbarHeight}px;` : ''}
                        >${gridText(ctx, 'footer.rowCount', { shown: filteredRows, total: totalRows })}</span
                    >
                    ${filterRow} ${summary} ${settingsButton}
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
    fitSummary(footer);
    fitViews(footer);
}
