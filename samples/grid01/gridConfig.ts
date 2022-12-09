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
        },


    ],
    attributes: {
        isActive: {
            attribute: 'isActive',
            type: 'boolean',
         
        },
        phone: {
            attribute: 'phone',
            placeHolderRow: "wow",
            placeHolderFilter: "custom placeholder"

        },
        isDumb: {
            attribute: 'isDumb',
            type: 'boolean',
          
        },
        balance: {
            attribute: 'balance',
            type: 'number'
        },
        longitude: {
            attribute: 'longitude',
            type: 'number',
            readonly: true
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