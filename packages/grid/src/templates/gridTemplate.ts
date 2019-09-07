import { html } from 'lit-html';
import { FreeGrid } from '..';
import { scrollEvent } from '../scrollEvent';
import { panelElement } from './panelElement';
import { headerElement } from './headerElement';
import { bodyElement } from './bodyElement';
import { footerElement } from './footerElement';
import { rowCache } from '../interfaces';

export const gridTemplate = (freeGrid: FreeGrid, rowPositionCache: rowCache[]) => {
    const scroll = scrollEvent(freeGrid, rowPositionCache);

    return html`
        ${panelElement(freeGrid)} ${headerElement(freeGrid)}
        ${bodyElement(scroll, freeGrid, rowPositionCache)} ${footerElement(freeGrid)}
    `;
};
