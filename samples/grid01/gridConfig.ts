import { GridConfig } from '@simple-html/grid';

/**
 * simple gridconfig
 * keep this in own file since it so big..
 */
export const gridConfig: GridConfig = {
    cellHeight: 22,
    panelHeight: 25,
    footerHeight: 45,
    selectSizeHeight: 18,
    readonly: true,
    selectionMode: 'multiple',
 /*    columnsPinnedLeft: [
        {
            rows: ['id'],
            width: 180
        },
        {
            rows: ['isActive'],
            width: 100
        },
        {
            rows: ['balance'],
            width: 100
        }
    ], */
  /*   columnsPinnedRight: [
        {
            rows: ['index'],
            width: 100
        },
        {
            rows: ['gender'],
            width: 100
        }
    ], */
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
            rows: ['favoriteFruit'],
            width: 100
        },
        {
            rows: ['country'],
            width: 100
        },

        {
            rows: ['about'],
            width: 100
        },

        {
            rows: ['tags'],
            width: 250
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
            rows: ['date1'],
            width: 100
        },

        {
            rows: ['favoriteFruit'],
            width: 100
        },

        {
            rows: ['about'],
            width: 100
        },

        {
            rows: ['tags'],
            width: 250
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
            rows: ['date1'],
            width: 150
        },

        {
            rows: ['favoriteFruit'],
            width: 100
        },

        {
            rows: ['about'],
            width: 100
        },

        {
            rows: ['tags'],
            width: 250
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
            rows: ['date1'],
            width: 100
        },

        {
            rows: ['favoriteFruit'],
            width: 100
        },

        {
            rows: ['about'],
            width: 100
        },

        {
            rows: ['tags'],
            width: 250
        },

        {
            rows: ['picture'],
            width: 300
        }
    ],
    attributes: {
        firstnamea: {
            attribute: 'firstnamea',
            readonly: true
        },
        isActive: {
            attribute: 'isActive',
            type: 'boolean',
            readonly: true
        },
        isDumb: {
            attribute: 'isDumb',
            type: 'boolean',
            readonly: true
        },
        balance: {
            attribute: 'balance',
            type: 'number'
        },
        longitude: {
            attribute: 'longitude',
            type: 'number'
        },
        age: {
            attribute: 'age',
            type: 'number'
        },
        index: {
            attribute: 'index',
            type: 'number'
        },
        date1: {
            attribute: 'date1',
            type: 'date'
        },
        date2: {
            attribute: 'date2',
            type: 'date'
        }
    },
    sortOrder: [
        {
            attribute: 'firstname',
            ascending: true
        }
    ]
};