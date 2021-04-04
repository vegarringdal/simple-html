import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';
import { panelColumn, columnDragDropPanelColumn } from './dragEvent';
import { defineElement } from './defineElement';

function capalize(text: string) {
    if (text) {
        return text[0].toUpperCase() + text.substring(1, text.length);
    } else {
        return text;
    }
}

export class SimpleHtmlGridPanel extends HTMLElement {
    connector: GridInterface;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid-panel');
        const config = this.connector.config;
        this.style.height = config.panelHeight + 'px';
        this.ref.addEventListener('reRender', this);
        this.addEventListener('contextmenu', this);
        this.updateGui();
    }

    handleEvent(e: Event) {
        if (e.type === 'reRender') {
            this.updateGui();
        }
        if (e.type === 'contextmenu') {
            e.preventDefault();
            generateMenuWithComponentName(
                'simple-html-grid-menu-panel',
                e,
                this.connector,
                this.ref
            );
        }
    }

    disconnectedCallback() {
        this.removeEventListener('contextmenu', this);
        this.ref.removeEventListener('reRender', this);
    }

    updateGui() {
        this.innerHTML = '';
        const grouping = this.connector.config.groupingSet || [];

        const mouseEnter = (e: MouseEvent) => {
            (e.target as HTMLElement)
                .getElementsByClassName('simple-html-grid-icon')[0]
                .classList.remove('simple-html-grid-iconhidden');
        };

        const mouseLeave = (e: MouseEvent) => {
            (e.target as HTMLElement)
                .getElementsByClassName('simple-html-grid-icon')[0]
                .classList.add('simple-html-grid-iconhidden');
        };

        const enter = panelColumn('enter', this.connector);
        const leave = panelColumn('leave', this.connector);
        const dragstart = columnDragDropPanelColumn('dragstart', this.connector);

        const groupEls = grouping.map((group) => {
            const click = () => {
                this.connector.removeGroup(group);
            };

            const el = document.createElement('div');
            el.classList.add('simple-html-grid-grouping-panel-container');
            el.onmouseenter = (e: any) => {
                mouseEnter(e);
                enter(e, group.attribute);
            };
            el.onmouseleave = (e: any) => {
                mouseLeave(e);
                leave(e);
            };
            el.onmousedown = (e: any) => {
                dragstart(e, group);
            };

            const p = document.createElement('p');
            p.classList.add('simple-html-grid-grouping-panel-p');
            p.appendChild(document.createTextNode(`${capalize(group.title || group.attribute)}`));

            const i = document.createElement('i');

            const xmlns = 'http://www.w3.org/2000/svg';
            const svgElDelete = document.createElementNS(xmlns, 'svg');
            svgElDelete.classList.add('simple-html-grid-icon', 'simple-html-grid-iconhidden');
            svgElDelete.onclick = click;
            svgElDelete.setAttributeNS(null, 'viewBox', '0 0 16 16');
            const svgElpath = document.createElementNS(xmlns, 'path');
            svgElpath.setAttributeNS(
                null,
                'd',
                'M3 4l4.3 4L3 12h1.4L8 8.7l3.5 3.3H13L8.6 8 13 4h-1.5L8 7.3 4.4 4H3z'
            );
            svgElDelete.appendChild(svgElpath);
            i.appendChild(svgElDelete);
            p.appendChild(i);
            el.appendChild(p);

            return el;
        });

        groupEls.forEach((el) => {
            this.appendChild(el);
        });
    }
}
defineElement(SimpleHtmlGridPanel, 'simple-html-grid-panel');
