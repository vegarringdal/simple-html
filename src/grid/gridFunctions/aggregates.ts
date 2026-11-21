import { html, nothing, render, type TemplateResult } from 'lit-html';
import type { AggregateFunction } from '../../datasource/aggregate';
import type { Grid } from '../grid';
import type { LayoutColumn, ParsedGridConfig } from '../gridConfig';
import { ariaColCount, ariaColIndex, ariaId, headerRowCount } from './ariaGrid';
import { asPx } from './asPx';
import type { ColType } from './colType';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getElementByClassName } from './getElementByClassName';
import { getGroupingWidth } from './getGroupingWidth';
import { gridText } from './gridText';

/**
 * Aggregates in the grid: the aggregate of a column (`ColumnConfig.aggregate`) in the group rows
 * (renderRowGroup.ts) and in the totals row under the rows (renderTotalsRow below). The datasource
 * computes them, `datasource.aggregate()`.
 *
 * Both rows show them the same way: a cell in the place of the field - the left, middle and right
 * sections side by side, as in the body, each field at the left of its column and on the line of its
 * place in the column (a column can stack fields). The middle section follows the horizontal scroll:
 * its cells are in an element moved by the css variable `--simple-html-grid-scroll-left`, which
 * {@link followMiddleScroll} sets on the group rows' view and on the totals row. Every aggregated field
 * of the middle has its cell, not only the ones on screen - there are few.
 */

/**
 * the class of the element the totals row is rendered in, made by createDom
 */
export const TOTALS_CLASS = 'simple-html-grid-totals';

/**
 * A field of the layout with an aggregate, and where its cell goes
 */
interface AggregatedField {
    field: string;
    fn: AggregateFunction;
    /** left of the column in its section, px */
    left: number;
    width: number;
    /** the line, the field's place in its column */
    celno: number;
    /** the cell's aria-colindex */
    colIndex: number;
}

/**
 * The fields of a section that have an aggregate, left to right
 * @param offset where the first column starts: after the grouping column in the left section
 */
function sectionFields(config: ParsedGridConfig, colType: ColType, columns: LayoutColumn[], offset: number): AggregatedField[] {
    const fields: AggregatedField[] = [];
    let left = offset;
    columns.forEach((column, columnNo) => {
        column.fields.forEach((field, celno) => {
            const fn = config.columns[field]?.aggregate;
            if (fn) {
                fields.push({
                    field,
                    fn,
                    left,
                    width: column.width,
                    celno,
                    colIndex: ariaColIndex(config, colType, columnNo, celno)
                });
            }
        });
        left = left + column.width;
    });
    return fields;
}

/**
 * The aggregated fields of the layout, per section
 */
type SectionFields = Record<'left' | 'middle' | 'right', AggregatedField[]>;

function aggregatedFields(ctx: Grid): SectionFields {
    const config = ctx.gridInterface.__getGridConfig();
    return {
        left: sectionFields(config, LEFT_PINNED_COLTYPE, config.layout.left, getGroupingWidth(ctx, LEFT_PINNED_COLTYPE)),
        middle: sectionFields(config, MIDDLE_PINNED_COLTYPE, config.layout.center, 0),
        right: sectionFields(config, RIGHT_PINNED_COLTYPE, config.layout.right, 0)
    };
}

/**
 * How many lines the aggregates of the layout need: one more than the highest place in a column of a
 * field with an aggregate. 0 when no field of the layout has one
 */
export function aggregateLines(config: ParsedGridConfig): number {
    let lines = 0;
    for (const column of [...config.layout.left, ...config.layout.center, ...config.layout.right]) {
        column.fields.forEach((field, celno) => {
            if (config.columns[field]?.aggregate) {
                lines = Math.max(lines, celno + 1);
            }
        });
    }
    return lines;
}

/**
 * true when the group rows show the aggregates: `groupAggregates` is on and a field of the layout has one
 */
export function showsGroupAggregates(config: ParsedGridConfig): boolean {
    return config.groupAggregates && aggregateLines(config) > 0;
}

