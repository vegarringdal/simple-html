import { IGridConfig } from '@simple-html/grid';
import { ICell } from '@simple-html/grid/src/interfaces';

export const COL_SETUP: IGridConfig = {
    cellHeight: 20,
    panelHeight: 25,
    footerHeight: 20,
    selectionMode:'multiple',

    groups:[
        {
            width: 100,
            rows:[
                {
                    header: 'index',
                    attribute: 'index',
                    type: 'number',
                    width: 120,
                    //filterable: {},
                    sortable: {}
                },
                {
                    header: 'First',
                    attribute: 'first',
                    width: 500,
                    filterable: {placeholder:'wow'},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'Bool',
                    attribute: 'bool',
                    width: 100,
                    type: 'boolean',
                    filterable: {},
                    //sortable: {}
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
        },{
            width: 100,
            rows:[
                {
                    header: 'date',
                    attribute: 'date',
                    type: 'date',
                    width: 120,
                    filterable: {},
                    sortable: {}
                },
            
                {
                    header: 'Number',
                    attribute: 'number',
                    type: 'number',
                    renderRowCallBackFn:(cell: ICell)=>{
                        return cell.attribute
                    },
                    renderLabelCallBackFn:()=>{
                        return 'my label'
                    },
                    renderFilterCallBackFn:()=>{
                        return 'filter'
                    },
                    width: 100,
                    filterable: {},
                    sortable: {}
                }
                
            ]
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
                {
                    header: 'index',
                    attribute: 'index',
                    type: 'number',
                    width: 120,
                    filterable: {},
                    sortable: {}
                }
                
            ]
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
                },
                {
                    header: 'Bool',
                    attribute: 'bool',
                    width: 100,
                    type: 'boolean',
                    filterable: {},
                    sortable: {}
                }
                
            ]
        }, {
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        }, {
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        },{
            width: 100,
            rows:[
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
                    width: 500,
                    filterable: {},
                    sortable: {},
                    allowGrouping: true
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
        }
    ],
    
    

};

