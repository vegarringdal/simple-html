import '../../packages/grid/src/grid.css'; // direct so we can edit
import { Datasource, GridConfig, GridInterface, SimpleHtmlGrid } from '@simple-html/grid';
import { generateGridConfig } from './generateGridConfig';
import { DataGenerator } from './DataGenerator';

/**
 * simple gridconfig
 */
const gridConfig: GridConfig = generateGridConfig(2, 30);

/**
 * create datasource & data
 */

const datasource = new Datasource();
const generator = new DataGenerator();
datasource.setData(generator.generateData(100));

/**
 * create interface
 */
const gridInterface = new GridInterface(gridConfig, datasource);

/**
 * add element and add inteface and styling
 * !important to add class
 */
const element = document.createElement('simple-html-grid');
element.style.width = '1200px';
element.style.height = '1000px';
element.classList.add('simple-html-grid');
(element as SimpleHtmlGrid).interface = gridInterface;

/**
 * add to document
 */
document.body.appendChild(element);

/**
 * Add buttons
 */
const showDialogBtn = document.createElement('button');
showDialogBtn.innerText = 'show dialog';
showDialogBtn.addEventListener('click', () => {
    gridInterface.showFilterDialog();
});
document.body.appendChild(showDialogBtn);

const clearFilterBtn = document.createElement('button');
clearFilterBtn.innerText = 'clear filters';
clearFilterBtn.addEventListener('click', () => {
    gridInterface.clearAllFilters();
});
document.body.appendChild(clearFilterBtn);

const toggleSmartFIlterBtn = document.createElement('button');
toggleSmartFIlterBtn.innerText = 'toggle smartfilter';
toggleSmartFIlterBtn.addEventListener('click', () => {
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
            --simple-html-grid-sec-bg-border: #1f2937;
            --simple-html-grid-main-bg-selected: #234882;
            --simple-html-grid-main-font-color: #f9f7f7;
            --simple-html-grid-sec-font-color: #979494;
            --simple-html-grid-dropzone-color: #979494;
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
        
        `)
        );
        document.body.appendChild(style);
    }
});
document.body.appendChild(toggleSmartFIlterBtn);

{
    const button = document.createElement('button');
    button.innerText = 'remove on selected row';
    button.addEventListener('click', () => {
        const x = gridInterface.getDatasource().getSelection().getSelectedKeys();
        if (x.length) {
            x.shift();
        }
        gridInterface.getDatasource().getSelection().setSelectedKeys(x);
        gridInterface.getDatasource().getSelection().triggerSelectionChange();
    });
    document.body.appendChild(button);
}
