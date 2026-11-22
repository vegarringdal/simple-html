import { html, nothing, render, type TemplateResult } from 'lit-html';
import { AGGREGATE_FUNCTIONS, type AggregateFunction } from '../../datasource/aggregate';
import type { Grid } from '../grid';
import type { LayoutColumn, ParsedGridConfig } from '../gridConfig';
import { ariaColCount, ariaColIndex, ariaId, headerRowCount } from './ariaGrid';
import { asPx } from './asPx';
import type { ColType } from './colType';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getColumnLabel } from './getColumnLabel';
import { getElementByClassName } from './getElementByClassName';
import { getGroupingWidth } from './getGroupingWidth';
import { gridText } from './gridText';
import { cellHeightOf, linesUnderTop } from './rowHeights';

/**
 * Aggregates in the grid: the aggregate of a column (`ColumnConfig.aggregate`) in the group rows
 * (renderRowGroup.ts) and in the totals row under the rows (renderTotalsRow below). The datasource
 * computes them, `datasource.aggregate()`.
 *
 * A field can have several (`aggregate: ['sum', 'avg']`): each is a line of its own in the field's
 * column, the label at the left and the value at the right. The lines of a column are its fields'
 * functions one under the other, in the order of its fields - a column that stacks fields lists all
 * their functions. A group row has its name on a line of its own, the aggregates on the lines under it
 * (1 + n lines, n the most lines a column needs); the totals row has the n lines.
 *
 * Both rows show them the same way: a cell in the place of the field - the left, middle and right
 * sections side by side, as in the body. The middle section follows the horizontal scroll:
 * its cells are in an element moved by the css variable `--simple-html-grid-scroll-left`, which
 * {@link followMiddleScroll} sets on the group rows' view and on the totals row. Every aggregated field
 * of the middle has its cell, not only the ones on screen - there are few.
 */

/**
 * the class of the element the totals row is rendered in, made by createDom
 */
export const TOTALS_CLASS = 'simple-html-grid-totals';

/**
 * The functions of a field's `aggregate`: one or a list of them, as a list - each once, in a fixed
 * order (sum, avg, min, max, count), so a function turned on in the header menu always gets the same
 * line. Empty when it has none
 */
export function normalizeAggregates(value: AggregateFunction | readonly AggregateFunction[] | undefined): AggregateFunction[] {
    const list: readonly unknown[] = value === undefined ? [] : Array.isArray(value) ? value : [value];
    return AGGREGATE_FUNCTIONS.filter((fn) => list.includes(fn));
}

/**
 * The aggregate functions of a field, see normalizeAggregates
 */
export function aggregatesOf(config: ParsedGridConfig, field: string): AggregateFunction[] {
    return normalizeAggregates(config.columns[field]?.aggregate);
}

/**
 * An aggregate of a field of the layout, and where its line goes
 */
interface AggregatedField {
    field: string;
    fn: AggregateFunction;
    /** left of the column in its section, px */
    left: number;
    width: number;
    /** the line in its column: the column's fields' functions one under the other */
    line: number;
    /** the cell's aria-colindex: the field's */
    colIndex: number;
    /** the first function of its field: its line is the field's gridcell, the others are hidden from a screen reader */
    first: boolean;
    /** the field's label after the function's: when its column stacks fields, which field it is */
    fieldLabel: string;
}

/**
 * The aggregates of a section, left to right, a column's lines from the top
 * @param offset where the first column starts: after the grouping column in the left section
 */
