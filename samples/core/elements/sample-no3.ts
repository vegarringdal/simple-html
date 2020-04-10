import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

import { property, attribute } from '@simple-html/core/dist/esm';

@customElement('sample-no3')
export default class extends HTMLElement {
    @property() count = 0;

    render() {
        return html`<br />
            <div class="flex flex-col">
                <button
                    class="bg-green-500 p-2"
                    @click=${() => {
                        this.count = this.count + 1;
                    }}
                >
                    count ++
                </button>

                <span>ele-one - using property - auto rerender</span>
                <ele-1 .myvalue=${this.count}></ele-1>

                <span>ele-two- using attribute - auto rerender</span>
                <ele-2 my-value=${this.count}></ele-2>

                <span>ele-one - using property - manual rerender</span>
                <ele-3 .myvalue=${this.count}></ele-3>

                <span>ele-two- using attribute - manual rerender</span>
                <ele-4 my-value=${this.count}></ele-4>
            </div>`;
    }
}

/**
 * <ele-1></ele-1>
 */
@customElement('ele-1')
export class Ele1 extends HTMLElement {
    @property() myvalue = 0;

    render() {
        return html`<span>${this.myvalue}</span>`;
    }
}

/**
 * <ele-2></ele-2>
 */
@customElement('ele-2')
export class Ele2 extends HTMLElement {
    @attribute() myValue = 0;

    render() {
        return html`<span>${this.myValue}</span>`;
    }
}

/**
 * <ele-3></ele-3>
 */
@customElement('ele-3')
export class Ele3 extends HTMLElement {
    @property({ skipRender: true }) myvalue = 0;

    valuesChanged(type: string, propertyName: string, oldValue: any, newValue: any) {
        console.log(type, propertyName, oldValue, newValue);
        //small delay see it
        setTimeout(() => {
            this.render();
        }, 700);
    }

    render() {
        return html`<span>${this.myvalue}</span>`;
    }
}

/**
 * <ele-4></ele-4>
 */
@customElement('ele-4')
export class Ele4F extends HTMLElement {
    @attribute({ skipRender: true }) myValue = 0;

    valuesChanged(type: string, propertyName: string, oldValue: any, newValue: any) {
        console.log(type, propertyName, oldValue, newValue);
        //small delay see it
        setTimeout(() => {
            this.render();
        }, 1000);
    }

    render() {
        return html`<span>${this.myValue}</span>`;
    }
}
