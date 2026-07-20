import { html, render } from 'lit-html';
export function renderRowSelector(ctx, cell, row, _column, _celno, _colType, _cellType, _attribute, rowData) {
    let currentEntitySelected = '';
    if (rowData === ctx.gridInterface.getDatasource().currentEntity) {
        currentEntitySelected = row % 2 === 0 ? 'simple-html-label-even' : 'simple-html-label-odd';
    }
    else {
        currentEntitySelected = 'simple-html-label';
    }
    render(html `<div
            class=${`${currentEntitySelected} simple-html-absolute-fill`}
            @click=${(e) => {
        const ds = ctx.gridInterface.getDatasource();
        if (rowData?.__group) {
            const rows = ds.getRows();
            const selectRows = [];
            for (let i = row + 1; i < rows.length; i++) {
                const entity = rows[i];
                if (entity.__group) {
                    i = rows.length;
                    continue;
                }
                selectRows.push(i);
            }
            if (selectRows.length) {
                ds.getSelection().selectRowRange(selectRows[0], selectRows[selectRows.length - 1], e.ctrlKey);
                ctx.rebuild();
            }
        }
        else {
            ds.getSelection().highlightRow(e, row);
        }
    }}
        >
            <div class="${isModified(rowData)}">
                <span role="cell" aria-label=${'row selector'} class="simple-html-selector-text"
                    >${row + 1}</span
                >
            </div>
        </div>`, cell);
}
// helper to add class so we can override color when row is modified
function isModified(rowData) {
    if (rowData?.__controller?.__isDeleted) {
        return 'row-is-deleted';
    }
    if (rowData?.__controller?.__isNew) {
        return 'row-is-new';
    }
    if (rowData?.__controller?.__edited) {
        return 'row-is-modified';
    }
    return '';
}
//# sourceMappingURL=renderRowSelector.js.map