function sectionFields(ctx: Grid, colType: ColType, columns: LayoutColumn[], offset: number): AggregatedField[] {
    const config = ctx.gridInterface.__getGridConfig();
    const fields: AggregatedField[] = [];
    let left = offset;
    columns.forEach((column, columnNo) => {
        let line = 0;
        column.fields.forEach((field, celno) => {
            aggregatesOf(config, field).forEach((fn, i) => {
                fields.push({
                    field,
                    fn,
                    left,
                    width: column.width,
                    line: line++,
                    colIndex: ariaColIndex(config, colType, columnNo, celno),
                    first: i === 0,
                    fieldLabel: column.fields.length > 1 ? getColumnLabel(ctx, field) : ''
                });
            });
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
        left: sectionFields(ctx, LEFT_PINNED_COLTYPE, config.layout.left, getGroupingWidth(ctx, LEFT_PINNED_COLTYPE)),
        middle: sectionFields(ctx, MIDDLE_PINNED_COLTYPE, config.layout.center, 0),
        right: sectionFields(ctx, RIGHT_PINNED_COLTYPE, config.layout.right, 0)
    };
}

/**
 * How many lines the aggregates of the layout need: the most a column needs, a line for every function
 * of every field in it. 0 when no field of the layout has one
 */
export function aggregateLines(config: ParsedGridConfig): number {
    let lines = 0;
    for (const column of [...config.layout.left, ...config.layout.center, ...config.layout.right]) {
        const columnLines = column.fields.reduce((sum, field) => sum + aggregatesOf(config, field).length, 0);
        lines = Math.max(lines, columnLines);
    }
    return lines;
}

/**
 * The height of a group row and of the totals row, for GridInterface.__parseConfig - in one place, as
 * the row heights are built from it. A group row with aggregates is its name's line and the lines of
 * the aggregates under it; without, one line. The totals row has the aggregates' lines, at least one;
 * 0 when it is not shown.
 *
 * Lines of text, as a taller cell has them (cellHeightOf): the first `cellHeight` px, each line under it
 * `multilineLineHeight` px - the user: "padding is a bit much when multiple aggregates". A whole
 * `cellHeight` per aggregate put the lines far apart, a group row with two was three rows high
 */
export function aggregateRowHeights(config: ParsedGridConfig): { group: number; totals: number } {
    const lines = aggregateLines(config);
    return {
        group: config.groupAggregates && lines ? cellHeightOf(config, 1 + lines) : config.cellHeight,
        totals: config.totalsRow ? cellHeightOf(config, Math.max(1, lines)) : 0
    };
}

/**
 * Where a line of text of a group row or the totals row is, in px from the top of the row: the first line
 * (a group row's name, the first aggregate of the totals row) is `cellHeight` high, the text in its
 * middle; each line under it is `multilineLineHeight` high, a text line apart - as the lines of a
 * taller cell (linesUnderTop)
 * @param line the line, 0 the first
 */
export function aggregateLineBox(
    config: Pick<ParsedGridConfig, 'cellHeight' | 'multilineLineHeight'>,
    line: number
): { top: number; height: number } {
    if (line === 0) {
        return { top: 0, height: config.cellHeight };
    }
    return { top: linesUnderTop(config) + (line - 1) * config.multilineLineHeight, height: config.multilineLineHeight };
}

/**
 * true when the group rows show the aggregates: `groupAggregates` is on and a field of the layout has one
 */
export function showsGroupAggregates(config: ParsedGridConfig): boolean {
    return config.groupAggregates && aggregateLines(config) > 0;
}

/**
 * An aggregate as text: `count` as a whole number, the others as the cells show a value - the field's
 * formatter, with the column's display format (`ColumnConfig.format`: `1 234,50`). '' for null, the
 * average (min, max) of no numbers
 */
function formatAggregate(ctx: Grid, field: string, fn: AggregateFunction, value: number | null): string {
    if (value === null) {
        return '';
    }
    if (fn === 'count') {
        return String(value);
    }
    return ctx.gridInterface.__getCellFormatter(field).format(value);
}

/**
 * The label of an aggregate: `Sum` (the text `aggregate.sum`), with the field's label after it when its
 * column stacks fields - which of them it is: `Avg Age`
 */
function aggregateLabel(ctx: Grid, aggregated: AggregatedField): string {
    const label = gridText(ctx, `aggregate.${aggregated.fn}`);
    return aggregated.fieldLabel ? `${label} ${aggregated.fieldLabel}` : label;
}

/**
 * The line of an aggregate: its label at the left and its value at the right of the field's column -
 * the labels line up, and so do the numbers. When the column is too narrow the label gives way first
 * (css). Empty when the value is null.
 *
 * For a screen reader the first line of a field is the field's gridcell, named with all its lines
 * (`ariaText`); the field's other lines are hidden from it, as are all of them when `hidden` - the
 * group row's name cell has their text then, see renderRowGroup
 * @param offset the lines above the aggregates: the group row's name
 */
function aggregateCell(
    ctx: Grid,
    aggregated: AggregatedField,
    value: number | null,
    offset: number,
    ariaText: string,
    hidden: boolean
) {
    const config = ctx.gridInterface.__getGridConfig();
    const text = formatAggregate(ctx, aggregated.field, aggregated.fn, value);
    const cell = aggregated.first && !hidden;
    const box = aggregateLineBox(config, offset + aggregated.line);
    return html`<div
        role=${cell ? 'gridcell' : 'none'}
        aria-colindex=${cell ? aggregated.colIndex : nothing}
        aria-label=${cell && ariaText ? ariaText : nothing}
        aria-hidden=${cell ? nothing : 'true'}
        class="simple-html-grid-aggregate"
        data-aggregate=${`${aggregated.fn}:${aggregated.field}`}
        style="left:${asPx(aggregated.left)};width:${asPx(aggregated.width)};top:${asPx(box.top)};height:${asPx(box.height)};line-height:${asPx(box.height)}"
    >
        ${
            text
                ? html`<span class="simple-html-grid-aggregate-label">${aggregateLabel(ctx, aggregated)}</span>
                      <span class="simple-html-grid-aggregate-value">${text}</span>`
                : nothing
        }
    </div>`;
}

/**
 * The text of a field's aggregates for a screen reader, `Sum 1234.5, Avg 12`: the name of its gridcell,
 * or of the group row's name cell (see renderRowGroup). '' when none has a value
 */
function fieldAriaText(
    ctx: Grid,
    all: AggregatedField[],
    field: string,
    valueFor: (field: string, fn: AggregateFunction) => number | null
): string {
    return all
        .filter((aggregated) => aggregated.field === field)
        .map((aggregated) => {
            const text = formatAggregate(ctx, aggregated.field, aggregated.fn, valueFor(aggregated.field, aggregated.fn));
            return text ? `${aggregateLabel(ctx, aggregated)} ${text}` : '';
        })
        .filter((text) => text)
        .join(', ');
}

/**
 * The cells of the aggregates of a row, in three sections with the places and the widths of the
 * body's sections: the left pinned columns, the middle (moved by the horizontal scroll) and the right
 * pinned columns. Fills the element it is put in, which starts where the left section starts
 * @param fields the aggregated fields, aggregatedFields()
 * @param valueFor the value of an aggregate in this row
 * @param offset the lines above the aggregates: 1 in a group row (its name), 0 in the totals row
 * @param hiddenColIndex the aria-colindex of a cell that is no gridcell, see aggregateCell
 */
function aggregateSections(
    ctx: Grid,
    fields: SectionFields,
    valueFor: (field: string, fn: AggregateFunction) => number | null,
    offset: number,
    hiddenColIndex: number | null
): TemplateResult {
    const config = ctx.gridInterface.__getGridConfig();
    const leftWidth = config.__leftWidth + getGroupingWidth(ctx, LEFT_PINNED_COLTYPE);
    const all = [...fields.left, ...fields.middle, ...fields.right];
    const cells = (list: AggregatedField[]) =>
        list.map((aggregated) =>
            aggregateCell(
                ctx,
                aggregated,
                valueFor(aggregated.field, aggregated.fn),
                offset,
                aggregated.first ? fieldAriaText(ctx, all, aggregated.field, valueFor) : '',
                aggregated.colIndex === hiddenColIndex
            )
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
 * The aggregates of a group row, for renderRowGroup: the cells, on the lines under the name, and for
 * the name cell the aggregates of the first field (aria-colindex 2) - the name cell is the gridcell of
 * that column for a screen reader, so it has their text. And the aria-colspan of the name cell: up to
 * the first aggregated field after it
 */
export function groupRowAggregates(ctx: Grid, valueFor: (field: string, fn: AggregateFunction) => number | null) {
    const fields = aggregatedFields(ctx);
    const all = [...fields.left, ...fields.middle, ...fields.right];
    const first = all.find((aggregated) => aggregated.colIndex === 2);
    const next = all.find((aggregated) => aggregated.colIndex > 2);
    return {
        sections: aggregateSections(ctx, fields, valueFor, 1, first ? 2 : null),
        nameText: first ? fieldAriaText(ctx, all, first.field, valueFor) : '',
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
                ${aggregateSections(ctx, aggregatedFields(ctx), (field, fn) => datasource.aggregate(field, fn), 0, null)}
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
