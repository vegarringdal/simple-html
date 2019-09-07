import { html } from 'lit-html';
import { customElement, subscribe, instance, unSubscribe } from '@simple-html/core';
import { SharedState } from '../resources/state/sharedstate';
import { href } from '@simple-html/router';

@customElement('header-section')
export default class extends HTMLElement {
    public activeRoute: string;

    connectedCallback() {
        subscribe('routeChange', this, this.updateHeaders.bind(this));
    }

    disconnectedCallback() {
        unSubscribe('routeChange', this);
    }

    updateHeaders(x: any) {
        this.activeRoute = x.name;
        this.render();
    }

    public render() {
        return html`
            <nav class="navbar navbar-light">
                <div class="container">
                    <a class="navbar-brand" href=${href('Home')}>Conduit</a>
                    <ul class="nav navbar-nav pull-xs-right">
                        <li class="${'nav-item' + (this.activeRoute === 'home' ? ' active' : '')}">
                            <a class="nav-link" href=${href('Home')}>Home</a>
                        </li>

                        ${instance(SharedState).isAuthenticated
                            ? html`
                                  <li
                                      class="${'nav-item' +
                                          (this.activeRoute === 'create' ? ' active' : '')}"
                                  >
                                      <a class="nav-link" href=${href('Editor')}>
                                          <i class="ion-compose"></i>&nbsp;New Post
                                      </a>
                                  </li>

                                  <li
                                      class="${'nav-item' +
                                          (this.activeRoute === 'settings' ? ' active' : '')}"
                                  >
                                      <a class="nav-link" href=${href('Settings')}>
                                          <i class="ion-gear-a"></i>&nbsp;Settings
                                      </a>
                                  </li>
                              `
                            : ''}
                        ${!instance(SharedState).isAuthenticated
                            ? html`
                                  <li
                                      class="${'nav-item' +
                                          (this.activeRoute === 'login' ? ' active' : '')}"
                                  >
                                      <a class="nav-link" href=${href('Login')}
                                          ><i class="ion-compose"></i>Sign in</a
                                      >
                                  </li>

                                  <li
                                      class="${'nav-item' +
                                          (this.activeRoute === 'register' ? ' active' : '')}"
                                  >
                                      <a class="nav-link" href=${href('Register')}
                                          ><i class="ion-compose"></i>Sign up</a
                                      >
                                  </li>
                              `
                            : ''}
                        ${instance(SharedState).isAuthenticated
                            ? html`
                                  <li
                                      class="${'nav-item' +
                                          (this.activeRoute === 'profile' ? ' active' : '')}"
                                  >
                                      <a
                                          class="nav-link"
                                          href=${href('Profile', {
                                              name: instance(SharedState).currentUser.username
                                          })}
                                          >${instance(SharedState).currentUser.username}</a
                                      >
                                  </li>
                              `
                            : ''}
                    </ul>
                </div>
            </nav>
        `;
    }
}
