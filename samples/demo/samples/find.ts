// Find in the grid: Ctrl+F with the focus in the grid, or find(), findNext() and the find-change event from
// code. "Filter rows" in the bar (or find(text, { filterRows: true })) shows only the rows with a match
import type { GridConfig } from '@simple-html/grid';
import { createStage, type DemoSample, mountGrid } from '../demoUtils';

export const find: DemoSample = {
    id: 'find',
    title: 'Find (Ctrl+F)',
    group: 'Datasource',
    description:
        "Click a cell and press Ctrl+F (Cmd+F on a Mac): a find bar opens over the top right corner of the grid. Type, and every cell that shows the text is marked, the current one more - the text as the cell shows it (a date as 2026-03-14, a balance as 1234.56), in any case. Enter or F3 goes to the next match, Shift+Enter or Shift+F3 to the previous one, wrapping at the ends; the grid scrolls to it, across the pinned columns. Esc closes the bar and puts the focus in the cell of the current match. The funnel button, Filter rows, shows only the rows with a match - on top of the filter, with a chip in the footer; the footer's Clear or closing the bar shows every row again. While it is open it follows the data: filter, sort or edit and the matches are found again. Ctrl+F outside the grid is the browser's own.",
    run(stage) {
        const ui = createStage(stage);
        const config: GridConfig = {
            panelHeight: 25,
            readonly: false,
            layout: {
                left: [{ fields: ['company'], width: 160 }],
                center: [
                    { fields: ['country'], width: 110 },
                    { fields: ['age'], width: 70 },
                    { fields: ['balance'], width: 110 },
                    { fields: ['date1'], width: 110 },
                    { fields: ['isActive'], width: 70 },
                    { fields: ['favoriteFruit'], width: 110 }
                ],
                right: [{ fields: ['phone'], width: 140 }]
            }
        };
        const { gridInterface } = mountGrid(ui.gridHost, config);

        // what the find has found: sent when the bar opens or closes, the typing stops, the current match moves
        ui.log('press Ctrl+F in the grid, or a button');
        gridInterface.on('find-change', ({ open, text, count, position, current, filterRows }) => {
            if (!open) {
                ui.log('find-change: closed');
                return;
            }
            const where = current ? `, the current is row ${current.row}, ${current.field}` : '';
            const rows = filterRows ? ', only the rows with a match' : '';
            ui.log(`find-change: "${text}" ${count ? `${position} of ${count}` : 'no matches'}${where}${rows}`);
        });

        ui.button('Find "norway"', () => ui.log(`find('norway'): ${gridInterface.find('norway')} cells`));
        ui.button('Find "2026-03"', () => ui.log(`find('2026-03'): ${gridInterface.find('2026-03')} cells`));
        // as the funnel button of the bar: only the rows with a match, on top of the filter
        ui.button('Filter rows: "norway"', () => gridInterface.find('norway', { filterRows: true }));
        ui.button('Next', () => gridInterface.findNext());
        ui.button('Previous', () => gridInterface.findPrevious());
        // as Ctrl+F: the focus goes into the bar - for a button or a menu entry of your own
        ui.button('Open the find bar', () => gridInterface.openFind());
        ui.button('Close', () => gridInterface.closeFind());
    }
};
