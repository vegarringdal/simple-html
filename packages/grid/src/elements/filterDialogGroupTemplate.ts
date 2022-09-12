import { FilterArgument } from '../types';
import { filterDialogConditionTemplate } from './filterDialogCondition/filterDialogConditionTemplate';
import { generateMenu } from './generateMenu';
import { SimpleHtmlGridFilterDialog } from './simple-html-grid-filter-dialog';

export function filterDialogGroupTemplate(
    g: FilterArgument,
    ctx: SimpleHtmlGridFilterDialog,
    level: number,
    parent?: any[]
) {
    const ul = document.createElement('ul');
    ul.classList.add('dialog-row', 'main-group', level ? 'skipme' : 'first-dialog-row');
    ul.style.flexFlow = 'column';

    const div = document.createElement('div');
    div.classList.add('dialog-row');
    div.style.flexFlow = 'row';

    const btnLogical = document.createElement('button');
    btnLogical.classList.add('dialog-item-x', 'group-operator');
    btnLogical.onclick = () => {
        g.logicalOperator = g.logicalOperator === 'AND' ? 'OR' : 'AND';
        ctx.generate();
    };
    const btnLogicalB = document.createElement('b');
    btnLogicalB.appendChild(document.createTextNode(g.logicalOperator));
    btnLogical.appendChild(btnLogicalB);
    div.appendChild(btnLogical);

    const btnGroup = document.createElement('button');
    btnGroup.classList.add('dialog-item-x');
    btnGroup.onclick = (e: any) => {
        generateMenu(e, [
            {
                title: 'Insert Group',
                callback: () => {
                    const g_old = g;
                    g.type = 'GROUP';
                    g.logicalOperator = 'AND';
                    g.filterArguments = [JSON.parse(JSON.stringify(g_old))];
                    ctx.generate();
                }
            },
            {
                title: 'Add Group',
                callback: () => {
                    g.filterArguments.push({
                        type: 'GROUP',
                        logicalOperator: 'AND',
                        filterArguments: []
                    });
                    ctx.generate();
                }
            },
            {
                title: 'Add condition',
                callback: () => {
                    g.filterArguments.splice(0, 0, {
                        type: 'CONDITION',
                        logicalOperator: 'NONE',
                        attribute: 'click to select column',
                        operator: 'EQUAL',
                        valueType: 'VALUE',
                        attributeType: 'text',
                        filterArguments: [],
                        value: ''
                    });
                    ctx.generate();
                }
            }
        ]);
    };

    const xmlns = 'http://www.w3.org/2000/svg';
    const svgElAdd = document.createElementNS(xmlns, 'svg');

    svgElAdd.setAttributeNS(null, 'viewBox', '0 0 24 24');
    svgElAdd.setAttributeNS(null, 'fill', 'none');
    svgElAdd.setAttributeNS(null, 'stroke-linecap', 'round');
    svgElAdd.setAttributeNS(null, 'stroke-linejoin', 'round');
    svgElAdd.setAttributeNS(null, 'stroke-width', '2');
    svgElAdd.setAttributeNS(null, 'stroke', 'currentColor');
    const svgElAddpath = document.createElementNS(xmlns, 'path');
    svgElAddpath.setAttributeNS(
        null,
        'd',
        'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z'
    );
    svgElAdd.appendChild(svgElAddpath);
    btnGroup.appendChild(svgElAdd);

    div.appendChild(btnGroup);

    const btnDeleteGroup = document.createElement('button');
    btnDeleteGroup.classList.add('dialog-item-x');
    btnDeleteGroup.onclick = () => {
        parent && parent.splice(parent.indexOf(g), 1);
        if (!parent) {
            g.filterArguments = [];
        }
        ctx.generate();
    };

    const svgElDelete = document.createElementNS(xmlns, 'svg');

    svgElDelete.setAttributeNS(null, 'viewBox', '0 0 24 24');
    svgElDelete.setAttributeNS(null, 'fill', 'none');
    svgElDelete.setAttributeNS(null, 'stroke-linecap', 'round');
    svgElDelete.setAttributeNS(null, 'stroke-linejoin', 'round');
    svgElDelete.setAttributeNS(null, 'stroke-width', '2');
    svgElDelete.setAttributeNS(null, 'stroke', 'currentColor');
    const svgElpath = document.createElementNS(xmlns, 'path');
    svgElpath.setAttributeNS(
        null,
        'd',
        'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
    );
    svgElDelete.appendChild(svgElpath);
    btnDeleteGroup.appendChild(svgElDelete);
    div.appendChild(btnDeleteGroup);

    ul.appendChild(div);

    const x = filterDialogConditionTemplate(g.filterArguments, ctx, level + 1);
    if (x && x.length) {
        x.forEach((r) => {
            ul.appendChild(r);
        });
    }

    return ul;
}
