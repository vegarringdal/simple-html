import { GridInterface } from '..';
import { CellConfig, GridGroupConfig } from '../types';
import { html } from 'lit-html';

let dragCell: CellConfig = null;
let dragGroup: GridGroupConfig = null;
let dragColumnBlock: HTMLElement = null;
const delayDragEventTimer: any = null;

export const columnDragDropPanel = (event: string, _connector: GridInterface) => {
    const drop = (e: MouseEvent) => {
        if (dragCell.allowGrouping) {
            _connector.groupingCallback(e, dragCell);
        }
        e.target.removeEventListener('mouseup', drop);
        (e.target as any).classList.remove('simple-html-grid-candrop');
    };

    return (_e: MouseEvent) => {
        if (event === 'enter' && dragCell) {
            (_e.target as any).classList.add('simple-html-grid-candrop');
            _e.target.addEventListener('mouseup', drop);
        }

        if (event === 'leave' && dragCell) {
            _e.target.removeEventListener('mouseup', drop);
            (_e.target as any).classList.remove('simple-html-grid-candrop');
        }
    };
};

export const columnDragDrop = (
    event: string,
    _cell: CellConfig,
    _connector: GridInterface,
    _group: GridGroupConfig
) => {
    // here we will clean up eevnt listeners
    const mouseUp = function () {
        document.removeEventListener('mouseup', mouseUp);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        document.removeEventListener('mousemove', mouseMove);
        clearTimeout(delayDragEventTimer);
        dragCell = null;
        dragGroup = null;
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
            dragCell = _cell;
            dragGroup = _group;

            // register mouseup so we can clean up
            document.addEventListener('mouseup', mouseUp);

            dragColumnBlock = document.createElement('div');
            dragColumnBlock.style.top = -1200 + 'px'; // hide it
            dragColumnBlock.style.left = -1200 + 'px';
            dragColumnBlock.style.height = _connector.config.cellHeight + 'px';
            dragColumnBlock.classList.add('simple-html-grid');
            dragColumnBlock.classList.add('simple-html-grid-drag');
            dragColumnBlock.classList.add('simple-html-grid-cell-label');
            dragColumnBlock.textContent = _cell.header;
            document.body.appendChild(dragColumnBlock);
            document.addEventListener('mousemove', mouseMove);
        }

        if (dragCell !== null) {
            // not very fancy, but betteer then nothing
            const drop = (e: any) => {
                const daCell = Object.assign({}, dragCell);
                const doCell = Object.assign({}, _cell);
                const keys = Object.assign(dragCell, _cell);

                for (const key in keys) {
                    dragCell[key] = doCell[key];
                    _cell[key] = daCell[key];
                }

                _connector.reRender();

                e.target.removeEventListener('mouseup', drop);
                (e.target as any).classList.remove('simple-html-grid-candrop');
            };

            if (event === 'enter' && dragCell && dragCell !== _cell) {
                if (_cell.type === 'empty') {
                    (_e.target as any).classList.toggle('hideme');
                }

                (_e.target as any).classList.add('simple-html-grid-candrop');
                _e.target.addEventListener('mouseup', drop);
            }

            if (event === 'leave' && dragCell) {
                if (_cell.type === 'empty') {
                    (_e.target as any).classList.toggle('hideme');
                }
                _e.target.removeEventListener('mouseup', drop);
                (_e.target as any).classList.remove('simple-html-grid-candrop');
            }
        }
    };
};

export function dropzone(
    _connector: GridInterface,
    _group: GridGroupConfig,
    _cell: CellConfig,
    type: 'left' | 'right' | 'top' | 'bottom'
) {
    const up = function (e: any) {
        // loop old columns and remove them
        let oldGroupI: number = null;
        let oldRowI: number = null;
        if (dragGroup) {
            _connector.config.groups.forEach((g, i) => {
                if (g === dragGroup) {
                    g.rows.forEach((r, y) => {
                        if (r === dragCell) {
                            oldGroupI = i;
                            oldRowI = y;
                        }
                    });
                    if (oldRowI !== null) {
                        g.rows.splice(oldRowI, 1);
                    }
                }
            });
        } else {
            // its column chooser
            let optionsCells: number = null;
            _connector.config.optionalCells.forEach((r, i) => {
                if (r === dragCell) {
                    optionsCells = i;
                }
            });
            if (optionsCells !== null) {
                _connector.config.optionalCells.splice(optionsCells, 1);
            }
        }

        // loop new group position and insert
        let newGroupI: number = null;
        let newRowI: number = null;
        _connector.config.groups.forEach((g, i) => {
            if (g === _group) {
                g.rows.forEach((r, y) => {
                    if (r === _cell) {
                        newGroupI = i;
                        newRowI = y;
                    }
                });
            }
        });
        if (newRowI !== null) {
            if (type === 'left') {
                _connector.config.groups.splice(newGroupI, 0, {
                    width: dragGroup ? _connector.config.groups[oldGroupI].width : 100,
                    rows: [dragCell]
                });
            }
            if (type === 'right') {
                _connector.config.groups.splice(newGroupI + 1, 0, {
                    width: dragGroup ? _connector.config.groups[oldGroupI].width : 100,
                    rows: [dragCell]
                });
            }
            if (type === 'top') {
                _connector.config.groups[newGroupI].rows.splice(newRowI, 0, dragCell);
            }
            if (type === 'bottom') {
                _connector.config.groups[newGroupI].rows.splice(newRowI + 1, 0, dragCell);
            }
        }
        (e.target as any).classList.remove('simple-html-grid-candrop');
        dragCell = null;
        dragGroup = null;

        // clean up empty groups
        let removeGroup = null;
        _connector.config.groups.forEach((row, groupNo) => {
            if (row.rows.length === 0) {
                removeGroup = groupNo;
            }
        });
        if (removeGroup !== null) {
            _connector.config.groups.splice(removeGroup, 1);
        }

        // rerender
        setTimeout(() => {
            _connector.manualConfigChange(_connector.config);
        }, 0);
    };

    const mouseEnter = (e: MouseEvent) => {
        if (dragCell && dragCell !== _cell) {
            e.preventDefault();
            (e.target as any).classList.add('simple-html-grid-candrop');
            e.target.addEventListener('mouseup', up);
        }
    };

    const mouseLeave = (e: MouseEvent) => {
        if (dragCell && dragCell !== _cell) {
            e.preventDefault();
            (e.target as any).classList.remove('simple-html-grid-candrop');
            e.target.removeEventListener('mouseup', up);
        }
    };

    switch (type) {
        case 'bottom':
            return html`
                <div
                    class="simple-html-grid-drop-zone-bottom"
                    @mouseenter=${mouseEnter}
                    @mouseleave=${mouseLeave}
                ></div>
            `;
        case 'top':
            return html`
                <div
                    class="simple-html-grid-drop-zone-top"
                    @mouseenter=${mouseEnter}
                    @mouseleave=${mouseLeave}
                ></div>
            `;
        case 'left':
            return html`
                <div
                    class="simple-html-grid-drop-zone-left"
                    @mouseenter=${mouseEnter}
                    @mouseleave=${mouseLeave}
                ></div>
            `;
        case 'right':
            return html`
                <div
                    class="simple-html-grid-drop-zone-right"
                    @mouseenter=${mouseEnter}
                    @mouseleave=${mouseLeave}
                ></div>
            `;
    }
}
