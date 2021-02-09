import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { RowCache } from '../types';
import { defineElement } from './defineElement';

export class SimpleHtmlGridCol extends HTMLElement {
    connector: GridInterface;
    row: RowCache;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.updateGui();
    }

    updateGui() {
        this.innerHTML = '';
        if (this.ref) {
            this.style.width = '100%';
            this.style.height = this.connector.getScrollVars.__SCROLL_HEIGHTS[this.row.i] + 'px';

            // }
            const entity = this.connector.displayedDataset[this.row.i];

            if (entity && entity.__group) {
                this.style.display = 'block';

                this.style.left = (entity.__groupLvl ? entity.__groupLvl * 15 : 0) + 'px';

                const changeGrouping = () => {
                    if (entity.__groupExpanded) {
                        this.connector.groupCollapse(entity.__groupID);
                    } else {
                        this.connector.groupExpand(entity.__groupID);
                    }
                };

                const i = document.createElement('i');
                i.onclick = changeGrouping;
                this.appendChild(i);

                const xmlns = 'http://www.w3.org/2000/svg';
                const svgToggle = document.createElementNS(xmlns, 'svg');
                svgToggle.classList.add('simple-html-grid-icon');
                svgToggle.setAttributeNS(null, 'viewBox', '0 0 16 16');
                const svgElpath = document.createElementNS(xmlns, 'path');
                svgElpath.setAttributeNS(
                    null,
                    'd',
                    entity.__groupExpanded
                        ? 'M4.8 7.5h6.5v1H4.8z'
                        : 'M7.4 4.8v2.7H4.7v1h2.7v3h1v-3h2.8v-1H8.5V4.8h-1z'
                );

                svgToggle.appendChild(svgElpath);

                i.appendChild(svgToggle);

                const span = document.createElement('span');
                span.appendChild(
                    document.createTextNode(`${entity.__groupName} (${entity.__groupTotal})`)
                );
                this.appendChild(span);
            } else {
                this.style.display = 'none';
            }
        } else {
            if (this.connector) {
                const grouping =
                    this.connector.config.groupingSet && this.connector.config.groupingSet.length;
                const entity = this.row ? this.connector.displayedDataset[this.row.i] : null;
                if (entity && entity.__group) {
                    this.style.width = entity.__groupLvl * 15 + 'px';
                } else {
                    this.style.width = (grouping ? grouping * 15 : 0) + 'px';
                }
                this.style.height =
                    (this.row
                        ? this.connector.getScrollVars.__SCROLL_HEIGHTS[this.row.i]
                        : this.connector.config.cellHeight) + 'px';
                this.style.display = grouping ? 'block' : 'none';
            }
        }
    }
}
defineElement(SimpleHtmlGridCol, 'simple-html-grid-col');
