import { GridConfig } from '@simple-html/grid';

/**
 * simple gridconfig
 * keep this in own file since it so big..
 */
export const gridConfig: GridConfig = {
    columnsCenter: [
        {
            rows: ['company'],
            width: 200
        },
        {
            rows: ['phone'],
            width: 300
        },

        {
            rows: ['date1'],
            width: 80
        },

        {
            rows: ['isDumb'],
            width: 80
        },

        {
            rows: ['favoriteFruit'],
            width: 100
        },
        {
            rows: ['country'],
            width: 100
        },
        {
            rows: ['balance'],
            width: 100
        },
        {
            rows: ['latitude'],
            width: 100
        },
        {
            rows: ['longitude'],
            width: 100
        },
        {
            rows: ['tags'],
            width: 250
        },
        {
            rows: ['isActive'],
            width: 80
        },

        {
            rows: ['picture'],
            width: 300
        },
        {
            rows: ['company'],
            width: 200
        },
        {
            rows: ['phone'],
            width: 300
        },

        {
            rows: ['date2'],
            width: 100
        }
    ],
    attributes: [
        {
            attribute: 'isActive',
            type: 'boolean'
        },
        {
            attribute: 'phone',
            placeHolderRow: 'wow',
            focusButton: "SHOW_IF_GRID_NOT_READONLY_AND_CELL_NOT_READONLY"
        },
        {
            attribute: 'company',
            placeHolderRow: 'company',
            focusButton: "SHOW_IF_GRID_NOT_READONLY"
        },
        {
            attribute: 'country',
            placeHolderRow: 'country'
        },
        {
            attribute: 'isDumb',
            type: 'boolean'
        },
        {
            attribute: 'balance',
            type: 'number',
            readonly: true
        },
        {
            attribute: 'longitude',
            type: 'number',
            numberOverride: 'ZERO_TO_BLANK'
        },
        {
            attribute: 'latitude',
            type: 'number',
            numberOverride: 'BLANK_TO_ZERO'
        },
        {
            attribute: 'age',
            type: 'number'
        },
        {
            attribute: 'index',
            type: 'number'
        },
        {
            attribute: 'date1',
            type: 'date',
            placeHolderFilter: 'YYYY-MM-DD',
            focusButton:"ALWAYS"
        },
        {
            attribute: 'date2',
            type: 'date',
            placeHolderFilter: 'YYYY-MM-DD'
        }
    ],
    sorting: [
        {
            attribute: 'firstname',
            ascending: true
        }
    ]
};
