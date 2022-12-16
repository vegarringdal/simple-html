# @simple-html/grid

Sample:
- [sample](https://vegarringdal.github.io/rebuild-grid/index.html)

API docs:
-   [Grid](https://vegarringdal.github.io/simple-html/grid/index.html)

Source code:
-   [Grid](https://github.com/vegarringdal/simple-html/packages/grid)

Features/Todo:
- [todo](https://github.com/vegarringdal/simple-html)


Minimal sample:
```ts
import './index.css';
import { GridInterface, GridElement, GridConfig, Datasource } from '@simple-html/grid';
import "@simple-html/grid/dist/grid.css";

/**
 * create datasource
 */
const datasource = new Datasource();

// add data
datasource.setData([
    { firstname: 'first1', lastname: 'last1' },
    { firstname: 'first2', lastname: 'last2' },
    { firstname: 'first3', lastname: 'last3' }
]);

/**
 * create gridConfig
 */
const gridConfig: GridConfig = {
    columnsCenter: [
        {
            rows: ['firstname'],
            width: 100
        },
        {
            rows: ['lastname'],
            width: 100
        }
    ],
    attributes: [
        {
            attribute: 'firstname'
        },
        {
            attribute: 'lastname'
        }
    ]
};


/**
 * create interface and add gridconfig and datasource to it
 */
const gridInterface = new GridInterface(gridConfig, datasource);

/**
 * create element for the grid
 */
const element = document.createElement('simple-html-grid') as GridElement;
element.style.width = '100%';
element.style.height = '100%';
element.style.display = 'flex';
element.classList.add('simple-html-grid');
element.connectInterface(gridInterface);

document.body.appendChild(element);
```
