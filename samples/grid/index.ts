import './hmr';

import '@simple-html/grid/src/grid.css';
// import main css
import './index.css';

// import grid and its css
import '@simple-html/grid';

// import our app
import './components/app-component';

import { enableInternalLogger } from '@simple-html/core';
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
    'SIMPLE-HTML-GRID-HEADER'
]);

console.log('sample-v:', 1);
