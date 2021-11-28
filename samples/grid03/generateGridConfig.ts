import { GridConfig } from '@simple-html/grid';

export function generateGridConfig(rows: number, columns: number, scroll?: number) {
    const setup: GridConfig = {
        cellHeight: 20,
        panelHeight: 25,
        footerHeight: 40,
        readonly: true,
        selectionMode: 'multiple',
        lastScrollTop: scroll,
        groups: []
    };

    let word = 0;
    for (let i = 1; i < columns; i++) {
        const x: any = [];
        for (let y = 0; y < rows; y++) {
            word++;

            if ((i === 1 && y === 0) || (i === 3 && y === 0) || (i === 2 && y === 0)) {
                if (i === 1 && y === 0) {
                    x.push({
                        header: 'index',
                        attribute: 'index',
                        readonly: true,
                        type: 'number',
                        filterable: {},
                        focusButton: true,
                        focusButtonIfGridReadonly: false,
                        sortable: {},
                        allowGrouping: true
                    });
                }
                if (i === 2 && y === 0) {
                    x.push({
                        header: 'date',
                        attribute: 'date',
                        //readonly: true,
                        type: 'date',
                        filterable: {},
                        sortable: {},
                        allowGrouping: true
                    });
                }
                if (i === 3 && y === 0) {
                    x.push({
                        header: 'bool',
                        attribute: 'bool',
                        //readonly: true,
                        type: 'boolean',
                        filterable: {},
                        sortable: {},
                        allowGrouping: true
                    });
                }
            } else {
                x.push({
                    header: 'word' + word,
                    attribute: 'word' + word,
                    placeholder: 'word' + word,
                    filterable: {},
                    sortable: {},
                    //readonly: true,
                    allowGrouping: true
                });
            }
        }

        setup.groups.push({ width: Math.floor(Math.random() * 100) + 50, rows: x });
    }

    localStorage.setItem('columns2' + columns, JSON.stringify(setup));
    return setup;
}