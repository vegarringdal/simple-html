import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('settings-component')
export default class extends HTMLElement {
    _locked: any = true;

    canDeactivate() {
        let result = this.locked ? false : true;
        return Promise.resolve(result);
    }

    public myclick(e: any) {
        this.locked = e.target.checked;
    }

    set locked(value) {
        console.log('set', value);
        this._locked = value;
    }

    get locked() {
        console.log('get', this._locked);
        return this._locked;
    }

    public render() {
        return html`
            <div>
                Locked:<input type="checkbox" .checked=${this.locked} @click=${this.myclick} />
            </div>
            settings
        `;
    }
}
