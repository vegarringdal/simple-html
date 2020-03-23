import './hmr';



// import main css
import './index.css';

// import grid and its css
import '@simple-html/grid';
import '@simple-html/grid/src/grid.css';

// import our app
import './components/app-component';

import { enableInternalLogger } from '@simple-html/core';
enableInternalLogger();

console.log('sample-v:', 1);


