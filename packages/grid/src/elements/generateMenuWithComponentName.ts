import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';

export function generateMenuWithComponentName(
    element: string,
    event: any,
    connector: GridInterface,
    ref: SimpleHtmlGrid,
    getCell?: () => any,
    rowNo?: () => number,
    data?: () => any
) {
    const menu = document.createElement(element);
    menu.style.top = event.clientY + document.documentElement.scrollTop + 'px'; // hide it
    menu.style.left = event.clientX + document.documentElement.scrollLeft + 'px';
    (menu as any).connector = connector;
    (menu as any).ref = ref;
    (menu as any).cell = getCell && getCell();
    (menu as any).rowNo = rowNo && rowNo();
    (menu as any).rowData = data && data();

    document.body.appendChild(menu);
}
