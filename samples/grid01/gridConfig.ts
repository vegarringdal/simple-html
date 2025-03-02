import { GridConfig } from '@simple-html/grid';

/**
 * simple gridconfig
 * keep this in own file since it so big..
 */
export const gridConfig: GridConfig = {
    panelHeight: 25,
    /*   cellHeaderLabelHeight: 40, */
    /*  selectSizeHeight: 0, */
    hideLabels: false,
    hideFilter: false,
    /* columnsPinnedLeft: [
        {
            rows: ['company','country'],
            width: 200
        },
        {
            rows: ['phone', 'date1'],
            width: 300
        },
    ],  */
    /*  columnsPinnedRight: [
        {
            rows: ['company','country'],
            width: 200
        },
        {
            rows: ['phone', 'date1'],
            width: 300
        },
    ],   */
    columnsCenter: [
        {
            // you almost need to include this now
            // N = new, D = deleted, M=modified
            rows: ['__rowState'], 
            
            width: 100
        },
        {
            rows: ['company', 'country'],
            width: 200
        },
        {
            rows: ['latitude'],
            width: 100
        },
        {
            rows: ['age'],
            width: 100
        },
        {
            rows: ['longitude'],
            width: 100
        },
        {
            rows: ['phone', 'date1'],
            width: 300
        },
        {
            rows: ['dynamicData'],
            width: 80
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
            attribute:'__rowState', // N = new, D = deleted, M=modified
            label: "RS"
        },
        {
            attribute: 'isActive',
            type: 'boolean'
        },
        {
            attribute: 'dynamicData',
            type: 'text',
            dynamicCellTypeColumn: 'dynamicDataType'
        },
        {
            attribute: 'phone',
            placeHolderRow: 'wow',
            focusButton: 'SHOW_IF_GRID_AND_CELL_NOT_READONLY'
        },
        {
            attribute: 'company',
            placeHolderRow: 'company',
            label: 'my Company name',
            focusButton: 'SHOW_IF_GRID_NOT_READONLY'
        },
        {
            attribute: 'country',
            placeHolderRow: 'country',
            mandatory: true,
            mandatoryOnlyIfEmpty: true
        },
        {
            attribute: 'favoriteFruit',
            placeHolderRow: 'favoriteFruit',
            mandatory: true
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
            attribute: 'picture',

            readonly: false,
            allowPasteClearOnly: true
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
            type: 'number',
            focusButton: 'ALWAYS'
        },
        {
            attribute: 'date1',
            type: 'date'
        },
        {
            attribute: 'date2',
            type: 'date',
            placeHolderFilter: 'YYYY-MM-DD' // if you want to force
        }
    ],
    sorting: [
        {
            attribute: 'firstname',
            ascending: true
        }
    ]
};
