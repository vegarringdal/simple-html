/* eslint-disable @typescript-eslint/no-use-before-define */
import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { ICell } from '../interfaces';

@customElement('simple-html-grid-filter-dialog')
export default class extends HTMLElement {
    connector: GridInterface;
    cell: ICell;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        /* (this.classList as any) = 'simple-html-grid simple-html-grid-menu';
        document.addEventListener('click', this);
        this.ref.addEventListener('vertical-scroll', this);
        setTimeout(() => {
            document.addEventListener('contextmenu', this);
        }, 50); */
    }

    render() {
        return html`<div class="simple-html-grid simple-html-filter-dialog">
            ${group(x, this, 0)}
        </div>`;
    }
}

type GroupType = 'AND' | 'OR' | 'NONE';
type ObjectType = 'CONDITION' | 'GROUP';
type ValueType = 'ATTRIBUTE' | 'VALUE';
type Operator = '==' | '=>' | '=<' | '>' | '<' | '*=' | '=*' | 'IN' | null;
type OperatorObject = {
    type: ObjectType;
    groupType: GroupType;
    attribute: string | null;
    operator: Operator | null;
    value: string | null;
    valueType: ValueType | null;
    operatorObject?: OperatorObject[];
};

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
                @click=${() => {
                    g.operatorObject.push({
                        type: 'CONDITION',
                        groupType: 'NONE',
                        attribute: 'job',
                        operator: '==',
                        valueType: 'VALUE',
                        value: 'wow'
                    });
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
                    <path d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </button>
            <button
                class="dialog-item-x"
                style="width:15px"
                @click=${() => {
                    parent && parent.splice(parent.indexOf(g), 1);
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
    if (Array.isArray(g)) {
        return g.map((element, i) => {
            if (element.type === 'GROUP') {
                return group(element, ctx, level, g);
            } else {
                return html` <div class="dialog-row">
                    <div style="width:${level}px" class="dialog-item-block"></div>
                    <div class="dialog-item">
                        <button class="dialog-item-y">${element.attribute}</button>
                        <button class="dialog-item-y"><b>${element.operator}</b></button>
                        ${element.valueType === 'VALUE'
                            ? html`<input
                                  class="dialog-item-y"
                                  style="text-align: center;"
                                  value=${element.value}
                                  @input=${(e: any) => {
                                      element.value = e.target.value;
                                  }}
                              />`
                            : html`<button class="dialog-item-y">${element.attribute}</button> `}

                        <button class="dialog-item-x" style="width:15px">
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

export const x: OperatorObject = {
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
