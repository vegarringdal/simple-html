import { html } from 'lit-html';
import { IColumns, CallbackEvent } from '../interfaces';
import { eventIF } from '../eventIF';
import { GridInterface } from '../gridInterface';

export function filterInputElement(col: IColumns, connector: GridInterface, isTop: boolean) {
    const value = col.filterable.currentValue || null;
    const placeholder = col.filterable.placeholder || '';

    let classname;
    if (col.type === 'boolean') {
        classname = 'free-grid-row-checkbox-50';
    } else {
        if (isTop) {
            classname = 'free-grid-header-input-top';
        } else {
            classname = 'free-grid-header-input-bottom';
        }
    }

    const coltype = col.type === 'boolean' ? 'checkbox' : col.type;

    const filterCallback = (e: CallbackEvent) => {
        // if boolean column we to to overide how it behaves
        if (col.type === 'boolean') {
            const t: any = e.target;
            switch (t.state) {
                case 0:
                    t.state = 2;
                    t.style.opacity = '1';
                    t.checked = true;
                    t.indeterminate = false;
                    break;
                case 2:
                    t.state = 3;
                    t.style.opacity = '1';
                    t.indeterminate = false;
                    break;
                default:
                    t.checked = false;
                    t.state = 0;
                    t.style.opacity = '0.3';
                    t.indeterminate = true;
            }
        }
        col.filterable.beforeFilterCallbackFn &&
            col.filterable.beforeFilterCallbackFn(e, col, connector);
        if (col.filterable.auto !== false) {
            connector.filterCallback(e, col);
        }
    };

    const enterKeyDown = (e: KeyboardEvent) => {
        const keycode = e.keyCode ? e.keyCode : e.which;
        if (keycode === 13) {
            filterCallback(<any>e);
        }
    };

    let boolstyle = null;
    let indeterminate = false;
    let setState = 0;
    if (col.type === 'boolean' && col.filterable) {
        // if no value is set then its "blank state, nothing filtered
        if (col.filterable.currentValue !== false && col.filterable.currentValue !== true) {
            boolstyle = 'opacity:0.3';
            indeterminate = true;
            setState = 0;
        } else {
            setState = col.filterable.currentValue ? 2 : 3;
        }
    }

    return col.headerRenderInputCallBackFn
        ? col.headerRenderInputCallBackFn(html, col, null, null, connector)
        : html`
              <input
                  type=${coltype}
                  style=${boolstyle}
                  .indeterminate=${indeterminate}
                  .state=${setState}
                  class=${classname}
                  @custom=${eventIF(true, col.filterable.filterTrigger || 'change', filterCallback)}
                  @custom-keydown=${eventIF(true, 'keydown', enterKeyDown)}
                  .value=${value}
                  placeholder=${placeholder}
              />
          `;
}
