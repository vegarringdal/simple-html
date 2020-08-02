import { GridInterface } from '..';
import { CellConfig, GridGroupConfig } from '../types';
import { html } from 'lit-html';
import { GroupArgument } from '@simple-html/datasource/src';

let dragCell: CellConfig = null;
let dragGroup: GridGroupConfig = null;
let dragColumnBlock: HTMLElement = null;
let internalDragGroup: any = null;

let panelRef: HTMLElement = null;
let panelColumnRef: HTMLElement = null;
let panelColGroupName: string = null;

function capalize(text: string) {
    if (text) {
        return text[0].toUpperCase() + text.substring(1, text.length);
    } else {
        return text;
    }
}

/**
 * drop on panel
 */
export const columnDragDropPanel = (event: string, _connector: GridInterface) => {
    const drop = (e: MouseEvent) => {
        if (dragCell?.allowGrouping) {
            _connector.groupingCallback(e, dragCell, panelColGroupName);
        }
        e.target.removeEventListener('mouseup', drop);
        (e.target as any).classList.remove('simple-html-grid-candrop');

        if (panelRef) {
            panelRef.classList.remove('simple-html-grid-candrop');
        }

        if (panelColumnRef) {
            panelColumnRef.classList.remove('simple-html-grid-candrop-panel-col');
        }

        panelColGroupName = null;
        internalDragGroup = null;
    };

    return (_e: MouseEvent) => {
        if (event === 'enter' && dragCell) {
            panelRef = _e.target as any;
            (_e.target as any).classList.add('simple-html-grid-candrop');
            _e.target.addEventListener('mouseup', drop);
        }

        if (event === 'leave' && dragCell) {
            panelRef = null;
            _e.target.removeEventListener('mouseup', drop);
            (_e.target as any).classList.remove('simple-html-grid-candrop');
        }
    };
};

/**
 * used by boxes/grouping in panel for interal drag/drop
 */
export const panelColumn = (event: string, _connector: GridInterface) => {
    const drop = (e: MouseEvent) => {
        if (internalDragGroup) {
            _connector.groupingCallback(e, internalDragGroup, panelColGroupName);

            e.target.removeEventListener('mouseup', drop);
            (e.target as any).classList.remove('simple-html-grid-candrop');

            if (panelRef) {
                panelRef.classList.remove('simple-html-grid-candrop');
            }

            if (panelColumnRef) {
                panelColumnRef.classList.remove('simple-html-grid-candrop-panel-col');
            }

            panelColGroupName = null;
            internalDragGroup = null;
        }
    };

    return (_e: MouseEvent, group?: string) => {
        if ((event === 'enter' && dragCell) || (event === 'enter' && internalDragGroup)) {
            panelColumnRef = _e.target as any;
            panelColGroupName = group;
            (_e.target as any).classList.add('simple-html-grid-candrop-panel-col');
            if (panelRef) {
                panelRef.classList.remove('simple-html-grid-candrop');
            }
            if (internalDragGroup) {
                _e.target.addEventListener('mouseup', drop);
            }
        }

        if ((event === 'leave' && dragCell) || (event === 'leave' && internalDragGroup)) {
            panelColumnRef = null;
            panelColGroupName = null;
            (_e.target as any).classList.remove('simple-html-grid-candrop-panel-col');
            if (internalDragGroup) {
                _e.target.removeEventListener('mouseup', drop);
            }
        }
    };
};

/**
 * used by boxes/grouping in panel for interal drag/drop
 */
export const columnDragDropPanelColumn = (event: string, _connector: GridInterface) => {
    // here we will clean up eevnt listeners
    const mouseUp = function () {
        document.removeEventListener('mouseup', mouseUp);
        document.removeEventListener('mousemove', mouseMove);

        internalDragGroup = null;
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

    return (_e: any, group: GroupArgument) => {
        if (event === 'dragstart' && _e.button === 0 && _e.target.tagName === 'P') {
            //save cell ref
            internalDragGroup = { header: group.title, attribute: group.attribute };
            //dragGroup = _group;

            // register mouseup so we can clean up
            document.addEventListener('mouseup', mouseUp);

            dragColumnBlock = document.createElement('div');
            dragColumnBlock.style.top = -1200 + 'px'; // hide it
            dragColumnBlock.style.left = -1200 + 'px';
            dragColumnBlock.style.height = _connector.config.cellHeight + 'px';
            dragColumnBlock.classList.add('simple-html-grid');
            dragColumnBlock.classList.add('simple-html-grid-drag');
            dragColumnBlock.classList.add('simple-html-grid-cell-label');
            dragColumnBlock.textContent = capalize(group.title);
            document.body.appendChild(dragColumnBlock);
            document.addEventListener('mousemove', mouseMove);
        }
    };
};

/**
 * used by column for dragging/drop
 */
export const columnDragDrop = (
    event: string,
    _cell: CellConfig,
    _connector: GridInterface,
    _group: GridGroupConfig
) => {
    // here we will clean up eevnt listeners
    const mouseUp = function () {
        document.removeEventListener('mouseup', mouseUp);
        document.removeEventListener('mousemove', mouseMove);
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
            dragColumnBlock.textContent = capalize(_cell.header);

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

/**
 * used by column labels
 */
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
