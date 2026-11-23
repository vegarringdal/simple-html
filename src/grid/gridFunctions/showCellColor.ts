import type { Entity } from '../../datasource/entity';
import { COLOR_RULE_CLASSES, COLOR_RULE_PROPERTIES, colorRuleClasses, colorRuleOf, colorRuleStyle } from '../colorRules';
import { cellFillOf, FILL_CLASSES, FILL_PROPERTIES, NO_FILL, shownRange } from '../dataBars';
import type { Grid } from '../grid';

/** every class showCellColor sets or takes off */
const CLASSES = [...COLOR_RULE_CLASSES, ...FILL_CLASSES];

/** every custom property showCellColor sets or takes off */
const PROPERTIES = [...COLOR_RULE_PROPERTIES, ...FILL_PROPERTIES];

/**
 * Shows the colour rule of a row cell (`ColumnFormat.rules`, colorRules.ts): the classes of the first
 * rule that matches the cell's value on the cell element - its text colour, its background, bold - or
 * none. grid.css colours the cell from them: the background is the cell's, its text (the input, the
 * lines of a multiline cell, a custom cell, a link) takes the cell's colour.
 *
 * And the data bar and the colour of the colour scale of a number column (`ColumnFormat.bar`, `scale`,
 * dataBars.ts): a class and custom properties each - where the bar starts and ends, its colour, the two
 * colours of the scale and how far between them. A rule's background wins over the scale; a bar is drawn
 * over it. The range is the datasource's min and max of the rows the filter lets through, which it keeps
 * until they change: asked here for every cell, read once.
 *
 * Set on the cell element itself, outside of its lit template, as the errors (showCellErrors): an edit
 * calls this while the user types - the colour follows the value - and the grid reuses the cell
 * elements while scrolling, so every render of a cell calls it too: a cell of another row loses the
 * classes of the one it showed before. A custom colour (`#rrggbb`, ruleColors.ts) is a custom property of
 * the cell, set with `style.setProperty()` - the value checked, never css text - and taken off as the
 * classes are.
 * @param entity the cell's row, null for a cell without a row (a group row) or a field
 * @param attribute the cell's field, null for a cell without one
 */
export function showCellColor(ctx: Grid, cell: HTMLElement, entity: Entity | null, attribute: string | null) {
    const gridInterface = ctx.gridInterface;
    const rule = entity && attribute ? colorRuleOf(gridInterface, attribute, entity) : null;
    const fill =
        entity && attribute
            ? cellFillOf(entity[attribute], gridInterface.__getGridConfig().columns[attribute]?.format, rule, () =>
                  shownRange(gridInterface.getDatasource(), attribute)
              )
            : NO_FILL;
    const classes = new Set([...colorRuleClasses(rule), ...fill.classes]);
    for (const name of CLASSES) {
        cell.classList.toggle(name, classes.has(name));
    }
    const style = { ...colorRuleStyle(rule), ...fill.style };
    for (const name of PROPERTIES) {
        if (Object.hasOwn(style, name)) {
            cell.style.setProperty(name, style[name]);
        } else {
            cell.style.removeProperty(name);
        }
    }
}
