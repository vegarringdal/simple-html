import type { GridInterface } from '../gridInterface';

/**
 * gets all attributes displayed
 * Only needs the interface, so it also works before the grid is connected
 * @param filterSelectedColumns - by default filters out selected
 * @returns
 */
export function getAttributeColumns(gridInterface: GridInterface<any>, filterSelectedColumns = true) {
    const colLeft = gridInterface.__getGridConfig().layout.left.map((e) => e.fields);
    const colCenter = gridInterface.__getGridConfig().layout.center.map((e) => e.fields);
    const colRight = gridInterface.__getGridConfig().layout.right.map((e) => e.fields);
    const allAttributes = colLeft.concat(colCenter).concat(colRight);

    const attributes: string[] = [];

    if (filterSelectedColumns && gridInterface.__selectedColumns()) {
        allAttributes.forEach((names, i) => {
            if (gridInterface.__isColumnSelected(i + 1)) {
                if (Array.isArray(names)) {
                    names.forEach((n) => {
                        attributes.push(n);
                    });
                }
            }
        });
    } else {
        allAttributes.forEach((names) => {
            if (Array.isArray(names)) {
                names.forEach((n) => {
                    attributes.push(n);
                });
            }
        });
    }

    return attributes;
}
