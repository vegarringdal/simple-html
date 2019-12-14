import { html } from 'lit-html';
import { customElement, instance } from '@simple-html/core';
import { UserService } from '../resources/services/userservice';
import { SharedState } from '../resources/state/sharedstate';

@customElement('settings-comp')
export default class extends HTMLElement {
    public passwordConfirm: string;
    public password: string;
    public errors: any[] = [];
    public success: string;
    public userService: UserService;
    public sharedState: SharedState;

    constructor() {
        super();
        this.userService = instance(UserService);
        this.sharedState = instance(SharedState);
    }

    public async update() {
        try {
            await this.userService.update(this.sharedState.currentUser);
            this.success = 'Updated successfully';
            this.render();
            setTimeout(() => {
                this.success = null;
                this.render();
            }, 1500);
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
        }
    }

    get canSave() {
        if (this.passwordConfirm) {
            return (
                this.sharedState &&
                this.sharedState.currentUser &&
                this.passwordConfirm === this.password
            );
        } else {
            return this.sharedState && this.sharedState.currentUser;
        }
    }

    public logout() {
        this.userService.purgeAuth();
        location.hash = 'home';
    }

    public render() {
        return html`
            <div class="settings-page">
                <div class="container page">
                    <div class="row">
                        <div class="col-md-6 offset-md-3 col-xs-12">
                            <h1 class="text-xs-center">Your Settings</h1>

                            <ul class="error-messages">
                                ${this.errors.map(error => {
                                    return html`
                                        <li>
                                            ${error}
                                        </li>
                                    `;
                                })}
                            </ul>

                            <ul class="error-success">
                                ${this.success}
                            </ul>

                            <form>
                                <fieldset>
                                    <fieldset class="form-group">
                                        <input
                                            class="form-control"
                                            type="text"
                                            placeholder="URL of profile picture"
                                            .value=${this.sharedState.currentUser.image}
                                            @input=${(e: any) => {
                                                this.sharedState.currentUser.image = e.target.value;
                                                this.render();
                                            }}
                                        />
                                    </fieldset>

                                    <fieldset class="form-group">
                                        <input
                                            class="form-control form-control-lg"
                                            type="text"
                                            placeholder="Your Name"
                                            autocomplete="usename"
                                            .value=${this.sharedState.currentUser.username}
                                            @input=${(e: any) => {
                                                this.sharedState.currentUser.username =
                                                    e.target.value;
                                                this.render();
                                            }}
                                        />
                                    </fieldset>

                                    <fieldset class="form-group">
                                        <textarea
                                            class="form-control form-control-lg"
                                            rows="8"
                                            placeholder="Short bio about you"
                                            autocomplete="bio"
                                            .value=${this.sharedState.currentUser.bio}
                                            @input=${(e: any) => {
                                                this.sharedState.currentUser.bio = e.target.value;
                                                this.render();
                                            }}
                                        ></textarea>
                                    </fieldset>

                                    <fieldset class="form-group">
                                        <input
                                            class="form-control form-control-lg"
                                            type="text"
                                            placeholder="Email"
                                            autocomplete="email"
                                            @input=${(e: any) => {
                                                this.sharedState.currentUser.email = e.target.value;
                                                this.render();
                                            }}
                                        />
                                    </fieldset>

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

                                    <fieldset class="form-group">
                                        <input
                                            class="form-control form-control-lg"
                                            type="password"
                                            autocomplete="new-password"
                                            placeholder="Confirm new password"
                                            @input=${(e: any) => {
                                                this.passwordConfirm = e.target.value;
                                                this.render();
                                            }}
                                        />
                                    </fieldset>

                                    <!-- PS! do not use button in forms, need to improve override default -->
                                    <input
                                        type="button"
                                        class="btn btn-lg btn-primary pull-xs-right"
                                        @click=${this.update}
                                        .disabled.bind=${!this.canSave}
                                        value="Update Settings"
                                    />
                                </fieldset>
                            </form>

                            <hr />
                            <button class="btn btn-outline-danger" @click=${this.logout}>
                                Or click here to logout.
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
