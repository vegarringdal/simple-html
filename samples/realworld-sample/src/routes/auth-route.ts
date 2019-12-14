import { html } from 'lit-html';
import { customElement, instance } from '@simple-html/core';
import { UserService } from '../resources/services/userservice';
import { SharedState } from '../resources/state/sharedstate';
import { href } from '@simple-html/router';

@customElement('auth-comp')
export default class extends HTMLElement {
    public userService: UserService;
    public sharedState: SharedState;
    public type = '';
    public username = '';
    public passwordConfirm = '';
    public email = '';
    public emailConfirm = '';
    public password = '';
    public errors: any[] = [];
    public controller: any;

    constructor() {
        super();
        this.userService = instance(UserService);
        this.sharedState = instance(SharedState);
    }

    public async activate(_route: string, _params: any, route: any) {
        this.type = route.name;
    }

    public get canSave() {
        if (this.type === 'Login') {
            return this.email !== '' && this.password !== '';
        } else {
            return (
                this.username !== '' &&
                this.email !== '' &&
                this.password !== '' &&
                this.password === this.passwordConfirm &&
                this.email === this.emailConfirm
            );
        }
    }

    public async submitForm() {
        this.errors = [];

        const credentials = {
            username: this.username,
            email: this.email,
            password: this.password
        };

        try {
            await this.userService.attemptAuth(this.type, credentials);
            location.hash = 'home';
        } catch (e) {
            const err: any = await Promise.resolve(e);
            for (const k in err.errors) {
                if (err.errors && err.errors[k]) {
                    this.errors.push(
                        err.errors[k].map((x: any) => {
                            return k + ': ' + x;
                        })
                    );
                }
            }
            this.render();
        }
    }

    public render() {
        return html`
            <div class="auth-page">
                <div class="container page">
                    <div class="row">
                        <div class="col-md-6 offset-md-3 col-xs-12">
                            <h1 class="text-xs-center">
                                Sign ${this.type === 'login' ? 'in' : 'up'}
                            </h1>
                            <p class="text-xs-center">
                                ${this.type === 'Register'
                                    ? html`
                                          <a href=${href('Login')}>Have an account?</a>
                                      `
                                    : html`
                                          <a href=${href('Register')}>Need an account?</a>
                                      `}
                            </p>

                            <ul class="error-messages">
                                ${this.errors.map(error => {
                                    return html`
                                        <li>
                                            ${error}
                                        </li>
                                    `;
                                })}
                            </ul>

                            <form>
                                <!-- if statement -->
                                ${this.type === 'Register'
                                    ? html`
                                          <fieldset class="form-group">
                                              <input
                                                  class="form-control form-control-lg"
                                                  type="text"
                                                  autocomplete="username"
                                                  placeholder="Your Name"
                                                  @input=${(e: any) => {
                                                      this.username = e.target.value;
                                                      this.render();
                                                  }}
                                              />
                                          </fieldset>
                                      `
                                    : ''}

                                <fieldset class="form-group">
                                    <input
                                        class="form-control form-control-lg"
                                        type="text"
                                        autocomplete="email"
                                        placeholder="Email"
                                        @input=${(e: any) => {
                                            this.email = e.target.value;
                                            this.render();
                                        }}
                                    />
                                </fieldset>

                                <!-- if statement -->
                                ${this.type === 'Register'
                                    ? html`
                                          <fieldset class="form-group">
                                              <input
                                                  class="form-control form-control-lg"
                                                  type="text"
                                                  autocomplete="new-email"
                                                  placeholder="Confirm Email"
                                                  @input=${(e: any) => {
                                                      this.emailConfirm = e.target.value;
                                                      this.render();
                                                  }}
                                              />
                                          </fieldset>
                                      `
                                    : ''}

                                <fieldset class="form-group">
                                    <input
                                        class="form-control form-control-lg"
                                        type="password"
                                        autocomplete="current-password"
                                        placeholder="Password"
                                        @input=${(e: any) => {
                                            this.password = e.target.value;
                                            this.render();
                                        }}
                                    />
                                </fieldset>

                                <!-- if statement -->
                                ${this.type === 'Register'
                                    ? html`
                                          <fieldset class="form-group">
                                              <input
                                                  class="form-control form-control-lg"
                                                  type="password"
                                                  autocomplete="new-password"
                                                  placeholder="Confirm Password"
                                                  @input=${(e: any) => {
                                                      this.passwordConfirm = e.target.value;
                                                      this.render();
                                                  }}
                                              />
                                          </fieldset>
                                      `
                                    : ''}

                                <!-- PS! do not use button in forms, need to improve override default -->
                                <input
                                    type="button"
                                    class="btn btn-lg btn-primary pull-xs-right"
                                    @click=${this.submitForm}
                                    .disabled=${!this.canSave}
                                    .value="Sign ${this.type === 'Login' ? 'in' : 'up'}"
                                />
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
