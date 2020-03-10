import { html } from 'lit-html';
import { customElement } from '@simple-html/core';
import { navs } from './routes/routerConfig';
import { subscribeHashEvent, unSubscribeHashEvent, gotoURL } from '@simple-html/router';
import { routeMatchAsync } from '@simple-html/router';

@customElement('app-comp')
export default class extends HTMLElement {
    

    connectedCallback() {
        subscribeHashEvent(this, ()=>{
            this.render()
        })
    }
    disconnectedCallback() {
        unSubscribeHashEvent(this)
    }

    public render() {
        return html`
            <ul class="flex bg-teal-500 p-6">
                ${navs('main').map(route => {
                    if (route.isNav) {
                        return html`
                            <li class="mr-6">
                                <a class="text-teal-200 hover:text-white" href="${route.path}"
                                    >${route.title}</a
                                >
                            </li>
                        `;
                    } 
                    return ''
                })}

                <li style="margin-left: auto;" class="mr-6">
                    <span 
                        class="text-teal-200 hover:text-white"
                        @click=${()=>{gotoURL('#:cool', {cool:'settings'})}}
                        >
                        ${this ? 'Logout' : 'Login'}
                    </span>
                </li>
            </ul>

            ${routeMatchAsync('',import('./routes/home'), html`<home-route></home-route>`)}
            ${routeMatchAsync('#settings',import('./routes/settings'), html`<settings-route></settings-route>`)}
            ${routeMatchAsync('#child',import('./routes/childrouter'), html`<childrouter-route></childrouter-route>`)}

        `;
    }
}
