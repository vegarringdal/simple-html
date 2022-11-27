# @simple-html/grid

Simple data grid made with @simple-html/datasource.
This grid is made for desktop, not mobile.


Features:

-   Grouping
-   Filtering
-   multi sorting
-   mulitiselect rows

Grid uses @simple-html/datasource to for sorting/filtering/sorting/tracking changes

### Install

-   `npm install @simple-html/grid`

### Sample


```ts
// since datasource is part of grid dependency, you only need to install the grid
import "@simple-html/grid/dist/grid.css";
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
 * assume this script is running after body is created
 */
document.body.appendChild(element);
```


### Bundle size:

https://bundlephobia.com/result?p=@simple-html/grid

### Docs

[Grid Api](https://simple-html.github.io/simple-html/grid/index.html)
