/* eslint-disable @typescript-eslint/no-use-before-define */
import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { ICell, OperatorObject } from '../interfaces';

function generateMenu(event: any, rows: any[]) {
    const menu = document.createElement('simple-html-grid-menu-custom');
    menu.style.top = event.clientY + document.documentElement.scrollTop + 'px'; // hide it
    menu.style.left = event.clientX + document.documentElement.scrollLeft + 'px';
    (menu as any).rows = rows;

    document.body.appendChild(menu);
}

const OPERATORS = {
    EQUAL: '===',
    LESS_THAN_OR_EQUAL_TO: '<=',
    GREATER_THAN_OR_EQUAL_TO: '>=',
    LESS_THAN: '<',
    GREATER_THAN: '>',
    CONTAINS: '*',
    NOT_EQUAL_TO: '!==',
    DOES_NOT_CONTAIN: '!*',
    BEGIN_WITH: 'x*',
    END_WITH: '*x'
};

@customElement('simple-html-grid-filter-dialog')
export default class extends HTMLElement {
    connector: GridInterface;
    cell: ICell;
    ref: SimpleHtmlGrid;
    width: number;
    filterAttributes: ICell[];
    filter: OperatorObject;

    connectedCallback() {
        this.filter = this.connector.__arrayUtils.getCurrentFilter() || {
            type: 'GROUP',
            groupType: 'AND',
            attribute: null,
            operator: null,
            valueType: null,
            value: null,
            attributeType: 'text',
            operatorObject: []
        };
        (this.classList as any) = 'simple-html-grid simple-html-grid-menu';
        this.filterAttributes = this.connector.config.groups.flatMap((y) => y.rows);
    }

