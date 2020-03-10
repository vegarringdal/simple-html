import { html } from 'lit-html';
import { customElement } from '@simple-html/core';
import { subscribeCanDeactivateEvent, unSubscribeCanDeactivateEvent, stopCanDeactivate } from '@simple-html/router/src';

@customElement('settings-route')
export default class extends HTMLElement {
    private locked = true;


    con() {
        subscribeCanDeactivateEvent(this, ()=>{
            console.log("trigger settings event")
            stopCanDeactivate(new Promise((resolve)=>{

                if(this.locked){
                    alert('sorry')
                    resolve(false)
                } else {
                    resolve(true)
                }
                console.log('stopevent')

            }))
        });
    }
    dis() {
        unSubscribeCanDeactivateEvent(this)
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
