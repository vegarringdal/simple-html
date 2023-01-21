import { describe, beforeAll, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

const simpleArray = [{ name: 'person1' }, { name: 'person2' }, { name: 'person3' }, { name: 'person4' }, { name: 'person5' }];

let datasource: Datasource;

describe('datasource selection', () => {
    beforeAll(() => {
        datasource = new Datasource();
        datasource.setData(simpleArray.slice());
    });

    it('expect currentEntity to be null by default', () => {
        expect(datasource.currentEntity).toEqual(null);
        
    });

    it('expect select() to set currentEntity to first entity in collection [0]', () => {
        datasource.select();
        expect(datasource.currentEntity).toEqual(simpleArray[0]);
        
    });

    it('expect selectLast() to set currentEntity to last entity [4]', () => {
        datasource.selectLast();
        expect(datasource.currentEntity).toEqual(simpleArray[4]);
        
    });

    it('expect selectFirst() to set currentEntity to first entity [0]', () => {
        datasource.selectFirst();
        expect(datasource.currentEntity).toEqual(simpleArray[0]);
        
    });

    it('expect selectNext() to set currentEntity to next entity [1]', () => {
        datasource.selectNext();
        expect(datasource.currentEntity).toEqual(simpleArray[1]);
        
    });

    it('expect selectNext() to set currentEntity to next entity [2]', () => {
        datasource.selectNext();
        expect(datasource.currentEntity).toEqual(simpleArray[2]);
        
    });

    it('expect selectPrev() to set currentEntity to next entity [1]', () => {
        datasource.selectPrev();
        expect(datasource.currentEntity).toEqual(simpleArray[1]);
        
    });

    it('expect selectLast() + selectNext() to set currentEntity to first [0]', () => {
        datasource.selectLast();
        datasource.selectNext();
        expect(datasource.currentEntity).toEqual(simpleArray[0]);
        
    });

    it('expect selectFist() + selectPrev() to set currentEntity to first [4]', () => {
        datasource.selectFirst();
        datasource.selectPrev();
        expect(datasource.currentEntity).toEqual(simpleArray[4]);
        
    });

    it('select(2)', () => {
        datasource.select(2);
        expect(datasource.currentEntity).toEqual(simpleArray[1]);
        
    });

    it('select row 1-3', () => {
        datasource.getSelection().highlightRow({} as any, 1);
        datasource.getSelection().highlightRow({ shiftKey: true } as any, 3);
        expect(datasource.getSelection().getSelectedRows()).toEqual([1, 2, 3]);
        
    });

    it('select row 1-3 and not row 2', () => {
        datasource.getSelection().highlightRow({} as any, 1);
        datasource.getSelection().highlightRow({ shiftKey: true } as any, 3);
        datasource.getSelection().highlightRow({ ctrlKey: true } as any, 2); // deselect
        expect(datasource.getSelection().getSelectedRows()).toEqual([1, 3]);
        
    });

    it('select row 2 and 4', () => {
        datasource.getSelection().deSelectAll();
        datasource.getSelection().highlightRow({ ctrlKey: true } as any, 2);
        datasource.getSelection().highlightRow({ ctrlKey: true } as any, 4);
        expect(datasource.getSelection().getSelectedRows()).toEqual([2, 4]);
        
    });

    it('select row 2 and 4', () => {
        datasource.getSelection().deSelectAll();
        datasource.getSelection().highlightRow({} as any, 2);
        datasource.getSelection().highlightRow({ ctrlKey: true } as any, 4);
        expect(datasource.getSelection().getSelectedRows()).toEqual([2, 4]);
        
    });

    it('deSelectAll, select -1, then shiftkey row 4', () => {
        datasource.getSelection().deSelectAll();
        datasource.getSelection().highlightRow({} as any, -1);
        datasource.getSelection().highlightRow({ shiftKey: true } as any, 4);
        expect(datasource.getSelection().getSelectedRows()).toEqual([4]);
        
    });

    // todo clear currentEntity on filter ?
});
