import type { FieldConfig, FieldType, GridConfig } from '@simple-html/grid';

/**
 * the fields of the dummy data that are not text, for the datasource. The grid takes the
 * column types from the datasource
 */
export const gridFields: Record<string, FieldType | FieldConfig> = {
    isActive: 'boolean',
    isDumb: 'boolean',
    balance: 'number',
    longitude: 'number',
    latitude: 'number',
    age: 'number',
    index: 'number',
    date1: 'date',
    date2: { type: 'date', label: 'date 2' }
};

/**
 * simple gridconfig
 * keep this in own file since it so big..
 */
export const gridConfig: GridConfig = {
    panelHeight: 25,
    /**
     * built in tooltip, default true.
     * data-tooltip is written to the elements either way, so you can turn this off and
     * use your own tooltip library instead
     */
    tooltips: true,
    /**
     * override any of the built in tooltip texts, import TOOLTIPS to see the ids
     */
    tooltipText: {
        // 'filterEditor.addCondition': 'Legg til betingelse'
    },
    /*   cellHeaderLabelHeight: 40, */
    /*  selectSizeHeight: 0, */
    hideLabels: false,
    hideFilter: false,
    /**
     * the options of a column, by field name. A field in the layout without an entry gets the
     * defaults
     */
    columns: {
        __rowState: {
            // N = new, D = deleted, M=modified
            label: 'RS',
            readonly: true
        },
        dynamicData: {
            dynamicCellTypeColumn: 'dynamicDataType'
        },
        phone: {
            placeholderRow: 'wow',
            focusButton: 'SHOW_IF_GRID_AND_CELL_NOT_READONLY'
        },
        company: {
            placeholderRow: 'company',
            label: 'my Company name',
            focusButton: 'SHOW_IF_GRID_NOT_READONLY'
        },
        country: {
            placeholderRow: 'country',
            mandatory: true
        },
        favoriteFruit: {
            placeholderRow: 'favoriteFruit',
            mandatory: true
        },
        balance: {
            readonly: true
        },
        picture: {
            readonly: false,
            allowPasteClearOnly: true
        },
        longitude: {
            numberOverride: 'ZERO_TO_BLANK'
        },
        latitude: {
            numberOverride: 'BLANK_TO_ZERO'
        },
        // not in the layout: the column chooser can add it
        index: {
            focusButton: 'ALWAYS'
        },
        date2: {
            placeholderFilter: 'YYYY-MM-DD' // if you want to force
        }
    },
    layout: {
        /* left: [
            {
                fields: ['company','country'],
                width: 200
            },
            {
                fields: ['phone', 'date1'],
                width: 300
            },
        ],  */
        /*  right: [
            {
                fields: ['company','country'],
                width: 200
            },
            {
                fields: ['phone', 'date1'],
                width: 300
            },
        ],   */
        center: [
            {
                // you almost need to include this now
                // N = new, D = deleted, M=modified
                fields: ['__rowState'],
                width: 20
            },
            {
                fields: ['company', 'country'],
                width: 200
            },
            {
                fields: ['latitude'],
                width: 100
            },
            {
                fields: ['age'],
                width: 100
            },
            {
                fields: ['longitude'],
                width: 100
            },
            {
                fields: ['phone', 'date1'],
                width: 300
            },
            {
                fields: ['dynamicData'],
                width: 80
            },
            {
                fields: ['date1'],
                width: 80
            },

            {
                fields: ['isDumb'],
                width: 80
            },

            {
                fields: ['favoriteFruit'],
                width: 100
            },
            {
                fields: ['country'],
                width: 100
            },
            {
                fields: ['balance'],
                width: 100
            },

            {
                fields: ['tags'],
                width: 250
            },
            {
                fields: ['isActive'],
                width: 80
            },

            {
                fields: ['picture'],
                width: 300
            },
            {
                fields: ['company'],
                width: 200
            },
            {
                fields: ['phone'],
                width: 300
            },

            {
                fields: ['date2'],
                width: 100
            }
        ]
    },
    /**
     * the state the grid starts in, and resetState() goes back to
     */
    initialState: {
        sorting: [
            {
                attribute: 'firstname',
                ascending: true
            }
        ]
    }
};
