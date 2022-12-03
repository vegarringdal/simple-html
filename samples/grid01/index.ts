import './index.css';
import { Datasource } from '@simple-html/datasource';
import { GridInterface, GridConfig, GridElement } from '@simple-html/grid';
import '../../packages/grid/src/grid.css';
import { dummydata } from './dummyData';

/**
 * WARNING, this will be weird while I get main parts working
 */

/**
 * simple gridconfig
 */
const gridConfig: GridConfig = {
    cellHeight: 20,
    panelHeight: 25,
    footerHeight: 45,
    selectSizeHeight: 20,
    readonly: true,
    selectionMode: 'multiple',
    columnsPinnedLeft: [
        {
            rows: ['id', 'name'],
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
    ],
    columnsPinnedRight: [
        {
            rows: ['index', 'eyeColor'],
            width: 100
        },
        {
            rows: ['gender', 'isDumb'],
            width: 100
        }
    ],
    columnsCenter: [
        {
            rows: ['company', 'email'],
            width: 200
        },
        {
            rows: ['phone', 'address'],
            width: 300
        },
        
        {
            rows: ['date1', 'date2'],
            width: 80
        },
        
        {
            rows: ['favoriteFruit', 'longitude'],
            width: 100
        },
        {
            rows: ['country', 'registered'],
            width: 100
        },
        
        {
            rows: ['about', 'age'],
            width: 100
        },
        
        {
            rows: ['tags', 'greeting'],
            width: 250
        },
        
        {
            rows: ['picture', 'age'],
            width: 300
        },
        {
            rows: ['company', 'email'],
            width: 200
        },
        {
            rows: ['phone', 'address'],
            width: 300
        },
        
        {
            rows: ['date1', 'date2'],
            width: 100
        },
        
        {
            rows: ['favoriteFruit', 'longitude'],
            width: 100
        },
        
        {
            rows: ['about', 'age'],
            width: 100
        },
        
        {
            rows: ['tags', 'greeting'],
            width: 250
        },
        
        {
            rows: ['picture', 'age'],
            width: 300
        },{
            rows: ['company', 'email'],
            width: 200
        },
        {
            rows: ['phone', 'address'],
            width: 300
        },
        
        {
            rows: ['date1', 'date2'],
            width: 150
        },
        
        {
            rows: ['favoriteFruit', 'longitude'],
            width: 100
        },
        
        {
            rows: ['about', 'age'],
            width: 100
        },
        
        {
            rows: ['tags', 'greeting'],
            width: 250
        },
        
        {
            rows: ['picture', 'age'],
            width: 300
        },
        {
            rows: ['company', 'email'],
            width: 200
        },
        {
            rows: ['phone', 'address'],
            width: 300
        },
        
        {
            rows: ['date1', 'date2'],
            width: 100
        },
        
        {
            rows: ['favoriteFruit', 'longitude'],
            width: 100
        },
        
        {
            rows: ['about', 'age'],
            width: 100
        },
        
        {
            rows: ['tags', 'greeting'],
            width: 250
        },
        
        {
            rows: ['picture', 'age'],
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
            readonly: false
        },
        parents: {
            attribute: 'parents',
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


/**
 * create datasource
 */
const datasource = new Datasource();

datasource.setData(dummydata.map((e)=>{
    //@ts-ignore
    e.date1 = new Date(e.date1)
     //@ts-ignore
    e.date2 = new Date(e.date2)
    return e
}));


/**
 * create interface
 */
const gridInterface = new GridInterface(gridConfig, datasource);

/**
 * add element and add inteface and styling
 * !important to add class
 */
const element = document.createElement('simple-html-grid') as GridElement;
element.style.width = '100%';
element.style.height = '100%';
element.style.display = 'flex';
element.classList.add('simple-html-grid');
element.connectInterface(gridInterface);

/**
 * add to document
 */
document.body.appendChild(element);

/**
 * dark theme helper...
 */
function darktheme() {
    const x = document.getElementById('darkgrid');
    if (x) {
        x.parentElement.removeChild(x);
    } else {
        const style = document.createElement('style');
        style.id = 'darkgrid';
        style.appendChild(
            document.createTextNode(`
    body,
    .simple-html-grid-menu,
    .simple-html-grid {
        --simple-html-grid-main-bg-color: #374151;
        --simple-html-grid-sec-bg-color: #4b5563;
        --simple-html-grid-alt-bg-color: #4b5563;
        --simple-html-grid-main-bg-border: #1f2937;
        --simple-html-grid-main-bg-even: #59606a;
        --simple-html-grid-main-bg-odd: #6b7178;
        --simple-html-grid-sec-bg-border: #1f2937;
        --simple-html-grid-pinned-border: #1f2937;
        --simple-html-grid-main-bg-selected-odd: #234882;
        --simple-html-grid-main-bg-selected-even: #274e8f;
        --simple-html-grid-main-font-color: #f9f7f7;
        --simple-html-grid-sec-font-color: #979494;
        --simple-html-grid-dropzone-color: rgb(151, 148, 148, 0.4);
        --simple-html-grid-grouping-border: #1f2937;
        --simple-html-grid-boxshadow: #4b5563;
        --simple-html-grid-main-hr-border: #4b5563;
    }

    .simple-html-grid ul.dialog-row {
        box-shadow: none;
      
    }
    .simple-html-grid li.dialog-row {

        border-left: 1px dotted rgb(100, 100, 100);
    } 
    .simple-html-grid .grid-edit-button {
        border-color: #374151;
    }
    .simple-html-grid .filter-dialog-bottom-row{
        border-top: 0px;
    }

    .simple-html-grid .filter-dialog-bottom-row button{
        border: 1px solid #515458;
    }

    .simple-html-grid-header input::placeholder {
        filter: opacity(0.4);
    }
    
    `)
        );
        document.body.appendChild(style);
    }
}

darktheme();
