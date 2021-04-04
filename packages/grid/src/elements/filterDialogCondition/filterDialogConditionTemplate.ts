import { FilterArgument } from '../../types';
import { filterDialogGroupTemplate } from '../filterDialogGroupTemplate';
import { deleteBtn } from './deleteBtn';
import { selectAttributeOrInputBtn } from './selectAttributeOrInputBtn';
import { valueInput } from './valueInput';
import { selectOperatorBtn } from './selectOperatorBtn';
import { selectAttributesBtn } from './selectAttributesBtn';
import { SimpleHtmlGridFilterDialog } from '../simple-html-grid-filter-dialog';

/**
 * returns condition template
 */
export function filterDialogConditionTemplate(
    operatorObjectArr: FilterArgument[],
    ctx: SimpleHtmlGridFilterDialog,
    level: number
): HTMLElement[] | null {
    ctx.width = level + ctx.width;
    if (Array.isArray(operatorObjectArr)) {
        return operatorObjectArr.map((operatorObject, i) => {
            if (operatorObject.type === 'GROUP') {
                return filterDialogGroupTemplate(operatorObject, ctx, level, operatorObjectArr);
            } else {
                const el = document.createElement('li');
                el.classList.add('dialog-row');
                el.appendChild(selectAttributesBtn(operatorObject, ctx));
                el.appendChild(selectOperatorBtn(operatorObject, ctx));
                if (
                    operatorObject.operator !== 'IS_BLANK' &&
                    operatorObject.operator !== 'IS_NOT_BLANK'
                ) {
                    el.appendChild(
                        operatorObject.valueType === 'VALUE'
                            ? valueInput(operatorObject, ctx)
                            : selectAttributesBtn(operatorObject, ctx, true)
                    );
                }

                el.appendChild(selectAttributeOrInputBtn(operatorObject, ctx));
                el.appendChild(deleteBtn(ctx, operatorObjectArr, i));

                return el;
            }
        });
    }
    return null;
}