/**
 * An aggregate as text: `count` as a whole number, the others with the field's formatter. '' for
 * null, the average (min, max) of no numbers
 */
function formatAggregate(ctx: Grid, field: string, fn: AggregateFunction, value: number | null): string {
    if (value === null) {
        return '';
    }
    if (fn === 'count') {
        return String(value);
    }
    return ctx.gridInterface.getDatasource().getFormatter(field).format(value);
}

/**
 * The cell of an aggregate: its label (`Sum`, the text `aggregate.sum`) and its value, right aligned
 * in the place of the field. Empty when the value is null. A gridcell at the field's column, unless
 * `hidden`: the group row's name cell has it then, see renderRowGroup
 */
function aggregateCell(ctx: Grid, aggregated: AggregatedField, value: number | null, hidden: boolean) {
    const config = ctx.gridInterface.__getGridConfig();
    const text = formatAggregate(ctx, aggregated.field, aggregated.fn, value);
    return html`<div
        role=${hidden ? 'none' : 'gridcell'}
        aria-colindex=${hidden ? nothing : aggregated.colIndex}
        aria-hidden=${hidden ? 'true' : nothing}
        class="simple-html-grid-aggregate"
        data-aggregate=${`${aggregated.fn}:${aggregated.field}`}
        style="left:${asPx(aggregated.left)};width:${asPx(aggregated.width)};top:${asPx(aggregated.celno * config.cellHeight)};height:${asPx(config.cellHeight)};line-height:${asPx(config.cellHeight)}"
    >
        ${
            text
                ? html`<span class="simple-html-grid-aggregate-label">${gridText(ctx, `aggregate.${aggregated.fn}`)}</span>
                      <span class="simple-html-grid-aggregate-value">${text}</span>`
                : nothing
        }
    </div>`;
}

/**
 * The text of an aggregate for a screen reader, `Sum 1234.5`: for the aggregate the group row's name
 * cell has, see renderRowGroup. '' when it has no value
 */
function aggregateText(ctx: Grid, aggregated: AggregatedField, value: number | null): string {
    const text = formatAggregate(ctx, aggregated.field, aggregated.fn, value);
    return text ? `${gridText(ctx, `aggregate.${aggregated.fn}`)} ${text}` : '';
}

/**
 * The cells of the aggregates of a row, in three sections with the places and the widths of the
 * body's sections: the left pinned columns, the middle (moved by the horizontal scroll) and the right
 * pinned columns. Fills the element it is put in, which starts where the left section starts
 * @param fields the aggregated fields, aggregatedFields()
 * @param valueFor the value of an aggregate in this row
 * @param hiddenColIndex the aria-colindex of a cell that is no gridcell, see aggregateCell
 */
function aggregateSections(
    ctx: Grid,
    fields: SectionFields,
    valueFor: (field: string, fn: AggregateFunction) => number | null,
    hiddenColIndex: number | null
): TemplateResult {
    const config = ctx.gridInterface.__getGridConfig();
    const leftWidth = config.__leftWidth + getGroupingWidth(ctx, LEFT_PINNED_COLTYPE);
    const cells = (list: AggregatedField[]) =>
        list.map((aggregated) =>
            aggregateCell(ctx, aggregated, valueFor(aggregated.field, aggregated.fn), aggregated.colIndex === hiddenColIndex)
        );

    return html`<div role="none" class="simple-html-absolute-fill simple-html-grid-aggregates">
        ${
            leftWidth
                ? html`<div role="none" class="simple-html-grid-aggregates-left" style="width:${asPx(leftWidth)}">
                      ${cells(fields.left)}
                  </div>`
                : nothing
        }
        <div
            role="none"
            class="simple-html-grid-aggregates-middle"
            style="left:${asPx(leftWidth)};right:${asPx(config.__rightWidth)}"
        >
            <div role="none" class="simple-html-absolute-fill" style="transform:translateX(var(--simple-html-grid-scroll-left, 0px))">
                ${cells(fields.middle)}
            </div>
        </div>
        ${
            config.__rightWidth
                ? html`<div role="none" class="simple-html-grid-aggregates-right" style="width:${asPx(config.__rightWidth)}">
                      ${cells(fields.right)}
                  </div>`
                : nothing
        }
    </div>`;
}

