import './hmr';
import './index.css';

import { enableInternalLogger } from '@simple-html/core';
// we need to disable loggin on some of the grid elements so we dont drown
enableInternalLogger([
    'SIMPLE-HTML-GRID-ROW-GROUP',
    'SIMPLE-HTML-GRID-CELL-ROW',
    'SIMPLE-HTML-GRID-GROUP-ROW',
    'SIMPLE-HTML-GRID-CELL-LABEL',
    'SIMPLE-HTML-GRID-CELL-FILTER',
    'SIMPLE-HTML-GRID-ROW',
    'SIMPLE-HTML-GRID-GROUP-FILTER',
    'SIMPLE-HTML-GRID-GROUP-LABEL',
    'SIMPLE-HTML-GRID-PANEL',
    'SIMPLE-HTML-GRID-FOOTER',
    'SIMPLE-HTML-GRID-BODY',
    'SIMPLE-HTML-GRID-HEADER',
    'SIMPLE-HTML-GRID-MENU-ROW',
    'SIMPLE-HTML-GRID-MENU-FILTER',
    'SIMPLE-HTML-GRID-MENU-LABEL',
    'SIMPLE-HTML-GRID-FILTER-DIALOG'
]);

// add our sample parts
import './elements/app-root';
import './elements/sample-default';
import './elements/sample-no1';
import './elements/sample-no2';
import './elements/sample-no3';
import './elements/sample-no4';

// extra
import './elements/data-buttons';
import './elements/nav-buttons';

// add our grid
import '@simple-html/grid';
import '@simple-html/grid/src/grid.css';
