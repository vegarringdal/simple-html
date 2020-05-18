import { html } from 'lit-html';
import { CellConfig, FilterArgument } from '../../types';
import { generateMenu } from '../generateMenu';

/**
 * returns list if attributes from config
 */
export function selectAttributesBtn(operatorObject: FilterArgument, ctx: any, isValue?: boolean) {
    return html` <button
        class="dialog-item-y"
        @click=${(e: any) => {
            generateMenu(
                e,
                ctx.filterAttributes.map((e: CellConfig) => {
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
