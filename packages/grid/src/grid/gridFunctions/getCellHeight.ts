import { Columns } from '../gridConfig';

/**
 * small helper to get cell heigth by looping column config
 * @param columns
 * @param currentSize
 * @returns
 */
export function getCellHeight(columns: Columns[] | undefined, currentSize: number) {
    let size = currentSize || 1;
    if (Array.isArray(columns)) {
        columns.forEach((g) => {
            if (g.rows.length > size) {
                size = g.rows.length;
            }
        });
    }
    return size;
}
