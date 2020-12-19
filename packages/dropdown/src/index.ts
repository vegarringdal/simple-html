/**
 * Simple autocomplete
 */

import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('simple-html-autocomplete-list')
export class List extends HTMLElement {
    callback: () => void;
    @property() inputData: any = 'wow';

    connectedCallback() {
        // if I exist, then its HMR event or similar
        if (this.childNodes.length) {
            this.parentNode.removeChild(this);
        }
    }

    render() {
        return html` ${this.callback ? this.callback() : ''} `;
    }
}

@customElement('simple-html-autocomplete', { extends: 'input' })
export class Drop extends HTMLInputElement {
    added: boolean = false;
    el: any;
    classToUse = '';
    callback: (value?: string, regex?: any) => void;
    _create: any;
    _remove: any;

    connectedCallback() {
        this._create = this.create.bind(this);
        this._remove = this.remove.bind(this);
        this.addEventListener('input', this._create);
        this.addEventListener('blur', this._remove);
        this.remove();
    }

    disconnectedCallback() {
        this.remove();
        this.removeEventListener('input', this._create);
        this.removeEventListener('blur', this._remove);
    }

    remove() {
        setTimeout(() => {
            if (this.added && this.el) {
                this.added = false;
                if (this.el.parentNode) {
                    this.el.parentNode.removeChild(this.el);
                }
            }
        }, 1);
    }

    create(e: any) {
        const rect = this.getBoundingClientRect();
        if (!this.added) {
            this.added = true;
            const el = document.createElement('simple-html-autocomplete-list');
            this.el = el;
            el.style.position = 'absolute';
            el.style.zIndex = '100';
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.bottom}px`;
            el.style.width = `${rect.width}px`;
            el.setAttribute('class', this.getAttribute('listClasses'));
            (<any>el).callback = () => {
                let regex = new RegExp('^' + this.value, 'i');
                return this.callback(this.value, regex);
            };
            document.body.appendChild(this.el);
        } else {
            this.el.inputData = e.target.value;
        }
    }

    render() {
        return '';
    }
}
