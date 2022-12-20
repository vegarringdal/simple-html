import { html, TemplateResult, render } from 'lit-html';
import { FilterArgument } from '../../datasource/filterArgument';
import { contextMenuAttributes } from './contextMenuAttributes';
import { contextMenuOperator } from './contextMenuOperator';
import { creatElement } from './createElement';
import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { removeContextMenu } from './removeContextMenu';

/**
 * internal method to generate html for filter editor
 * @param filterArg
 */
export function renderFilterEditor(ctx: Grid, filterArg: FilterArgument) {
    if (ctx.filterEditorContainer) {
        document.body.removeChild(ctx.filterEditorContainer);
    }
    /**
     * main container holding data/setting center
     */
    const filterEditorContainer = creatElement('div', 'filter-editor-container');
    const filterEditorGridCssContext = creatElement('div', 'simple-html-grid');
    filterEditorContainer.appendChild(filterEditorGridCssContext);

    /**
     * Icon helper
     * @param callback
     * @returns
     */
    const trashIcon = (callback: (e: any) => void) => {
        return html`<svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="simple-html-grid-icon-group-svg"
            @click=${(e: any) => callback(e)}
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
    const inputSwitchIcon = (arg: FilterArgument, callback: (e: any) => void) => {
        return html`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="simple-html-grid-icon-group-svg"
                @click=${(e: any) => {
                    if (arg.valueType === 'ATTRIBUTE') {
                        arg.valueType = 'VALUE';
                    } else {
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
    const addFilterConditionIcon = (callback: (e: any) => void) => {
        return html`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="simple-html-grid-icon-group-svg"
                @click=${(e: any) => callback(e)}
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
    const addFilterGroupIcon = (callback: (e: any) => void) => {
        return html`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="simple-html-grid-icon-group-svg"
                @click=${(e: any) => callback(e)}
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
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
    const condition = (arg: FilterArgument, context: FilterArgument[]) => {
        let filterValue = html`<input
            .value=${arg.value || ''}
            @input=${(e: any) => (arg.value = e.target.value)}
            @change=${(e: any) => (arg.value = e.target.value)}
        />`;

        if (arg.operator === 'IN' || arg.operator === 'NOT_IN') {
            const value = Array.isArray(arg.value) ? arg.value.filter((e) => e !== '').join('\n') : arg.value?.toString();

            filterValue = html`<textarea
                .value=${value || ''}
                @change=${(e: any) => (arg.value = e.target.value.split('\n').filter((e: string) => e !== ''))}
            ></textarea>`;
        }

        if (arg.valueType === 'ATTRIBUTE') {
            filterValue = html`<div
                @click=${(e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    contextMenuAttributes(ctx, e, e.target as any, (attribute) => {
                        arg.value = attribute;
                        renderFilterEditor(ctx, structuredClone(filterArg));
                    });
                }}
            >
                ${arg.value || 'Click me to select attribute'}
            </div>`;
        }

        return html`<div>
            <div class="grid-flex-column grid-condition">
                <div class="grid-flex">
                    <div class="grid-flex-1 grid-text-label">Query Field:</div>
                    <div class="grid-flex-1 grid-text-label">Operator:</div>
                    <div class="grid-flex-1 grid-text-label">Filter value:</div>
                </div>
                <div class="grid-flex">
                    <div
                        class="grid-flex-1 grid-text-center"
                        @click=${(e: MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            contextMenuAttributes(ctx, e, e.target as HTMLCellElement, (attribute) => {
                                arg.attribute = attribute;

                                const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];
                                arg.attributeType = cellConfig.type || 'text';
                                renderFilterEditor(ctx, structuredClone(filterArg));
                            });
                        }}
                    >
                        ${arg.attribute ? arg.attribute : 'Click me to select field'}
                    </div>

                    <div
                        class="grid-flex-1 grid-text-center"
                        @click=${(e: MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            contextMenuOperator(ctx, e, e.target as HTMLCellElement, (operator) => {
                                arg.operator = operator.replaceAll(' ', '_').toUpperCase() as any;

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
                    <div class="grid-flex-1 grid-text-center ">${filterValue}</div>
                </div>
                <div class="grid-flex-reverse grid-m-4">
                    <div class="grid-m-4">
                        ${trashIcon(() => {
                            let x: number = null;
                            context.forEach((row, i) => {
                                if (row === arg) {
                                    x = i;
                                }
                            });
                            context.splice(x, 1);
                            renderFilterEditor(ctx, structuredClone(filterArg));
                        })}
                    </div>
                    <div class="grid-m-4">
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
    const group = (arg: FilterArgument, context: FilterArgument[]): TemplateResult<1> => {
        // collect all conditions, and inject them into html

        const conditions =
            arg.filterArguments?.filter((e) => e.type !== 'GROUP').map((e) => condition(e, arg.filterArguments)) || [];

        // collect all groups, and inject them into html
        const groupsArgs = arg.filterArguments?.filter((e) => e.type === 'GROUP').map((e) => group(e, arg.filterArguments)) || [];

        return html`<div>
            <div class="grid-flex-column grid-sub-group">
                <div class="grid-flex grid-group">
                    <div class="grid-flex grid-m-4">
                        <div
                            class="grid-m-4 grid-button-small grid-text-center grid-text-label"
                            @click=${() => {
                                arg.logicalOperator = arg.logicalOperator === 'AND' ? 'OR' : 'AND';
                                renderFilterEditor(ctx, structuredClone(filterArg));
                            }}
                        >
                            <span> ${arg.logicalOperator}</span>
                        </div>
                        <div class="grid-m-4">
                            ${addFilterGroupIcon(() => {
                                arg.filterArguments.push({
                                    type: 'GROUP',
                                    logicalOperator: 'AND',
                                    filterArguments: []
                                });
                                renderFilterEditor(ctx, structuredClone(filterArg));
                            })}
                        </div>
                        <div class="grid-m-4">
                            ${addFilterConditionIcon(() => {
                                arg.filterArguments.push({
                                    type: 'CONDITION'
                                });
                                renderFilterEditor(ctx, structuredClone(filterArg));
                            })}
                        </div>
                        <div class="grid-m-4">
                            ${trashIcon(() => {
                                if (context) {
                                    let x: number = null;
                                    context.forEach((row, i) => {
                                        if (row === arg) {
                                            x = i;
                                        }
                                    });
                                    context.splice(x, 1);
                                    renderFilterEditor(ctx, structuredClone(filterArg));
                                } else {
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

    const headerTemplate = () => html`<div class="grid-text-title">Filter Editor</div>`;

    const footerTemplate = () => {
        return html`<div class="grid-flex-reverse grid-m-4">
            <div
                class="grid-button grid-text-center"
                @click=${() => {
                    removeContextMenu(ctx);
                    filterEditorContainer.parentElement.removeChild(filterEditorContainer);
                    ctx.filterEditorContainer = null;
                    ctx.gridInterface.getDatasource().filter(JSON.parse(JSON.stringify(filterArg)));
                }}
            >
                Filter & Close
            </div>
            <div
                class="grid-button grid-text-center"
                @click=${() => {
                    removeContextMenu(ctx);
                    ctx.gridInterface.getDatasource().filter(JSON.parse(JSON.stringify(filterArg)));
                }}
            >
                Filter Only
            </div>
            <div
                class="grid-button grid-text-center"
                @click=${() => {
                    removeContextMenu(ctx);
                    filterEditorContainer.parentElement.removeChild(filterEditorContainer);
                    ctx.filterEditorContainer = null;
                }}
            >
                Close
            </div>
        </div>`;
    };

    /**
     * render dialog
     */
    render(
        html`<div class="filter-editor-content">
            <div class="grid-flex-column grid-w-full grid-h-full">
                ${headerTemplate()}
                <div class="grid-overflow-auto grid-flex-1 simple-html-dialog-scroller">${group(filterArg, null)}</div>
                ${footerTemplate()}
            </div>
        </div>`,
        filterEditorGridCssContext
    );

    document.body.appendChild(filterEditorContainer);

    ctx.filterEditorContainer = filterEditorContainer;
}
