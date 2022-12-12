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
            placeHolderFilter: 'custom placeholder'
        },
        {
            attribute: 'isDumb',
            type: 'boolean'
        },
        {
            attribute: 'balance',
            type: 'number'
        },
        {
            attribute: 'longitude',
            type: 'number',
            readonly: true
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
            attribute: 'dates1',
            type: 'date'
        },
        {
            attribute: 'date2',
            type: 'date'
        }
    ],
    sorting: [
        {
            attribute: 'firstname',
            ascending: true
        }
    ]
};
