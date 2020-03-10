import { html } from 'lit-html';
import { customElement } from '@simple-html/core';
import { navs, href } from './routes/routerConfig';
import { routeMatch, subscribeHashEvent, unSubscribeHashEvent } from '@simple-html/router';

import './routes/home'
import './routes/childrouter'
import './routes/settings'


@customElement('app-comp')
export default class extends HTMLElement {
    

    connect() {
        subscribeHashEvent(this, ()=>{
            this.render()
        })
    }
    disconnect() {
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
                    } else {
                        return '';
                    }
                })}

                <li style="margin-left: auto;" class="mr-6">
                    <a class="text-teal-200 hover:text-white" href=${href('#login')}>
                        ${this ? 'Logout' : 'Login'}</a
                    >
                </li>
            </ul>

            ${routeMatch('')? html`<home-route></home-route>`:''}
            ${routeMatch('#home')? html`<home-route></home-route>`:''}
            ${routeMatch('#settings')? html`<settings-route></settings-route>`:''}
            ${routeMatch('#child')? html`<childrouter-route></childrouter-route>`:''}
        `;
    }
}
