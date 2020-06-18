import { IGridConfig } from '@simple-html/grid';

export function setup(rows: number, columns: number, scroll?: number) {
    const setup: IGridConfig = {
        cellHeight: 20,
        panelHeight: 25,
        footerHeight: 40,
        selectionMode: 'multiple',
        lastScrollTop: scroll,
        groups: []
    };

    let word = 0;
    for (let i = 1; i < columns; i++) {
        const x: any = [];
        for (let y = 0; y < rows; y++) {
            word++;

            if ((i === 1 && y === 0) || (i === 2 && y === 0) || (i === 2 && y === 1)) {
                if (i === 1 && y === 0) {
                    x.push({
                        header: 'index',
                        attribute: 'index',
                        type: 'number',
                        filterable: {},
                        sortable: {}
                    });
                } else {
                    x.push({
                        header: 'date',
                        attribute: 'date',
                        type: 'date',
                        filterable: {},
                        sortable: {}
                    });
                    x.push({
                        header: 'superman',
                        attribute: 'superman',
                        type: 'text',
                        filterable: {},
                        sortable: {}
                    });
                }
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
