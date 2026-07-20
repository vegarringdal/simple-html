import { html, render } from 'lit-html';
import { contextMenuAttributes } from './contextMenuAttributes';
import { contextMenuOperator } from './contextMenuOperator';
import { contextmenuDate } from './contextmenuDate';
import { creatElement } from './createElement';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { removeContextMenu } from './removeContextMenu';
import { attachTooltips, hideTooltip, tooltip, tooltipsEnabled } from './tooltip';
/**
 * internal method to generate html for filter editor
 * @param filterArg
 */
export function renderFilterEditor(ctx, filterArg) {
    /**
     * the dialog is thrown away and rebuilt on every edit, so remember where the user put
     * it and how big they made it, otherwise it jumps back to the middle on every click
     */
    let savedBox = null;
    hideTooltip();
    if (ctx.filterEditorContainer) {
        const previous = ctx.filterEditorContainer.querySelector('.filter-editor-content');
        if (previous?.style.left) {
            savedBox = {
                left: previous.style.left,
                top: previous.style.top,
                width: previous.style.width,
                height: previous.style.height
            };
        }
        document.body.removeChild(ctx.filterEditorContainer);
    }
    /**
     * main container holding data/setting center
     */
    const filterEditorContainer = creatElement('div', 'filter-editor-container');
    if (tooltipsEnabled(ctx)) {
        // data-tooltip is always written, this is what renders the built in tooltip for it
        filterEditorContainer.classList.add('simple-html-grid-tooltips');
        attachTooltips(filterEditorContainer);
    }
    const filterEditorGridCssContext = creatElement('div', 'simple-html-grid');
    filterEditorContainer.appendChild(filterEditorGridCssContext);
    function label(attribute) {
        if (!ctx) {
            return attribute;
        }
        const label = ctx.gridInterface.__getGridConfig().__attributes[attribute].label;
        return label || attribute;
    }
    /**
     * Icon helper
     * @param callback
     * @returns
     */
    const trashIcon = (callback) => {
        return html `<svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="simple-html-grid-icon-group-svg"
            @click=${(e) => callback(e)}
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
        </svg> `;
    };
    /**
     * icon helper, switch between value and aattribute input
     * @param arg
     * @param callback
     * @returns
     */
    const inputSwitchIcon = (arg, callback) => {
        return html `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="simple-html-grid-icon-group-svg"
                @click=${(e) => {
            if (arg.valueType === 'ATTRIBUTE') {
                arg.valueType = 'VALUE';
            }
            else {
                arg.valueType = 'ATTRIBUTE';
            }
            callback(e);
        }}
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                />
            </svg>
        `;
    };
    /**
     * icon helper
     * @param callback
     * @returns
     */
    const addFilterConditionIcon = (callback) => {
        return html `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="simple-html-grid-icon-group-svg"
                @click=${(e) => callback(e)}
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                />
            </svg>
        `;
    };
    /**
     * icon helper
     * @param callback
     * @returns
     */
    const addFilterGroupIcon = (add, callback) => {
        if (add) {
            return html `
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="simple-html-grid-icon-group-svg"
                    @click=${(e) => callback(e)}
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                    />
                </svg>
            `;
        }
        return html `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="simple-html-grid-icon-group-svg"
                @click=${(e) => callback(e)}
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 13.5H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                />
            </svg>
        `;
    };
    /**
     * generate html for condition
     * @param arg
     * @param context
     * @returns
     */
    const condition = (arg, context) => {
        const type = ctx.gridInterface.__getGridConfig().__attributes[arg.attribute]?.type || 'text';
        const attribute = arg.attribute;
        const valueFormater = ctx.gridInterface.getDatasource().getValueFormater();
        const value = valueFormater.fromSource(arg.value, type, attribute, true);
        let filterElement = html `<input
            .value=${value || ''}
            @keydown=${(e) => {
            if (e.key === 'Enter' && type === 'date') {
                setTimeout(() => {
                    contextmenuDate(ctx, e, e.target, valueFormater.toFilter(e.target.value, 'date', attribute, true), (value) => {
                        arg.value = value;
                        renderFilterEditor(ctx, structuredClone(filterArg));
                    });
                }, 2);
            }
        }}
            @input=${(e) => (arg.value = valueFormater.toSource(e.target.value, type, attribute, true))}
            @change=${(e) => (arg.value = valueFormater.toSource(e.target.value, type, attribute, true))}
            @click=${(e) => {
            if (type === 'date') {
                setTimeout(() => {
                    contextmenuDate(ctx, e, e.target, valueFormater.toFilter(e.target.value, 'date', attribute, true), (value) => {
                        arg.value = value;
                        renderFilterEditor(ctx, structuredClone(filterArg));
                    });
                }, 2);
            }
        }}
        />`;
        if (arg.operator === 'IN' || arg.operator === 'NOT_IN') {
            const value = Array.isArray(arg.value) ? arg.value.filter((e) => e !== '').join('\n') : arg.value?.toString();
            filterElement = html `<textarea
                .value=${value || ''}
                @change=${(e) => (arg.value = e.target.value.split('\n').filter((e) => e !== ''))}
            ></textarea>`;
        }
        if (arg.valueType === 'ATTRIBUTE') {
            // we need to get label from config
            const ref = ctx.gridInterface.__getGridConfig().__attributes[`${arg.value}`];
            let label = `${arg.value}`;
            if (label === 'Null') {
                label = '';
            }
            if (label === 'Undefined') {
                label = '';
            }
            if (ref?.label) {
                label = ref.label;
            }
            // same look as the other two pickers, it opens a menu the same way
            filterElement = html `<div
                class="grid-pick grid-text-center"
                data-tooltip=${tooltip(ctx, 'filterEditor.pickValueAttribute')}
                @click=${(e) => {
                e.preventDefault();
                e.stopPropagation();
                contextMenuAttributes(ctx, e, e.target, (attribute) => {
                    removeContextMenu(ctx);
                    arg.value = attribute;
                    renderFilterEditor(ctx, structuredClone(filterArg));
                });
            }}
            >
                ${label || 'Click me to select attribute'}
            </div>`;
        }
        return html `<div>
            <div class="grid-flex-column grid-condition">
                <div class="grid-flex">
                    <div class="grid-flex-1 grid-text-label">Query Field:</div>
                    <div class="grid-flex-1 grid-text-label">Operator:</div>
                    <div class="grid-flex-1 grid-text-label">Filter value:</div>
                </div>
                <div class="grid-flex">
                    <div
                        class="grid-flex-1 grid-text-center grid-pick"
                        data-tooltip=${tooltip(ctx, 'filterEditor.pickAttribute')}
                        @click=${(e) => {
            e.preventDefault();
            e.stopPropagation();
            contextMenuAttributes(ctx, e, e.target, (attribute) => {
                removeContextMenu(ctx);
                arg.attribute = attribute;
                const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];
                arg.attributeType = cellConfig.type || 'text';
                renderFilterEditor(ctx, structuredClone(filterArg));
            });
        }}
                    >
                        ${arg.attribute ? label(arg.attribute) : 'Click me to select field'}
                    </div>

                    <div
                        class="grid-flex-1 grid-text-center grid-pick"
                        data-tooltip=${tooltip(ctx, 'filterEditor.pickOperator')}
                        @click=${(e) => {
            e.preventDefault();
            e.stopPropagation();
            contextMenuOperator(ctx, e, e.target, (operator) => {
                removeContextMenu(ctx);
                arg.operator = operator.replaceAll(' ', '_').toUpperCase();
                renderFilterEditor(ctx, structuredClone(filterArg));
            });
        }}
                    >
                        ${arg.operator
            ? arg.operator
                .split('_')
                .map((e) => e[0].toUpperCase() + e.substring(1, e.length).toLowerCase())
                .join(' ')
            : 'Click me to select Operator'}
                    </div>
                    <div class="grid-flex-1 grid-text-center ">${filterElement}</div>
                </div>
                <div class="grid-flex-reverse grid-m-4">
                    <div class="grid-m-4" data-tooltip=${tooltip(ctx, 'filterEditor.deleteCondition')}>
                        ${trashIcon(() => {
            let x = null;
            context.forEach((row, i) => {
                if (row === arg) {
                    x = i;
                }
            });
            context.splice(x, 1);
            renderFilterEditor(ctx, structuredClone(filterArg));
        })}
                    </div>
                    <div
                        class="grid-m-4"
                        data-tooltip=${tooltip(ctx, arg.valueType === 'ATTRIBUTE' ? 'filterEditor.useValue' : 'filterEditor.useAttribute')}
                    >
                        ${inputSwitchIcon(arg, () => {
            renderFilterEditor(ctx, structuredClone(filterArg));
        })}
                    </div>
                </div>
            </div>
        </div>`;
    };
    /**
     * generate html for group
     * @param arg
     * @param context
     * @returns
     */
    const group = (arg, context) => {
        // collect all conditions, and inject them into html
        const conditions = arg.filterArguments?.filter((e) => e.type !== 'GROUP').map((e) => condition(e, arg.filterArguments)) || [];
        // collect all groups, and inject them into html
        const groupsArgs = arg.filterArguments?.filter((e) => e.type === 'GROUP').map((e) => group(e, arg.filterArguments)) || [];
        return html `<div>
            <div class="grid-flex-column grid-sub-group">
                <div class="grid-flex grid-group">
                    <div class="grid-flex grid-m-4">
                        <div
                            class="grid-m-4 grid-button-small grid-text-center grid-text-label"
                            data-tooltip=${tooltip(ctx, arg.logicalOperator === 'AND' ? 'filterEditor.operatorAnd' : 'filterEditor.operatorOr')}
                            @click=${() => {
            arg.logicalOperator = arg.logicalOperator === 'AND' ? 'OR' : 'AND';
            renderFilterEditor(ctx, structuredClone(filterArg));
        }}
                        >
                            <span> ${arg.logicalOperator}</span>
                        </div>
                        <div class="grid-m-4" data-tooltip=${tooltip(ctx, 'filterEditor.wrapGroup')}>
                            ${addFilterGroupIcon(false, () => {
            const oldFilters = arg.filterArguments;
            arg.filterArguments = [
                {
                    type: 'GROUP',
                    logicalOperator: 'AND',
                    filterArguments: oldFilters
                }
            ];
            renderFilterEditor(ctx, structuredClone(filterArg));
        })}
                        </div>
                        <div class="grid-m-4" data-tooltip=${tooltip(ctx, 'filterEditor.addSubGroup')}>
                            ${addFilterGroupIcon(true, () => {
            arg.filterArguments.push({
                type: 'GROUP',
                logicalOperator: 'AND',
                filterArguments: []
            });
            renderFilterEditor(ctx, structuredClone(filterArg));
        })}
                        </div>
                        <div class="grid-m-4" data-tooltip=${tooltip(ctx, 'filterEditor.addCondition')}>
                            ${addFilterConditionIcon(() => {
            arg.filterArguments.push({
                type: 'CONDITION'
            });
            renderFilterEditor(ctx, structuredClone(filterArg));
        })}
                        </div>
                        <div
                            class="grid-m-4"
                            data-tooltip=${tooltip(ctx, context ? 'filterEditor.deleteGroup' : 'filterEditor.clearAll')}
                        >
                            ${trashIcon(() => {
            if (context) {
                let x = null;
                context.forEach((row, i) => {
                    if (row === arg) {
                        x = i;
                    }
                });
                context.splice(x, 1);
                renderFilterEditor(ctx, structuredClone(filterArg));
            }
            else {
                arg.filterArguments = [];
                renderFilterEditor(ctx, structuredClone(filterArg));
            }
        })}
                        </div>
                    </div>
                </div>
                <div class="grid-flex-column grid-sub-group ">${conditions}</div>
                ${groupsArgs}
            </div>
        </div>`;
    };
    /**
     * closes the dialog, used by the titlebar X and the Close button
     */
    const closeEditor = () => {
        removeContextMenu(ctx);
        hideTooltip();
        filterEditorContainer.parentElement?.removeChild(filterEditorContainer);
        ctx.filterEditorContainer = null;
    };
    const headerTemplate = () => html `<div class="grid-text-title filter-editor-titlebar">
        <span data-tooltip=${tooltip(ctx, 'filterEditor.title')}>Filter Editor</span>
        <span class="filter-editor-close" data-tooltip=${tooltip(ctx, 'filterEditor.close')} @click=${() => closeEditor()}>&#10005;</span>
    </div>`;
    const clearOldValues = () => {
        ctx.gridInterface.__getGridConfig().attributes.forEach((e) => {
            e.currentFilterValue = '';
        });
    };
    const footerTemplate = () => {
        return html `<div class="grid-flex-reverse grid-m-4 filter-editor-footer">
            <div
                class="grid-button grid-text-center grid-button-primary"
                data-tooltip=${tooltip(ctx, 'filterEditor.filterAndClose')}
                @click=${() => {
            removeContextMenu(ctx);
            closeEditor();
            ctx.gridInterface.getDatasource().filter(JSON.parse(JSON.stringify(filterArg)));
            clearOldValues();
            rebuildHeaderColumns(ctx);
        }}
            >
                Filter & Close
            </div>
            <div
                class="grid-button grid-text-center"
                data-tooltip=${tooltip(ctx, 'filterEditor.filterOnly')}
                @click=${() => {
            removeContextMenu(ctx);
            ctx.gridInterface.getDatasource().filter(JSON.parse(JSON.stringify(filterArg)));
            clearOldValues();
            rebuildHeaderColumns(ctx);
        }}
            >
                Filter Only
            </div>
            <div
                class="grid-button grid-text-center"
                data-tooltip=${tooltip(ctx, 'filterEditor.closeButton')}
                @click=${() => closeEditor()}
            >
                Close
            </div>
        </div>`;
    };
    /**
     * grab areas for resizing, one per edge and one per corner.
     * css `resize` only gives the bottom right corner, so these are wired up by hand.
     */
    const resizeHandles = () => html `
        <div class="simple-html-resize-handle handle-n"></div>
        <div class="simple-html-resize-handle handle-s"></div>
        <div class="simple-html-resize-handle handle-w"></div>
        <div class="simple-html-resize-handle handle-e"></div>
        <div class="simple-html-resize-handle handle-nw"></div>
        <div class="simple-html-resize-handle handle-ne"></div>
        <div class="simple-html-resize-handle handle-sw"></div>
        <div class="simple-html-resize-handle handle-se"></div>
    `;
    /**
     * render dialog
     */
    render(html `<div class="filter-editor-content">
            <div class="grid-flex-column grid-w-full grid-h-full">
                ${headerTemplate()}
                <div class="grid-overflow-auto grid-flex-1 simple-html-dialog-scroller">${group(filterArg, null)}</div>
                ${footerTemplate()}
            </div>
            ${resizeHandles()}
        </div>`, filterEditorGridCssContext);
    document.body.appendChild(filterEditorContainer);
    ctx.filterEditorContainer = filterEditorContainer;
    /**
     * position + size.
     * The css only gives a default size, left/top are set here so the dialog can be
     * dragged and resized without fighting a translate(-50%, -50%).
     */
    const content = filterEditorGridCssContext.querySelector('.filter-editor-content');
    if (content) {
        if (savedBox) {
            content.style.left = savedBox.left;
            content.style.top = savedBox.top;
            content.style.width = savedBox.width;
            content.style.height = savedBox.height;
        }
        else {
            // first open, center it on the viewport
            content.style.left = `${Math.max(0, Math.round((window.innerWidth - content.offsetWidth) / 2))}px`;
            content.style.top = `${Math.max(0, Math.round((window.innerHeight - content.offsetHeight) / 2))}px`;
        }
        makeDialogDraggable(content, content.querySelector('.filter-editor-titlebar'));
        makeDialogResizable(content);
    }
}
/**
 * resize from any edge or corner.
 *
 * Each handle says which edges it moves: dragging a west or north edge has to move
 * left/top as well as the size, otherwise the opposite edge would walk across the screen.
 */
