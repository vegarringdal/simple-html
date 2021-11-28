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
