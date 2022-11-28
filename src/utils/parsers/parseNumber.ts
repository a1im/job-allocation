import { isString } from '../predicate/isString';
import { isNumber } from '../predicate/isNumber';

export const parseNumber = (data: unknown): number | undefined => {
    if (isNumber(data)) {
        return data;
    }
    if (isString(data)) {
        const res = parseFloat(data);

        return Number.isNaN(res) ? undefined : res;
    }
};