/**
 * The aggregates of a group row, for renderRowGroup: the cells, and for the name cell the aggregate
 * of the first field (aria-colindex 2) - its cell is under the name, so the name cell has its text for
 * a screen reader. And the aria-colspan of the name cell: up to the first aggregated field after it
 */
export function groupRowAggregates(ctx: Grid, valueFor: (field: string, fn: AggregateFunction) => number | null) {
    const fields = aggregatedFields(ctx);
    const all = [...fields.left, ...fields.middle, ...fields.right];
    const first = all.find((aggregated) => aggregated.colIndex === 2);
    const next = all.find((aggregated) => aggregated.colIndex > 2);
    return {
        sections: aggregateSections(ctx, fields, valueFor, first ? 2 : null),
        nameText: first ? aggregateText(ctx, first, valueFor(first.field, first.fn)) : '',
        // every column after the row number, without an aggregate after the first column
        nameColSpan: next ? next.colIndex - 2 : ariaColCount(ctx.gridInterface.__getGridConfig()) - 1
    };
}

/**
 * Renders the totals row: the aggregates of the columns over the rows the filter lets through (see
 * `GridConfig.totalsRow`), "Total" in front, under the row numbers. Hidden when the option is off.
 * Called by rebuildFooter, and after rows changed (renderChangedRows): the values are computed again
 * each time. Its place and height are set by updateMainElementSizes
 */
export function renderTotalsRow(ctx: Grid) {
    const totals = getElementByClassName(ctx.element, TOTALS_CLASS);
    if (!totals) {
        return;
    }
    const config = ctx.gridInterface.__getGridConfig();
    if (!config.__totalsRowHeight) {
        render(nothing, totals);
        return;
    }
    const datasource = ctx.gridInterface.getDatasource();
    render(
        html`<div
            role="row"
            id=${ariaId(ctx, 'totals')}
            aria-rowindex=${headerRowCount(config) + datasource.length() + 1}
            class="simple-html-grid-totals-row"
            style="height:${asPx(config.__totalsRowHeight)}"
        >
            <div
                role="rowheader"
                aria-colindex="1"
                class="simple-html-grid-totals-label"
                style="width:${asPx(config.__selectSizeWidth)};line-height:${asPx(config.cellHeight)}"
            >
                ${gridText(ctx, 'aggregate.total')}
            </div>
            <div role="none" class="simple-html-grid-totals-cells" style="left:${asPx(config.__selectSizeWidth)}">
                ${aggregateSections(ctx, aggregatedFields(ctx), (field, fn) => datasource.aggregate(field, fn), null)}
            </div>
        </div>`,
        totals
    );
}

/**
 * The middle section of the aggregates follows the horizontal scroll, for horizontalScrollHandler: the
 * group rows' view and the totals row get the scroll position as the css variable their middle cells
 * are moved by. Their row elements are rendered again and again while scrolling down, the variable
 * stays: what is rendered later is in the right place too.
 *
 * The middle view of the rows stops where its columns end, the scroller can go further: its own
 * vertical scrollbar takes room from its width, the view is wider (10px in Chrome). The browser stops
 * the view's scrollLeft at the end of the columns, the aggregates are stopped there the same way
 * @param scrollLeft the scroll position of the middle scroller
 */
export function followMiddleScroll(ctx: Grid, scrollLeft: number) {
    const columnsWidth = ctx.gridInterface.__getGridConfig().layout.center.reduce((sum, column) => sum + column.width, 0);
    const view = getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-middle');
    const value = asPx(-Math.max(0, Math.min(scrollLeft, columnsWidth - (view?.clientWidth ?? 0))));
    for (const className of ['simple-html-grid-body-view-group', TOTALS_CLASS]) {
        const element = getElementByClassName(ctx.element, className);
        if (element && element.style.getPropertyValue('--simple-html-grid-scroll-left') !== value) {
            element.style.setProperty('--simple-html-grid-scroll-left', value);
        }
    }
}
