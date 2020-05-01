import { html } from 'lit-html';
import { OperatorObject } from '../interfaces';
import { filterDialogConditionTemplate } from './filterDialogConditionTemplate';
import { generateMenu } from './generateMenu';
export function filterDialogGroupTemplate(
    g: OperatorObject,
    ctx: any,
    level: number,
    parent?: any[]
) {
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
        ${filterDialogConditionTemplate(g.operatorObject, ctx, level + 10)}
    `;
}
