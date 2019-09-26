import { format } from 'd3-format';
import { Config } from './config';
import { Func } from '../../type';

export function top(rows: number[], cfg: Config): number[] {
    const { sort, top } = cfg.numberSorter;
    const width = cfg.weight && cfg.weight.conv;
    if (width) {
        if (sort === 'des') {
            rows.sort((a, b) => width(b) - width(a));
        }
        else {
            rows.sort((a, b) => width(a) - width(b));
        }
    }
    return +top >= rows.length ? rows : rows.slice(0, +top);
}

export function weighter(cfg: Config): Func<number, number> {
    if (cfg.weight) {
        return r => Math.max(cfg.weight.conv(r), 0);
    }
    else {
        return r => 1;
    }
}

export function rgb(hex: string) {
    let n = parseInt(hex.substr(1), 16);
    return [(n >> 16 & 0xff), (n >> 8 & 0xff), (n & 0xff)];
}

export function bad(v: number): boolean {
    return isNaN(v) || v === null || v === undefined || v === Number.POSITIVE_INFINITY || v === Number.NEGATIVE_INFINITY;
}

export function nice(values: number[]): string[] {
    if (values.some(v => bad(v))) {
        return values.map(v => 'n/a');
    }
    if (values[0] === values[values.length - 1]) {
        let result = values.map(v => v + '');
        if (result[0].length < 4) {
            return result;
        }
    }
    for (let i = 1; i < 6; i++) {
        let f = format('.' + i + 's'), j = 1;
        let result = values.map(v => f(v));
        for (; j < values.length; j++) {
            if (result[j - 1] === result[j]) {
                break;
            }
        }
        if (j === values.length || i === 5) {
            return result;
        }
    }
}    
