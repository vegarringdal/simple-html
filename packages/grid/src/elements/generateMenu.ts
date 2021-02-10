export function generateMenu(event: any, rows: any[]) {
    const menu = document.createElement('simple-html-grid-menu-custom');
    menu.style.top = event.clientY + document.documentElement.scrollTop + 'px'; // hide it
    menu.style.left = event.clientX + document.documentElement.scrollLeft + 'px';
    menu.style.maxHeight = '300px';
    menu.style['overflow-y'] = 'auto';
    (menu as any).rows = rows;
    document.body.appendChild(menu);
}
