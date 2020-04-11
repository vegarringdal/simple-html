import * as internalDataArray from './dummyData';

export class Generator {
    public rowTop: number;
    private totalGenerated: number;
    private internalDataArray: any;

    constructor() {
        this.totalGenerated = 0;
        // transform json object to an array
        this.internalDataArray = internalDataArray.data;
    }

    public reset(): void {
        this.totalGenerated = 0;
    }

    public generateData(no: any): any {
        const dummyArray = [];
        for (let i = 0; i < no; i++) {
            // up count
            this.totalGenerated++;

            const random = function () {
                const x1 = Math.floor(Math.random() * 3) + 0;
                const x2 = Math.floor(Math.random() * 9) + 0;
                const x3 = Math.floor(Math.random() * 9) + 0;
                const x4 = Math.floor(Math.random() * 9) + 0;
                return `${x1}${x2}${x3}${x4}`;
            };

            const date = new Date(
                new Date().setDate(new Date().getDate() + (Math.floor(Math.random() * 300) + 0))
            );

            const data = this.internalDataArray;

            const x: any = {};
            x.index = this.totalGenerated;
            x.mod = Math.floor(this.totalGenerated / 10);
            x.number = Math.floor(Math.random() * 9000) + 0;
            x.bool = Math.floor(Math.random() * 9000) % 3 ? true : false;
            x.date = date;

            for (let i = 1; i < 75; i++) {
                x['word' + i] = data[random()];
            }

            dummyArray.push(x);
        }

        return dummyArray;
    }
}
