import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('settings-route')
export default class extends HTMLElement {
    private locked = true;

    canDeactivate() {
        if (this.locked) {
            alert('unlock first, see the checkbox called "locked"');
        }
        return this.locked ? false : true;
    }

    click() {
        this.locked = this.locked ? false : true;
    }

    public render() {
        return html`
            <section>
                <h1>Settings</h1>
                <br />
                Locked:<input
                    type="checkbox"
                    @click=${this.click}
                    .checked=${this.locked}
                />
            </section>
        `;
    }
}
