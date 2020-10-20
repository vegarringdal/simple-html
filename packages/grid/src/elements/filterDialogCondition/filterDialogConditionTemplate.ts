import { html } from 'lit-html';
import { FilterArgument } from '../../types';
import { filterDialogGroupTemplate } from '../filterDialogGroupTemplate';
import { deleteBtn } from './deleteBtn';
import { selectAttributeOrInputBtn } from './selectAttributeOrInputBtn';
import { valueInput } from './valueInput';
import { selectOperatorBtn } from './selectOperatorBtn';
import { selectAttributesBtn } from './selectAttributesBtn';

/**
 * returns condition template
 */
export function filterDialogConditionTemplate(
    operatorObjectArr: FilterArgument[],
    ctx: any,
    level: number
): any {
    ctx.width = level + ctx.width;
    if (Array.isArray(operatorObjectArr)) {
        return operatorObjectArr.map((operatorObject, i) => {
            if (operatorObject.type === 'GROUP') {
                return filterDialogGroupTemplate(operatorObject, ctx, level, operatorObjectArr);
            } else {
                return html` <li class="dialog-row">
                    <!-- btn -->
                    ${selectAttributesBtn(operatorObject, ctx)}
                    <!-- btn -->
                    ${selectOperatorBtn(operatorObject, ctx)}
                    <!-- input or btn -->
                    ${operatorObject.valueType === 'VALUE'
                        ? valueInput(operatorObject)
                        : selectAttributesBtn(operatorObject, ctx, true)}
                    <!-- btn -->
                    ${selectAttributeOrInputBtn(operatorObject, ctx)}
                    <!-- btn -->
                    ${deleteBtn(ctx, operatorObjectArr, i)}
                </li>`;
            }
        });
    }
    return '';
}
