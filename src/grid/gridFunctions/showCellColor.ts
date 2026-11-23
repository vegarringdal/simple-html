import type { Entity } from '../../datasource/entity';
import { COLOR_RULE_CLASSES, COLOR_RULE_PROPERTIES, colorRuleClasses, colorRuleOf, colorRuleStyle } from '../colorRules';
import type { Grid } from '../grid';

/**
 * Shows the colour rule of a row cell (`ColumnFormat.rules`, colorRules.ts): the classes of the first
 * rule that matches the cell's value on the cell element - its text colour, its background, bold - or
 * none. grid.css colours the cell from them: the background is the cell's, its text (the input, the
 * lines of a multiline cell, a custom cell, a link) takes the cell's colour.
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
    const rule = entity && attribute ? colorRuleOf(ctx.gridInterface, attribute, entity) : null;
    const classes = new Set(colorRuleClasses(rule));
    for (const name of COLOR_RULE_CLASSES) {
        cell.classList.toggle(name, classes.has(name));
    }
    const style = colorRuleStyle(rule);
    for (const name of COLOR_RULE_PROPERTIES) {
        if (Object.hasOwn(style, name)) {
            cell.style.setProperty(name, style[name]);
        } else {
            cell.style.removeProperty(name);
        }
    }
}
