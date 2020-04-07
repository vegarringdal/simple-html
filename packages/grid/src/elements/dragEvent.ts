import { GridInterface } from '..';
import { ICell } from '../interfaces';

let dragCell: ICell = null;
let dragColumnBlock: HTMLElement = null;
const delayDragEventTimer: any = null;

/* function offset(el: HTMLElement, width: number) {
    const rect = el.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
        scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    return {
        top: rect.top + scrollTop,
        left: rect.left + scrollLeft,
        center: rect.left + width / 2 + scrollLeft
    };
} */

export const columnDragDropPanel = (event: string, _connector: GridInterface) => {
    const drop = (e: any) => {
        if (dragCell.allowGrouping) {
            _connector.groupingCallback(e, dragCell);
        }
        e.target.removeEventListener('mouseup', drop);
        (e.target as any).classList.remove('free-grid-candrop');
    };

    return (_e: MouseEvent) => {
        if (event === 'enter' && dragCell) {
            (_e.target as any).classList.add('free-grid-candrop');
            _e.target.addEventListener('mouseup', drop);
        }

        if (event === 'leave' && dragCell) {
            _e.target.removeEventListener('mouseup', drop);
            (_e.target as any).classList.remove('free-grid-candrop');
        }
    };
};

export const columnDragDrop = (event: string, _col: ICell, _connector: GridInterface) => {
    // here we will clean up eevnt listeners

    const mouseUp = function () {
        document.removeEventListener('mouseup', mouseUp);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        document.removeEventListener('mousemove', mouseMove);
        clearTimeout(delayDragEventTimer);
        dragCell = null;
        if (dragColumnBlock) {
            document.body.removeChild(dragColumnBlock);
        }
        dragColumnBlock = null;
    };

    // this will just move our label
    const mouseMove = function (e: MouseEvent) {
        setTimeout(() => {
            if (dragColumnBlock) {
                dragColumnBlock.style.top = e.clientY + document.documentElement.scrollTop + 'px'; // hide it
                dragColumnBlock.style.left = e.clientX + document.documentElement.scrollLeft + 'px';
            }
        }, 10);
    };

    // main event binded to column
    return (_e: any) => {
        // mouse down event
        if (event === 'dragstart' && _e.button === 0 && _e.target.tagName === 'SPAN') {
            //save cell ref
            dragCell = _e.target.cell;

            // register mouseup so we can clean up
            document.addEventListener('mouseup', mouseUp);

            dragColumnBlock = document.createElement('div');
            dragColumnBlock.style.top = -1200 + 'px'; // hide it
            dragColumnBlock.style.left = -1200 + 'px';
            dragColumnBlock.classList.add('free-grid');
            dragColumnBlock.classList.add('free-grid-drag');
            dragColumnBlock.textContent = _col.header;
            document.body.appendChild(dragColumnBlock);
            document.addEventListener('mousemove', mouseMove);
        }

        if (dragCell !== null) {
            // not very fancy, but betteer then nothing
            const drop = (e: any) => {
                const daCell = Object.assign({}, dragCell);
                const doCell = Object.assign({}, _col);
                const keys = Object.assign(dragCell, _col);

                for (const key in keys) {
                    dragCell[key] = doCell[key];
                    _col[key] = daCell[key];
                }

                _connector.reRender();

                e.target.removeEventListener('mouseup', drop);
                (e.target as any).classList.remove('free-grid-candrop');
            };

            if (event === 'enter' && dragCell) {
                if (_col.type === 'empty') {
                    (_e.target as any).classList.toggle('hideme');
                }

                (_e.target as any).classList.add('free-grid-candrop');
                _e.target.addEventListener('mouseup', drop);
            }

            if (event === 'leave' && dragCell) {
                if (_col.type === 'empty') {
                    (_e.target as any).classList.toggle('hideme');
                }
                _e.target.removeEventListener('mouseup', drop);
                (_e.target as any).classList.remove('free-grid-candrop');
            }
        }
    };
};
