import { GridInterface } from '..';
import { CellConfig, GridGroupConfig } from '../types';
import { GroupArgument } from '@simple-html/datasource';

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
        requestAnimationFrame(() => {
            if (dragColumnBlock) {
                dragColumnBlock.style.top = e.clientY + document.documentElement.scrollTop + 'px'; // hide it
                dragColumnBlock.style.left = e.clientX + document.documentElement.scrollLeft + 'px';
            }
        });
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

// helpers to stop drap drop to show of not moved over 10px
let lastX: number = null;
let lastY: number = null;

/**
 * used by column for dragging/drop
 */
export const columnDragDrop = (
    event: string,
    getCell: () => CellConfig,
    _connector: GridInterface,
    getGroup?: () => GridGroupConfig
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

    let node = _connector.getMainElement()?.getElementsByTagName('simple-html-grid-body')[0];

    // this will just move our label
    const mouseMove = function (e: MouseEvent) {
        if (Math.abs(lastY - e.clientY) > 10 || Math.abs(lastX - e.clientX) > 10) {
            lastY = 99200;
            lastX = 99200;
            node = _connector.getMainElement()?.getElementsByTagName('simple-html-grid-body')[0];
            requestAnimationFrame(() => {
                if (dragColumnBlock) {
                    dragColumnBlock.style.top =
                        e.clientY + document.documentElement.scrollTop + 'px'; // hide it
                    dragColumnBlock.style.left =
                        e.clientX + document.documentElement.scrollLeft + 'px';

                    // scroll grid left/right when dragging
                    const rect = _connector.getMainElement().getClientRects()[0];

                    if (node.scrollLeft > 0 && rect.x > e.clientX) {
                        node.scrollLeft = node.scrollLeft + (e.clientX - rect.x);
                    }

                    if (rect.x + rect.width < e.clientX) {
                        node.scrollLeft = node.scrollLeft - (rect.x + rect.width - e.clientX);
                    }
                }
            });
        }
    };

    // main event binded to column
    return (_e: any) => {
        // mouse down event
        if (event === 'dragstart' && _e.button === 0 && _e.target.tagName === 'SPAN') {
            //save cell ref
            dragCell = getCell();
            dragGroup = getGroup && getGroup();

            lastY = _e.clientY;
            lastX = _e.clientX;

            // register mouseup so we can clean up
            document.addEventListener('mouseup', mouseUp);

            dragColumnBlock = document.createElement('div');
            dragColumnBlock.style.top = -1200 + 'px'; // hide it
            dragColumnBlock.style.left = -1200 + 'px';
            dragColumnBlock.style.height = _connector.config.cellHeight + 'px';
            dragColumnBlock.classList.add('simple-html-grid');
            dragColumnBlock.classList.add('simple-html-grid-drag');
            dragColumnBlock.classList.add('simple-html-grid-cell-label');
            dragColumnBlock.textContent = capalize(getCell().header);

            document.body.appendChild(dragColumnBlock);
            document.addEventListener('mousemove', mouseMove);
        }

        if (dragCell !== null) {
            // not very fancy, but better then nothing
            const drop = (e: any) => {
                if (dragCell !== null) {
                    const daCell = Object.assign({}, dragCell);
                    const doCell = Object.assign({}, getCell());
                    const keys = Object.assign(dragCell, getCell());

                    for (const key in keys) {
                        dragCell[key] = doCell[key];
                        getCell()[key] = daCell[key];
                    }

                    _connector.reRender();

                    e.target.removeEventListener('mouseup', drop);
                    (e.target as any).classList.remove('simple-html-grid-candrop');
                }
            };

            if (event === 'enter' && dragCell && dragCell !== getCell()) {
                if (getCell().type === 'empty') {
                    (_e.target as any).classList.toggle('hideme');
                }

                (_e.target as any).classList.add('simple-html-grid-candrop');
                _e.target.addEventListener('mouseup', drop);
            }

            if (event === 'leave' && dragCell) {
                if (getCell().type === 'empty') {
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
    getGroup: () => GridGroupConfig,
    getCell: () => CellConfig,
    type: 'left' | 'right' | 'top' | 'bottom'
) {
    const up = function (e: any) {
        // loop old columns and remove them
        let oldGroupI: number = null;
        let oldRowI: number = null;
        let newGroupI: number = null;
        let newRowI: number = null;

        const _group = getGroup();
        const _cell = getCell();

        if (dragGroup) {
            _connector.config.groups.forEach((g, i) => {
                if (g === dragGroup) {
                    g.rows.forEach((r, y) => {
                        if (r === dragCell) {
                            oldGroupI = i;
                            oldRowI = y;
                        }
                    });
                    if (g === _group) {
                        newGroupI = i;
                    }
                    if (oldRowI !== null) {
                        g.rows.splice(oldRowI, 1);
                    }
                }
            });
        } else {
            // its column chooser
            let optionsCells: number = null;
            if (_connector.config.optionalCells) {
                _connector.config.optionalCells.forEach((r, i) => {
                    if (r === dragCell) {
                        optionsCells = i;
                    }
                });
                if (optionsCells !== null) {
                    _connector.config.optionalCells.splice(optionsCells, 1);
                }
            }
        }

        // loop new group position and insert
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
        const _cell = getCell();
        if (dragCell && dragCell !== _cell) {
            e.preventDefault();
            (e.target as any).classList.add('simple-html-grid-candrop');
            e.target.addEventListener('mouseup', up);
        }
    };

    const mouseLeave = (e: MouseEvent) => {
        const _cell = getCell();
        if (dragCell && dragCell !== _cell) {
            e.preventDefault();
            (e.target as any).classList.remove('simple-html-grid-candrop');
            e.target.removeEventListener('mouseup', up);
        }
    };

    const el = document.createElement('div');
    el.onmouseenter = mouseEnter;
    el.onmouseleave = mouseLeave;

    switch (type) {
        case 'bottom':
            el.classList.add('simple-html-grid-drop-zone-bottom');
            break;

        case 'top':
            el.classList.add('simple-html-grid-drop-zone-top');
            break;

        case 'left':
            el.classList.add('simple-html-grid-drop-zone-left');
            break;

        case 'right':
            el.classList.add('simple-html-grid-drop-zone-right');
            break;
    }

    return el;
}
