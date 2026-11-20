# @simple-html/grid

Vanilla js data grid. Its only dependency is lit-html, which is installed with it.

# package

> mostly just me using this, so making it very simple for me to try out new stuff/patch

Install straight from a git branch - the `prepare` script builds `dist` on install:
```json
"dependencies": {
  "@simple-html/grid": "github:<owner>/simple-html#<branch>"
}
```

Or run `npm run build:tgz` and copy the tgz from `build` to your project:
```json
"dependencies": {
  "@simple-html/grid": "file:./libs/simple-html-grid-X.X.X.tgz"
}
```

The css is imported from the package root:
```ts
import '@simple-html/grid/grid.css';
import '@simple-html/grid/date.css'; // the date picker
```

# Dev / Sample

* `git clone https://github.com/vegarringdal/simple-html`
* `npm i`
* `npm start` serves the samples app (`samples/demo`), `npm start <folder>` another folder under `samples/`
* open `http://localhost:8080`


# API docs:
* see `npm run typedoc-grid` and see open ` ./docs/grid/index.html` 


# Minimal code sample

```ts
import './index.css';
import { GridInterface, GridElement, GridConfig, Datasource } from '@simple-html/grid';
import '@simple-html/grid/grid.css';

/**
 * create datasource, with the fields that are not text
 */
const datasource = new Datasource({
    fields: {
        born: { type: 'date', label: 'Born' }
    }
});

// add data
datasource.setData([
    { firstname: 'first1', lastname: 'last1', born: new Date(1990, 0, 1) },
    { firstname: 'first2', lastname: 'last2', born: new Date(1985, 5, 17) },
    { firstname: 'first3', lastname: 'last3', born: new Date(2001, 11, 24) }
]);

/**
 * create gridConfig: where the columns go (layout), and the options of a column by field name
 * (columns). The column type and label come from the datasource fields, a field without an entry in
 * columns gets the default options
 */
const gridConfig: GridConfig = {
    columns: {
        firstname: { label: 'First name' }
    },
    layout: {
        center: [
            { fields: ['firstname'], width: 100 },
            { fields: ['lastname'], width: 100 },
            { fields: ['born'], width: 100 }
        ]
    }
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

/**
 * what the user changed - column order and widths, sorting, filters ... - is the state
 */
const state = gridInterface.getState();
gridInterface.setState(state); // later: back to it
gridInterface.resetState(); // back to the start
```





