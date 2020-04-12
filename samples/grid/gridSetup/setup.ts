import { IGridConfig } from '@simple-html/grid';

export function setup(rows: number, columns: number) {
    const setup: IGridConfig = {
        cellHeight: 20,
        panelHeight: 25,
        footerHeight: 20,
        selectionMode: 'multiple',
        groups: []
    };

    let word = 0;
    for (let i = 1; i < columns; i++) {
        const x: any = [];
        for (let y = 0; y < rows; y++) {
            word++;

            if (i === 1 && y === 0) {
                x.push({
                    header: 'index',
                    attribute: 'index',
                    filterable: {},
                    sortable: {}
                });
            } else {
                x.push({
                    header: 'word' + word,
                    attribute: 'word' + word,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                });
            }
        }
        const x4 = Math.floor(Math.random() * 150) + 75;
        setup.groups.push({ width: x4, rows: x });
    }
    return setup;
}