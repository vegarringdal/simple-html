import { html } from 'lit-html';
import { ICell, OperatorObject } from '../interfaces';
import { OPERATORS } from './simple-html-grid-filter-dialog';
import { generateMenu } from './generateMenu';
import { filterDialogGroupTemplate } from './filterDialogGroupTemplate';

export function filterDialogConditionTemplate(g: OperatorObject[], ctx: any, level: number): any {
    ctx.width = level + ctx.width;
    if (Array.isArray(g)) {
        return g.map((element, i) => {
            if (element.type === 'GROUP') {
                return filterDialogGroupTemplate(element, ctx, level, g);
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
