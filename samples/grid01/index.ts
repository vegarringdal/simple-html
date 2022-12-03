import './index.css';
import { Datasource } from '@simple-html/datasource';
import { GridInterface, GridConfig, GridElement } from '@simple-html/grid';
import '../../packages/grid/src/grid.css';

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
            rows: ['firstnamea', 'children'],
            width: 100
        },
        {
            rows: ['boolean2'],
            width: 100
        },
        {
            rows: ['parents'],
            width: 100
        }
    ],
    columnsPinnedRight: [
        {
            rows: ['firstnamec', 'born'],
            width: 100
        },
        {
            rows: ['firstnamed', 'boolean'],
            width: 100
        }
    ],
    columnsCenter: [],
    attributes: {
        firstnamea: {
            attribute: 'firstnamea',
            readonly: true
        },
        boolean: {
            attribute: 'boolean',
            type: 'boolean',
            readonly: true
        },
        boolean2: {
            attribute: 'boolean',
            type: 'boolean',
            readonly: false
        },
        parents: {
            attribute: 'parents',
            type: 'number'
        },
        born: {
            attribute: 'born',
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
 * dyanmically create columns
 * please overlook this crap... just to simulate A LOT of columns
 */
for (let y = 0; y < 300; y++) {
    const obj = {
        rows: ['x' + y, 'y' + y],
        width: 100 + (y % 3 === 0 ? 40 : 5)
    };
    gridConfig.columnsCenter.push(obj);
}

/**
 * create datasource
 */
const datasource = new Datasource();

/**
 * dyanmically create dummy data
 * please overlook this crap... just to give me test data/columns
 */
let u = 0;
let ii = 0;
let cat = 'one';

const c = [];
for (let i = 0; i < 1000; i++) {
    u++;
    if (u === 10) {
        ii++;
        cat = `cat${ii}`;
        u = 0;
    }

    const o = {
        firstnamea: 'firstnamea' + i,
        firstnameb: 'firstnameb' + i,
        firstnamec: 'firstnamec' + i,
        firstnamed: 'firstnamed' + i,
        lastname: 'Gron',
        children: cat,
        boolean: u < 5 ? true : false,
        boolean2: u < 5 ? true : false,
        parents: 2,
        born: new Date(new Date().setDate(i))
    };

    for (let y = 0; y < 300; y++) {
        o['x' + y] = 'x' + y + ':' + i;
        o['y' + y] = 'y' + y + ':' + i;
    }

    c.push(o);
}

datasource.setData(c);

/*  
    //just to test grouping set on init
    datasource.group([{ title: 'children', attribute: 'children' }, { title: 'parents', attribute: 'parents' }]);
    datasource.expandGroup("cat104");   
*/

/* 
// just to test if dataset changes
    setTimeout(() => {
        const c = [];
        for (let i = 0; i < 10; i++) {
            u++;
            if (u === 10) {
                ii++;
                cat = `cat${ii}`;
                u = 0;
            }

            const o = {
                firstnamea: 'firstnamea' + i,
                firstnameb: 'firstnameb' + i,
                firstnamec: 'firstnamec' + i,
                firstnamed: 'firstnamed' + i,
                lastname: 'Gron',
                children: cat,
                boolean: u < 5 ? true : false,
                parents: 2,
                born: new Date()
            };

            for (let y = 0; y < 300; y++) {
                o['x' + y] = 'x' + y + ':' + i;
                o['y' + y] = 'y' + y + ':' + i;
            }

            c.push(o);
        }

        datasource.setData(c);
    }, 5000); 
 */

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

/* darktheme();
 */