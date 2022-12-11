# @simple-html/grid & @simple-html/datasource

> 💡version 5.0.0 is under active development - and will replace version 4.0.0 within December 2022

Native html grid & datasource with no dependencies.

Its beeing used in some personal applications at work atm to get real world testing on what works
good and not.

Source code:

-   [Grid](https://github.com/simple-html/simple-html/tree/master/packages/grid)
-   [Datasource](https://github.com/simple-html/simple-html/tree/master/packages/datasource)

API docs

-   [Grid](https://simple-html.github.io/simple-html/grid/index.html)
-   [Datasource](https://simple-html.github.io/simple-html/datasource/index.html)

# Developer sample 01

-   clone repo
-   `npm install`
-   `npm start grid01`


### BUILD / RELEASE

`npm run build:all` builds all packages

`npm run typedoc-grid` update typedoc grid `npm run typedoc-ds` update typedoc grid

`npm run release:next` updates package.json and updates chnagelog (remove next if not test version)

`git push --follow-tags origin master` to update github with new tag

`npm run publish:all` publishes repo, you need to push

### how to try samples

-   `clone repo`
-   run `npm install`
-   run samples

    -   `npm start grid01`
      - as simple as it can get
    -   `npm start grid02`
      - using lit-html will get a lot of sample code how methods of grid/datasource work

    Will add more sample... just been to busy lately

### Sampel code to show how simples grid would be made

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
````