function makeDialogResizable(dialog) {
    const edges = {
        'handle-n': { north: true, south: false, west: false, east: false },
        'handle-s': { north: false, south: true, west: false, east: false },
        'handle-w': { north: false, south: false, west: true, east: false },
        'handle-e': { north: false, south: false, west: false, east: true },
        'handle-nw': { north: true, south: false, west: true, east: false },
        'handle-ne': { north: true, south: false, west: false, east: true },
        'handle-sw': { north: false, south: true, west: true, east: false },
        'handle-se': { north: false, south: true, west: false, east: true }
    };
    dialog.querySelectorAll('.simple-html-resize-handle').forEach((handle) => {
        const side = Object.keys(edges).find((name) => handle.classList.contains(name));
        if (!side) {
            return;
        }
        const edge = edges[side];
        handle.addEventListener('mousedown', (event) => {
            if (event.button !== 0) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const startX = event.clientX;
            const startY = event.clientY;
            const rect = dialog.getBoundingClientRect();
            const style = window.getComputedStyle(dialog);
            const minWidth = Number.parseInt(style.minWidth, 10) || 200;
            const minHeight = Number.parseInt(style.minHeight, 10) || 120;
            const mousemove = (e) => {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                if (edge.east) {
                    dialog.style.width = `${Math.max(minWidth, rect.width + dx)}px`;
                }
                if (edge.west) {
                    // clamp the width first, so the left edge stops instead of pushing past it
                    const width = Math.max(minWidth, rect.width - dx);
                    dialog.style.width = `${width}px`;
                    dialog.style.left = `${Math.round(rect.left + (rect.width - width))}px`;
                }
                if (edge.south) {
                    dialog.style.height = `${Math.max(minHeight, rect.height + dy)}px`;
                }
                if (edge.north) {
                    const height = Math.max(minHeight, rect.height - dy);
                    dialog.style.height = `${height}px`;
                    dialog.style.top = `${Math.round(rect.top + (rect.height - height))}px`;
                }
            };
            const mouseup = () => {
                document.removeEventListener('mousemove', mousemove);
                document.removeEventListener('mouseup', mouseup);
            };
            document.addEventListener('mousemove', mousemove);
            document.addEventListener('mouseup', mouseup);
        });
    });
}
/**
 * drag the dialog around by its titlebar, kept inside the window
 */
function makeDialogDraggable(dialog, handle) {
    if (!handle) {
        return;
    }
    handle.addEventListener('mousedown', (event) => {
        // let the close button in the titlebar do its own thing
        if (event.button !== 0 || event.target?.classList.contains('filter-editor-close')) {
            return;
        }
        event.preventDefault();
        const startX = event.clientX;
        const startY = event.clientY;
        const rect = dialog.getBoundingClientRect();
        const mousemove = (e) => {
            // keep a bit of the dialog on screen so it can always be grabbed again
            const left = Math.min(Math.max(rect.left + e.clientX - startX, 20 - rect.width), window.innerWidth - 40);
            const top = Math.min(Math.max(rect.top + e.clientY - startY, 0), window.innerHeight - 30);
            dialog.style.left = `${Math.round(left)}px`;
            dialog.style.top = `${Math.round(top)}px`;
        };
        const mouseup = () => {
            document.removeEventListener('mousemove', mousemove);
            document.removeEventListener('mouseup', mouseup);
        };
        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);
    });
}
//# sourceMappingURL=renderFilterEditor.js.map