import type { GridInterface } from '../gridInterface';

/**
 * The fields in the layout, left to right (pinned left, center, pinned right), top to bottom within
 * a column. Only needs the interface, so it also works before the grid is connected.
 * @param options.selectedOnly only the fields of the columns the user selected, none when no column is
 */
export function getLayoutFields(gridInterface: GridInterface<any>, options: { selectedOnly?: boolean } = {}): string[] {
    const layout = gridInterface.__getGridConfig().layout;
    const columns = [...layout.left, ...layout.center, ...layout.right];

    const fields: string[] = [];
    columns.forEach((column, i) => {
        // the column selector numbers the columns from 1, across left, center and right
        if (!options.selectedOnly || gridInterface.__isColumnSelected(i + 1)) {
            fields.push(...column.fields);
        }
    });
    return fields;
}
