import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';
import { defineElement } from './defineElement';

export class SimpleHtmlGridFooter extends HTMLElement {
    connector: GridInterface;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid-footer');
        const config = this.connector.config;
        this.style.height = config.footerHeight + 'px';
        this.ref.addEventListener('reRender', this);
        this.renderx();
    }

    disconnectedCallback() {
        this.ref.removeEventListener('reRender', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'reRender') {
            this.innerHTML = '';
            this.renderx();
        }
    }

    showEdit() {
        const el = document.createElement('div');
        el.classList.add('grid-edit-button');

        const btn = document.createElement('button');
        btn.style.padding = '2px';
        btn.onclick = (e: any) => {
            generateMenuWithComponentName(
                'simple-html-grid-filter-dialog',
                e,
                this.connector,
                this.ref,
                null,
                null,
                null
            );
        };
        btn.appendChild(document.createTextNode('Edit filter'));
        el.append(btn);
        return el;
    }

    renderx() {
        const totalRows = this.connector.completeDataset.length;
        const filter = this.connector.filteredDataset.length;

        this.appendChild(this.showEdit());

        {
            const el = document.createElement('div');
            el.style.textAlign = 'center';
            el.appendChild(document.createTextNode(`${filter}/${totalRows}`));
            this.appendChild(el);
        }

        {
            const el = document.createElement('div');
            el.style.display = 'flex';
            el.style.justifyContent = 'center';

            const span = document.createElement('span');
            span.style.marginRight = '5px';
            span.style.maxWidth = '90%;';
            span.style.whiteSpace = 'nowrap';
            span.style.textOverflow = 'ellipsis';

            span.appendChild(
                document.createTextNode(`${this.connector.getFilterString().replace(/\,/g, ', ')}`)
            );
            el.appendChild(span);
            this.appendChild(el);
        }
    }
}
defineElement(SimpleHtmlGridFooter, 'simple-html-grid-footer');
