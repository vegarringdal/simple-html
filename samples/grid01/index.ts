import '../../packages/grid/src/grid.css'; // direct so we can edit // import "@simple-html/grid/dist/grid.css";
import { Datasource, GridConfig, GridInterface, SimpleHtmlGrid } from '@simple-html/grid';

/**
 * simple gridconfig
 */
const gridConfig: GridConfig = {
    cellHeight: 20,
    panelHeight: 25,
    footerHeight: 40,
    readonly: true,
    selectionMode: 'multiple',
    groups: [
        {
            width: 200,
            rows: [
                {
                    header: 'firstname',
                    attribute: 'firstname',
                    filterable: {}
                }
            ]
        },
        {
            width: 200,
            rows: [
                {
                    header: 'lastname',
                    attribute: 'lastname',
                    filterable: {}
                }
            ]
        }
    ]
};

/**
 * create datasource
 */

const datasource = new Datasource();
datasource.setData([
    {
        firstname: 'Per',
        lastname: 'Person'
    },
    {
        firstname: 'Nina',
        lastname: 'Larson'
    },
    {
        firstname: 'Lasse',
        lastname: 'Gronn'
    }
]);

/**
 * create interface
 */
const gridInterface = new GridInterface(gridConfig, datasource);

/**
 * add element and add inteface and styling
 * !important to add class
 */
const element = document.createElement('simple-html-grid');
element.style.width = '500px';
element.style.height = '500px';
element.classList.add('simple-html-grid');
(element as SimpleHtmlGrid).interface = gridInterface;

/**
 * add to document
 */
document.body.appendChild(element);
