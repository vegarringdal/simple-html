import { SimpleHtmlGrid, GridInterface } from '..';
import { SimpleHtmlGridBody } from './simple-html-grid-body';

let check = '';

export function updateColCache(
    ref: SimpleHtmlGrid,
    connector: GridInterface,
    scrollDirection: string,
    force?: boolean
) {
    const node = ref.getElementsByTagName('simple-html-grid-body')[0] as SimpleHtmlGridBody;
    const width = node.clientWidth;
    const left = node.scrollLeft;

    const groups = connector.config.groups;
    ref.colCache.forEach((col) => {
        const g = groups[col.i];
        const c1 = g.__left + g.width < left;

        const c2 = g.__left > left + width;
        if (c1 && scrollDirection === 'right') {
            const newIndex = ref.colCache[ref.colCache.length - 1].i + 1;
            if (newIndex <= groups.length - 1) {
                col.i = newIndex;
                col.update = true;
            }
            ref.colCache.sort((a, b) => (a.i < b.i ? -1 : 1));
        }

        if (c2 && scrollDirection === 'left') {
            const newIndex = ref.colCache[0].i - 1;
            if (newIndex > -1) {
                col.i = newIndex;
                col.update = true;
            }
            ref.colCache.sort((a, b) => (a.i < b.i ? -1 : 1));
        }
    });

    if (ref.colCache.map((e) => e.i).join(',') !== check) {
        check = ref.colCache.map((e) => e.i).join(',');
        /*  console.log(check); */

        node.rows.forEach((row) => {
            row.updateCols2(force);
        });
        ref.colCache.forEach((e) => (e.update = false));
    }
}
