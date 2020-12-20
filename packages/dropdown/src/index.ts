/**
 * Simple autocomplete
 */

import { attribute, customElement, property } from '@simple-html/core';
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
    @attribute() maxDropDownHeight = 200;
    dropdownActive: boolean = false;
    dropdownElement: any;
    selectionIndex: number = null;
    lastSelectedElement: any;
    callback: (value?: string, regex?: any) => void;

    connectedCallback() {
        this.addEventListener('input', this);
        this.addEventListener('blur', this);
        this.addEventListener('keydown', this);
        this.remove();
    }

    public triggerEvent(ele: any, eventName: string, data = {}, bubble = false) {
        const event = new CustomEvent(eventName, {
            bubbles: bubble,
            detail: {
                data
            }
        });
        ele.dispatchEvent(event);
    }

    handleEvent(e: any) {
        if (e.type === 'input') {
            this.create(e);
        }

        if (e.type === 'blur') {
            this.remove();
        }
        if (e.type === 'keydown') {
            if (['ArrowDown', 'ArrowUp', 'Enter', 'Home', 'End'].indexOf(e.key) !== -1) {
                if (!this.dropdownActive) {
                    this.create(e);
                } else {
                    if (this.selectionIndex === null) {
                        this.selectionIndex = 0;
                    } else {
                        switch (e.key) {
                            case 'ArrowDown':
                                if (
                                    this.dropdownElement.children.length >
                                    this.selectionIndex + 1
                                ) {
                                    this.selectionIndex = this.selectionIndex + 1;
                                }
                                break;
                            case 'ArrowUp':
                                this.selectionIndex = this.selectionIndex - 1;
                                if (this.selectionIndex < 0) {
                                    this.remove();
                                }
                                break;
                            case 'Home':
                                this.selectionIndex = 0;
                                break;
                            case 'End':
                                this.selectionIndex = this.dropdownElement.children.length - 1;
                                break;
                            case 'Enter':
                                this.remove();
                                return;

                            default:
                            //nothing
                        }
                    }
                    if (this.lastSelectedElement) {
                        this.triggerEvent(this.lastSelectedElement, 'dehighlight');
                    }
                    this.lastSelectedElement = this.dropdownElement.children[this.selectionIndex];
                    this.triggerEvent(this.lastSelectedElement, 'highlight');
                    this.triggerEvent(this.lastSelectedElement, 'mousedown');

                    const top =
                        this.lastSelectedElement.offsetTop + this.lastSelectedElement.clientHeight;
                    if (top > this.dropdownElement.clientHeight) {
                        this.dropdownElement.scrollTop = this.lastSelectedElement.offsetTop;
                    }

                    if (this.lastSelectedElement.offsetTop < this.dropdownElement.scrollTop) {
                        this.dropdownElement.scrollTop =
                            this.lastSelectedElement.offsetTop -
                            this.lastSelectedElement.clientHeight;
                    }
                }
                console.log(e);
            }
        }
    }

    disconnectedCallback() {
        this.remove();
        this.removeEventListener('input', this);
        this.removeEventListener('blur', this);
        this.removeEventListener('keydown', this);
    }

    remove() {
        setTimeout(() => {
            if (this.dropdownActive && this.dropdownElement) {
                this.dropdownActive = false;
                if (this.dropdownElement.parentNode) {
                    this.dropdownElement.parentNode.removeChild(this.dropdownElement);
                }
                this.selectionIndex = null;
                this.lastSelectedElement = null;
            }
        }, 1);
    }

    create(e: any) {
        const rect = this.getBoundingClientRect();
        if (!this.dropdownActive) {
            this.dropdownActive = true;
            const el = document.createElement('simple-html-autocomplete-list');
            this.dropdownElement = el;
            el.style.position = 'absolute';
            el.style.zIndex = '100';
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.bottom}px`;
            el.style['min-width'] = `${rect.width}px`;
            el.style['max-height'] = `${this.maxDropDownHeight}px`;
            el.style['overflow-y'] = 'auto';
            el.setAttribute('class', this.getAttribute('listClasses'));
            (<any>el).callback = () => {
                const regex = new RegExp('^' + this.value, 'i');
                return this.callback(this.value, regex);
            };
            document.body.appendChild(this.dropdownElement);
        } else {
            this.dropdownElement.inputData = e.target.value;
        }
    }

    render() {
        return '';
    }
}
