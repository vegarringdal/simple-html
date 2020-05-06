import './hmr';
import './index.css';

import { enableInternalLogger } from '@simple-html/core';
enableInternalLogger([
    'SIMPLE-HTML-DATE-WEEK',
    'SIMPLE-HTML-DATE-DAY',
    'SIMPLE-HTML-DATE-DAY-HEADER',
    'SIMPLE-HTML-DATE-WEEK-HEADER',
    'SIMPLE-HTML-DATE-MONTH-HEADER',
    'SIMPLE-HTML-DATE-DAY-ROW',
    'SIMPLE-HTML-DATE-HEADER-ROW',
    'SIMPLE-HTML-DATE-MONTH',
    'SIMPLE-HTML-DATE-HEADER'
]);

// add our sample parts
import './elements/app-root';
import './elements/sample-default';
import './elements/sample-no1';
import './elements/sample-no2';
import './elements/sample-no3';
import './elements/sample-no4';

// add our your widget ?
import '@simple-html/date';
