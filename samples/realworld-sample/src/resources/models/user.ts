export class User {
    public email: string;
    public token: string;
    public username: string;
    public bio: string;
    public image: string;

    constructor(user?: User) {
        this.email = user ? user.email : '';
        this.token = user ? user.token : '';
        this.username = user ? user.username : '';
        this.bio = user ? user.bio : '';
        this.image = user ? user.image : '';
    }
}
