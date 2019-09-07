import * as internalDataArray from './dummyData';

export class DummyDataGenerator {
    public rowTop: number;
    private totalGenerated: number;
    private first: any;
    private last: any;
    private images: any;
    private color: any;
    private internalDataArray: any;

    constructor() {
        this.totalGenerated = 0;
        // transform json object to an array
        this.internalDataArray = internalDataArray.data;
        this.rowTop = 0;
        this.first = [];
        this.last = [];
        this.images = [];
        this.color = [];

        for (let i = 0; i < this.internalDataArray.length; i++) {
            this.first.push(this.internalDataArray[i].first);
            this.last.push(this.internalDataArray[i].last);
            this.images.push(this.internalDataArray[i].image);
            this.color.push(this.internalDataArray[i].color);
        }
    }

    public reset(): void {
        this.totalGenerated = 0;
    }

    public generateData(no: any): any {
        const dummyArray = [];
        for (let i = 0; i < no; i++) {
            // up count
            this.totalGenerated++;
            const random1 = Math.floor(Math.random() * 27) + 0;
            const random2 = Math.floor(Math.random() * 27) + 0;
            const random3 = Math.floor(Math.random() * 27) + 0;
            const random4 = Math.floor(Math.random() * 27) + 0;
            const date = new Date(
                new Date().setDate(new Date().getDate() + (Math.floor(Math.random() * 300) + 0))
            );
            dummyArray.push({
                /*                 __group: i % 5 === 0 ? true : false,
                __groupName: i % 5 === 0 ? "test" : null,
                __groupLvl: i % 5 === 0 ? 1 : 1,
                __groupTotal: i % 5 === 0 ? 200 : null, */
                index: this.totalGenerated,
                name: i % 7 === 0 ? null : this.first[random4] + ' ' + this.last[random3],
                first: this.first[random4],
                last: this.last[random3],
                images: this.images[random2],
                color: this.color[random4],
                number: Math.floor(Math.random() * 9000) + 0,
                bool: random1 % 3 ? true : false,
                date: date
            });
        }

        return dummyArray;
    }

    // tok it from a polymer sample resonse data
    // https://elements.polymer-project.org/elements/iron-list?view=demo:demo/selection.html&active=iron-list
}
