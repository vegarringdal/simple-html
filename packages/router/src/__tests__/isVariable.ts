import { isVariable } from '../isVariable';

describe('isVariable', () => {
    it('should :name is variable', () => {
        const result = isVariable(':name');
        expect(result).toEqual(true);
    });
    it('should name: is not variable', () => {
        const result = isVariable('name:');
        expect(result).toEqual(false);
    });
    it('should name is not varibale', () => {
        const result = isVariable('name');
        expect(result).toEqual(false);
    });
});
