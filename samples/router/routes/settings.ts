import { html } from 'lit-html';
import { customElement } from '@simple-html/core';
import { connectCanDeactivate } from '@simple-html/router';

@customElement('settings-route')
export default class extends HTMLElement {
    private locked = false;

    connectedCallback() {
        connectCanDeactivate(this, async () => {
            console.log('stopevent');
            if (this.locked) {
                alert('sorry');
                return false;
            } else {
                return true;
            }
        });
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
