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
    'FREE-GRID-ROW-GROUP',
    'FREE-GRID-CELL-ROW',
    'FREE-GRID-GROUP-ROW',
    'FREE-GRID-CELL-LABEL',
    'FREE-GRID-CELL-FILTER',
    'FREE-GRID-ROW',
    'FREE-GRID-GROUP-FILTER',
    'FREE-GRID-GROUP-LABEL',
    'FREE-GRID-PANEL',
    'FREE-GRID-FOOTER',
    'FREE-GRID-BODY',
    'FREE-GRID-HEADER'
]);

console.log('sample-v:', 1);
