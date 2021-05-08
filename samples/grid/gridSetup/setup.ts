import { GridConfig } from '@simple-html/grid';

export function setup(rows: number, columns: number, scroll?: number) {
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

export const largeStaticConfig: GridConfig = {
    cellHeight: 20,
    panelHeight: 25,
    footerHeight: 40,
    readonly: true,
    selectionMode: 'multiple',
    groups: [
        {
            width: 50,
            rows: [
                {
                    header: '0',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 120,
            rows: [
                {
                    header: '1',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 50,
            rows: [
                {
                    header: '2',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 50,
            rows: [
                {
                    header: '3',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 50,
            rows: [
                {
                    header: '4',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '5',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '6',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 75,
            rows: [
                {
                    header: '7',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 84,
            rows: [
                {
                    header: '8',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 95,
            rows: [
                {
                    header: '9',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 50,
            rows: [
                {
                    header: '10',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 50,
            rows: [
                {
                    header: '11',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 50,
            rows: [
                {
                    header: '12',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 50,
            rows: [
                {
                    header: '13',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 50,
            rows: [
                {
                    header: '14',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 50,
            rows: [
                {
                    header: '15',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '16',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '17',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '18',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '19',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '20',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '21',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '22',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '23',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '24',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '25',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '26',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },

        {
            width: 80,
            rows: [
                {
                    header: '27',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '28',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '29',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },

        {
            width: 80,
            rows: [
                {
                    header: '30',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '31',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '32',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '33',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '34',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '35',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '36',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '37',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '38',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        },
        {
            width: 80,
            rows: [
                {
                    header: '39',
                    attribute: 'word1',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word2',
                    attribute: 'word2',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word3',
                    attribute: 'word3',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'word4',
                    attribute: 'word4',
                    type: 'text',
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                }
            ]
        }
    ]
};
