import { html } from 'lit-html';
import { scrollEvent } from '../scrollEvent';
import { panelElement } from './panelElement';
import { headerElement } from './headerElement';
import { bodyElement } from './bodyElement';
import { footerElement } from './footerElement';
import { rowCache } from '../interfaces';
import { GridInterface } from '../gridInterface';

export const gridTemplate = (connector: GridInterface, rowPositionCache: rowCache[]) => {
    const scroll = scrollEvent(connector, rowPositionCache);

    return html`
        ${panelElement(connector)} ${headerElement(connector)}
        ${bodyElement(scroll, connector, rowPositionCache)} ${footerElement(connector)}
    `;
};
