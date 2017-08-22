import { Func } from './type';

export function sum(data: any[], map?: (d: any) => number, filter?: number[] | 'all'): number {
    let ret = 0, [start, end] = startend(data, filter);
    start = start || 0;
    end = end || (data.length - 1);
    if (map) {
        for (let i = start; i <= end; i++) {
            ret += (map(data[i]) || 0);
        }
        return ret;
    }
    else {
        for (let i = start; i <= end; i++) {
            ret += (data[i] || 0);
        }
        return ret;
    }
}

export function sequence(start: number, count: number): number[] {
    var result = [] as number[], end = start + count;
    for (; start < end; start++) {
        result.push(start);
    }
    return result;
}

export function last<T>(data: T[], idx?: number | ((v: T) => boolean)): T {
    if (!idx) {
        return data[data.length - 1];
    }
    else if (typeof idx === 'number') {
        return data[data.length - 1 - idx];
    }
    else {
        for (let i = data.length - 1; i >= 0; i--) {
            if (idx(data[i])) {
                return data[i];
            }
        }
        return undefined;
    }
}

export function max<T>(data: T[], map?: (d: T) => number, filter?: number[] | 'all'): number {
    let [start, end] = startend(data, filter);
    let max = Number.NEGATIVE_INFINITY, tmp: number;
    if (map) {
        for (; start <= end; start++) {
            if ((tmp = map(data[start])) != null && tmp > max) {
                max = tmp;
            }
        }
        return max;
    }
    else {
        for (; start <= end; start++) {
            if ((tmp = <any>data[start]) != null && tmp > max) {
                max = tmp;
            }
        }
        return max;
    }
}

export function repeat<T>(val: T, count: number): T[] {
    return Array.apply(null, Array(count)).map(() => val);
}

// export function select<T>(data: ReadonlyArray<T>, filter: Func<T, boolean>): T[] {
//     var result = [];
//     for (var d of data) {
//         filter(d) && result.push(d);
//     }
//     return result;
// }

export function min<T>(data: T[], map?: (d: T) => number, filter?: number[] | 'all'): number {
    let [start, end] = startend(data, filter);
    let min = Number.MAX_VALUE, tmp: number;
    if (map) {
        for (; start <= end; start++) {
            if ((tmp = map(data[start])) != null && tmp < min) {
                min = tmp;
            }
        }
        return min;
    }
    else {
        for (; start <= end; start++) {
            if ((tmp = <any>data[start]) != null && tmp < min) {
                min = tmp;
            }
        }
        return min;
    }
}

export function ext<T>(data: T[], map?: (d: T) => number, filter?: number[] | 'all'): number[] {
    let [start, end] = startend(data, filter);
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let tmp: number, i = 0;
    //find first valid number
    for (i = start || 0; i <= end; i++) {
        tmp = map ? map(data[i]) : <any>data[i];
        if (tmp < min) {
            min = max = tmp;
            i++;
            break;
        }
    }
    for (; i <= end; i++) {
        tmp = map ? map(data[i]) : <any>data[i];
        if (tmp > max)
            max = tmp;
        else if (tmp < min)
            min = tmp;
    }
    return [min, max, max - min];
}

function startend<T>(data: T[], filter?: number[] | 'all' | null): number[] {
    if (filter === 'all' || !filter) {
        return [0, data.length - 1];
    }
    else {
        return filter;
    }
}