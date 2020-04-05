import * as internalDataArray from './dummyData';

export class DummyDataGenerator {
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

            const random = function() {
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

            dummyArray.push({
                index: this.totalGenerated,
                word1: data[random()],
                word2: data[random()],
                word3: data[random()],
                word4: data[random()],
                word5: data[random()],
                word6: data[random()],
                word7: data[random()],
                word8: data[random()],
                word9: data[random()],
                word10: data[random()],
                word11: data[random()],
                word12: data[random()],
                word13: data[random()],
                word14: data[random()],
                word15: data[random()],
                word16: data[random()],
                word17: data[random()],
                word18: data[random()],
                word19: data[random()],
                word20: data[random()],
                word21: data[random()],
                word22: data[random()],
                word23: data[random()],
                word24: data[random()],
                word25: data[random()],
                word26: data[random()],
                word27: data[random()],
                word28: data[random()],
                word29: data[random()],
                word31: data[random()],
                word32: data[random()],
                word33: data[random()],
                word34: data[random()],
                word35: data[random()],
                word36: data[random()],
                number: Math.floor(Math.random() * 9000) + 0,
                bool: Math.floor(Math.random() * 9000) % 3 ? true : false,
                date: date
            });
        }

        return dummyArray;
    }
}
