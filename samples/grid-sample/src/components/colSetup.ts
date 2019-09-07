import { IGridConfig } from '@simple-html/grid';

export const COL_SETUP: IGridConfig = {
    rowHeight: 25,
    panelHeight: 25,
    headerHeight: 50,
    footerHeight: 25,
    /* sortingSet: [
        {
            attribute: 'last',
            asc: true,
            no: 1
        },
        {
            attribute: 'first',
            asc: true,
            no: 2
        },
        {
            attribute: 'index',
            asc: true,
            no: 3
        }
    ],
    groupingSet: [{ title: 'Last', field: 'last' }, { title: 'First', field: 'first' }],
    groupingExpanded: ['Barton', 'Barton-Aida'], */

    selectionMode: 'multiple',
    columns: [
        {
            header: 'index',
            attribute: 'index',
            type: 'number',
            width: 120,
            filterable: {},
            sortable: {}
        },
        {
            header: 'First',
            attribute: 'first',
            width: 100,
            filterable: {},
            sortable: {},
            allowGrouping: true
        },
        {
            header: 'Last',
            attribute: 'last',
            type: 'text',
            width: 100,
            filterable: {},
            sortable: {},
            allowGrouping: true
        },
        {
            header: 'Dates',
            attribute: 'date',
            type: 'date',
            width: 150,
            filterable: {},
            sortable: {}
        },
        {
            header: 'Bool',
            attribute: 'bool',
            width: 100,
            type: 'boolean',
            filterable: {},
            sortable: {}
        },
        {
            header: 'Number',
            attribute: 'number',
            type: 'number',
            width: 100,
            filterable: {},
            sortable: {}
        }
    ]
};
