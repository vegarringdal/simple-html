import { IGridConfig } from '@simple-html/grid';

export function setup(rows: number, columns: number, scroll?: number) {
    if (localStorage.getItem('columns2' + columns)) {
        const x = JSON.parse(localStorage.getItem('columns2' + columns));
        return x;
    }

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
                        //readonly: true,
                        type: 'number',
                        filterable: {},
                        sortable: {}
                    });
                } else {
                    x.push({
                        header: 'word' + word,
                        attribute: 'word' + word,
                        filterable: {},
                        sortable: {},
                        //readonly: true,
                        allowGrouping: true
                    });
                }
            } else {
                x.push({
                    header: 'word' + word,
                    attribute: 'word' + word,
                    filterable: {},
                    sortable: {},
                    //readonly: true,
                    allowGrouping: true
                });
            }
        }

        setup.groups.push({ width: Math.floor(Math.random() * 100) + 100, rows: x });
    }

    localStorage.setItem('columns2' + columns, JSON.stringify(setup));
    return setup;
}
