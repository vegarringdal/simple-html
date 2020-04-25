import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';

export function generateMenu(
    element: string,
    event: any,
    connector: GridInterface,
    ref: SimpleHtmlGrid,
    cell?: any,
    rowNo?: number,
    data?: any
) {
    const menu = document.createElement(element);
    menu.style.top = event.clientY + document.documentElement.scrollTop + 'px'; // hide it
    menu.style.left = event.clientX + document.documentElement.scrollLeft + 'px';
    (menu as any).connector = connector;
    (menu as any).ref = ref;
    (menu as any).cell = cell;
    (menu as any).rowNo = rowNo;
    (menu as any).rowData = data;

    document.body.appendChild(menu);
}
