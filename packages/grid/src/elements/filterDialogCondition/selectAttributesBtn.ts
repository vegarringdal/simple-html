import { html } from 'lit-html';
import { ICell, OperatorObject } from '../../interfaces';
import { generateMenu } from '../generateMenu';

/**
 * returns list if attributes from config
 */
export function selectAttributesBtn(operatorObject: OperatorObject, ctx: any, isValue?: boolean) {
    return html` <button
        class="dialog-item-y"
        @click=${(e: any) => {
            generateMenu(
                e,
                ctx.filterAttributes.map((e: ICell) => {
                    return {
                        title: e.attribute,
                        callback: () => {
                            if (isValue) {
                                operatorObject.value = e.attribute;
                            } else {
                                operatorObject.attribute = e.attribute;
                            }
                            operatorObject.attributeType = e.type;
                            ctx.render();
                        }
                    };
                })
            );
        }}
    >
        ${operatorObject.attribute}
    </button>`;
}