    handleEvent(e: any) {
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    render() {
        return html`<div style="width:550px" class="simple-html-grid simple-html-filter-dialog">
            <div class="dialog-row main-group">
                <button
                    class="dialog-item-x"
                    @click=${() => {
                        this.removeSelf();
                    }}
                >
                    <b> Close</b>
                </button>
                <button
                    class="dialog-item-x"
                    @click=${() => {
                        this.connector.__arrayUtils.arrayFilter.setLastFilter(this.filter);
                        this.connector.__arrayUtils.reRunFilter();
                        this.removeSelf();
                    }}
                >
                    <b> Query & close</b>
                </button>
                <button
                    class="dialog-item-x"
                    @click=${() => {
                        this.connector.__arrayUtils.arrayFilter.setLastFilter(this.filter);
                        this.connector.__arrayUtils.reRunFilter();
                    }}
                >
                    <b> Query only</b>
                </button>
            </div>

            ${group(this.filter, this, 0)}
        </div>`;
    }
}

function group(g: OperatorObject, ctx: any, level: number, parent?: any[]) {
    return html`
        <div class="dialog-row main-group">
            <div style="width:${level}px" class="dialog-item-block"></div>
            <button
                class="dialog-item-x"
                @click=${() => {
                    g.groupType = g.groupType === 'AND' ? 'OR' : 'AND';
                    ctx.render();
                }}
            >
                <b> ${g.groupType}</b>
            </button>

            <button
                class="dialog-item-x"
                style="width:15px"
                @click=${(e: any) => {
                    generateMenu(e, [
                        {
                            title: 'Add Group',
                            callback: () => {
                                g.operatorObject.push({
                                    type: 'GROUP',
                                    groupType: 'AND',
                                    attribute: 'select',
                                    operator: 'EQUAL',
                                    valueType: 'VALUE',
                                    attributeType: 'text',
                                    operatorObject: [],
                                    value: ''
                                });
                                ctx.render();
                            }
                        },
                        {
                            title: 'Add condition',
                            callback: () => {
                                g.operatorObject.push({
                                    type: 'CONDITION',
                                    groupType: 'NONE',
                                    attribute: 'select',
                                    operator: 'EQUAL',
                                    valueType: 'VALUE',
                                    attributeType: 'text',
                                    operatorObject: [],
                                    value: ''
                                });
                                ctx.render();
                            }
                        }
                    ]);
                }}
            >
                <svg
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </button>
            <button
                class="dialog-item-x"
                style="width:15px"
                @click=${() => {
                    parent && parent.splice(parent.indexOf(g), 1);
                    if (!parent) {
                        g.operatorObject = [];
                    }
                    ctx.render();
                }}
            >
                <svg
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    ></path>
                </svg>
            </button>
        </div>
        ${condition(g.operatorObject, ctx, level + 10)}
    `;
}

function condition(g: OperatorObject[], ctx: any, level: number): any {
    ctx.width = level + ctx.width;
    if (Array.isArray(g)) {
        return g.map((element, i) => {
            if (element.type === 'GROUP') {
                return group(element, ctx, level, g);
            } else {
                return html` <div class="dialog-row">
                    <div style="width:${level}px" class="dialog-item-block"></div>
                    <div class="dialog-item">
                        <button
                            class="dialog-item-y"
                            @click=${(e: any) => {
                                generateMenu(
                                    e,
                                    ctx.filterAttributes.map((e: ICell) => {
                                        return {
                                            title: e.attribute,
                                            callback: () => {
                                                element.attribute = e.attribute;
                                                element.attributeType = e.type;
                                                ctx.render();
                                            }
                                        };
                                    })
                                );
                            }}
                        >
                            ${element.attribute}
                        </button>
                        <button
                            class="dialog-item-y"
                            @click=${(e: any) => {
                                generateMenu(e, [
                                    {
                                        title: 'BEGIN WITH',
                                        callback: () => {
                                            element.operator = 'BEGIN_WITH';
                                            ctx.render();
                                        }
                                    },
                                    {
                                        title: 'EQUAL',
                                        callback: () => {
                                            element.operator = 'EQUAL';
                                            ctx.render();
                                        }
                                    },
                                    {
                                        title: 'CONTAINS',
                                        callback: () => {
                                            element.operator = 'CONTAINS';
                                            ctx.render();
                                        }
                                    },
                                    {
                                        title: 'DOES NOT CONTAIN',
                                        callback: () => {
                                            element.operator = 'DOES_NOT_CONTAIN';
                                            ctx.render();
                                        }
                                    },
                                    {
                                        title: 'END WITH',
                                        callback: () => {
                                            element.operator = 'END_WITH';
                                            ctx.render();
                                        }
                                    },
                                    {
                                        title: 'GREATER THAN',
                                        callback: () => {
                                            element.operator = 'GREATER_THAN';
                                            ctx.render();
                                        }
                                    },
                                    {
                                        title: 'LESS THAN',
                                        callback: () => {
                                            element.operator = 'LESS_THAN';
                                            ctx.render();
                                        }
                                    },
                                    {
                                        title: 'LESS THAN OR EQUAL TO',
                                        callback: () => {
                                            element.operator = 'LESS_THAN_OR_EQUAL_TO';
                                            ctx.render();
                                        }
                                    },
                                    {
                                        title: 'NOT EQUAL TO',
                                        callback: () => {
                                            element.operator = 'NOT_EQUAL_TO';
                                            ctx.render();
                                        }
                                    }
                                ]);
                            }}
                        >
                            <b>${OPERATORS[element.operator]}</b>
                        </button>
                        ${element.valueType === 'VALUE'
                            ? html`<input
                                  class="dialog-item-y"
                                  style="text-align: center;"
                                  value=${element.value}
                                  @input=${(e: any) => {
                                      element.value = e.target.value;
                                  }}
                              />`
                            : html`<button
                                  class="dialog-item-y"
                                  @click=${(e: any) => {
                                      generateMenu(
                                          e,
                                          ctx.filterAttributes.map((e: ICell) => {
                                              return {
                                                  title: e.attribute,
                                                  callback: () => {
                                                      element.value = e.attribute;
                                                      element.attributeType = e.type;
                                                      ctx.render();
                                                  }
                                              };
                                          })
                                      );
                                  }}
                              >
                                  ${element.value}
                              </button> `}

                        <button
                            class="dialog-item-x"
                            style="width:15px"
                            @click=${() => {
                                g[i].valueType =
                                    element.valueType === 'VALUE' ? 'ATTRIBUTE' : 'VALUE';
                                ctx.render();
                            }}
                        >
                            <svg
                                fill="none"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                ></path>
                            </svg>
                        </button>
                        <button
                            class="dialog-item-x"
                            style="width:15px"
                            @click=${() => {
                                g && g.splice(i, 1);
                                ctx.render();
                            }}
                        >
                            <svg
                                fill="none"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                ></path>
                            </svg>
                        </button>
                    </div>
                </div>`;
            }
        });
    }
    return '';
}

/* export const x: OperatorObject = {
    type: 'GROUP',
    groupType: 'AND',
    attribute: null,
    operator: null,
    valueType: null,
    value: null,
    operatorObject: [
        {
            type: 'CONDITION',
            groupType: 'NONE',
            attribute: 'job',
            operator: '==',
            valueType: 'VALUE',
            value: 'wow'
        },
        {
            type: 'CONDITION',
            groupType: 'NONE',
            attribute: 'job',
            operator: 'IN',
            valueType: 'VALUE',
            value: 'cool\nwow\nshit'
        },

        {
            type: 'CONDITION',
            groupType: 'NONE',
            attribute: 'job',
            operator: 'IN',
            valueType: 'VALUE',
            value: 'cool\nwow\nshit'
        },
        {
            type: 'GROUP',
            groupType: 'OR',
            attribute: null,
            operator: null,
            valueType: null,
            value: null,
            operatorObject: [
                {
                    type: 'CONDITION',
                    groupType: 'NONE',
                    attribute: 'job',
                    operator: '==',
                    valueType: 'VALUE',
                    value: 'wow1'
                },
                {
                    type: 'CONDITION',
                    groupType: 'NONE',
                    attribute: 'job',
                    operator: '==',
                    valueType: 'VALUE',
                    value: 'wow2'
                },
                {
                    type: 'CONDITION',
                    groupType: 'NONE',
                    attribute: 'job',
                    operator: '==',
                    valueType: 'ATTRIBUTE',
                    value: 'job'
                },
                {
                    type: 'CONDITION',
                    groupType: 'NONE',
                    attribute: 'job',
                    operator: '==',
                    valueType: 'VALUE',
                    value: 'cool4'
                }
            ]
        }
    ]
};
 */
