import { html } from 'lit-html';
import { customElement } from '@simple-html/core';
import {
    subscribeCanDeactivateEvent,
    unSubscribeCanDeactivateEvent,
    stopCanDeactivate
} from '@simple-html/router';

@customElement('settings-route')
export default class extends HTMLElement {
    private locked = false;

    connectedCallback() {
        subscribeCanDeactivateEvent(this, function () {
            console.log('trigger settings event', this.counter);
            stopCanDeactivate(
                new Promise((resolve) => {
                    if (this.locked) {
                        alert('sorry');
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                    console.log('stopevent');
                })
            );
        });
    }
    disconnectedCallback() {
        unSubscribeCanDeactivateEvent(this);
    }

    clicker() {
        this.locked = this.locked ? false : true;
    }

    public render() {
        return html`
            <section>
                <h1>Settings</h1>
                <br />
                Locked:<input type="checkbox" @click=${this.clicker} .checked=${this.locked} />
            </section>
        `;
    }
}
