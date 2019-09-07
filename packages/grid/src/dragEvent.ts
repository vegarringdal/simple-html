import { FreeGrid } from '.';
import { IColumns } from './interfaces';

let dragColumn: null | number = null;
let enterColumn: null | number = null;
let dragColumnBlock: HTMLElement = null;
let enterRect: any = null;
let delayDragEventTimer: any = null;

function offset(el: HTMLElement, width: number) {
    const rect = el.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
        scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    return {
        top: rect.top + scrollTop,
        left: rect.left + scrollLeft,
        center: rect.left + width / 2 + scrollLeft
    };
}

export const columnDragDropPanel = (event: string, _freeGrid: FreeGrid) => {
    const drop = (e: any) => {
        e.target.removeEventListener('mouseup', drop);
        if (_freeGrid.config.columns[dragColumn].allowGrouping) {
            _freeGrid.arrayUtils.groupingCallbackBinded(
                e,
                _freeGrid.config.columns[dragColumn],
                _freeGrid
            );
        }
        (e.target as any).classList.remove('free-grid-candrop');
    };

    return (_e: MouseEvent) => {
        if (event === 'enter' && dragColumn) {
            _e.target.addEventListener('mouseup', drop);
            if (_freeGrid.config.columns[dragColumn].allowGrouping) {
                (_e.target as any).classList.add('free-grid-candrop');
            }
        }

        if (event === 'leave' && dragColumn) {
            _e.target.removeEventListener('mouseup', drop);
            (_e.target as any).classList.remove('free-grid-candrop');
        }
    };
};

export const columnDragDrop = (event: string, _col: IColumns, _i: number, _freeGrid: FreeGrid) => {
    // here we will clean up eevnt listeners
    const mouseUp = function() {
        document.removeEventListener('mouseup', mouseUp);
        document.removeEventListener('mousemove', mouseMove);
        clearTimeout(delayDragEventTimer);
        dragColumn = null;
        enterColumn = null;
        enterRect = null;
        if (dragColumnBlock) {
            document.body.removeChild(dragColumnBlock);
        }
        dragColumnBlock = null;
    };

    // this will just move our label
    const mouseMove = function(e: MouseEvent) {
        dragColumnBlock.style.top = e.clientY + document.documentElement.scrollTop + 'px'; // hide it
        dragColumnBlock.style.left = e.clientX + document.documentElement.scrollLeft + 'px';

        if (enterColumn !== null && dragColumn !== enterColumn) {
            const rect = enterRect;
            const cursor = e.clientX + document.documentElement.scrollLeft;

            if (cursor + 15 > rect.center && cursor - 15 < rect.center) {
                const columns = _freeGrid.config.columns;
                const b = columns[dragColumn];
                columns[dragColumn] = columns[enterColumn];
                columns[enterColumn] = b;
                dragColumn = enterColumn;
                enterColumn = null;

                _freeGrid.reRender();
            }
        }
    };

    // main event binded to column
    return (_e: MouseEvent) => {
        // mouse down event
        if (event === 'dragstart' && _e.button === 0 && (<any>_e.target).tagName === 'P') {
            // regsiter mouseup so we can clean up

            document.addEventListener('mouseup', mouseUp);
            dragColumn = _i;
            delayDragEventTimer = setTimeout(() => {
                // I could do this with lit-html too... but can I have classes on shadow dom and use them here ?
                // I might get a styling issue if I use class
                dragColumnBlock = document.createElement('div');
                dragColumnBlock.style.top = -1200 + 'px'; // hide it
                dragColumnBlock.style.left = -1200 + 'px';
                dragColumnBlock.classList.add('free-grid');
                dragColumnBlock.classList.add('free-grid-drag');
                dragColumnBlock.textContent = _col.header;
                document.body.appendChild(dragColumnBlock);
                // add event so we can move new element
                document.addEventListener('mousemove', mouseMove);
            }, 500);
        }

        // when something gets dragged over
        if (event === 'enter' && dragColumn !== null) {
            // same or new column ?
            if (dragColumn !== _i) {
                enterColumn = _i;
                // get position
                enterRect = offset(_e.target as HTMLElement, _col.width || 100);
            }
        }
    };
};
