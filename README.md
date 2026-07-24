# @simple-html/grid

Only lit-html as dependency `npm i lit-html`, you need to install this manually

# package

Main will contain latest version.

Just run `npm run build` and copy the tgz file under `build` to you project
```json
"dependencies": {
  "@simple-html/grid": "file:./libs/simple-html-grid-X.X.X.tgz"
}
```


# Dev / Sample

* `git clone https://github.com/vegarringdal/simple-html`
* `npm i`
* `npm start` this is alias for `npm start grid01` third arg is sample subfolder
' open `http://localhost:8080`


# API docs:
* see `npm run typedoc-grid` and see open ` ./docs/grid/index.html` 


# Minimal code sample

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





