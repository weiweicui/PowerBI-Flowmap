export interface ISize {
    width: number;
    height: number;
}

export interface IRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface IPoint {
    x: number;
    y: number;
}

export interface IResettable {
    reset(v?: any): this;
}

export type Action = () => void;

export type StringMap<T> = { [k: string]: T };

export type NumberMap<T> = { [k: number]: T };

export type Func<I, O> = (i: I) => O;

export function buildLabels(values: any[]): string[] {
    const validValues = values.map(v => toDate(v) || v);
    const validDates = validValues.filter(v => v && v instanceof Date);
    const date2Label = dateString(validDates);
    return validValues.map(v => v instanceof Date ? date2Label(v) : v + "");
}

export function toDate(value: Date | string | number): Date {
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string') {
        var ticks = Date.parse(value);
        return Number.isNaN(ticks) ? null : new Date(ticks);
    }
    return new Date(value);
}

function dateString(valids: Date[]): (v: Date) => string {
    if (valids.length === 0) {
        return null;
    }
    var years = valids.map(v => v.getFullYear());
    var months = valids.map(v => v.getMonth());
    var dates = valids.map(v => v.getDate());
    var hours = valids.map(v => v.getHours());
    var mins = valids.map(v => v.getMinutes());
    var secs = valids.map(v => v.getSeconds());
    var same = (vals: number[]) => {
        var first = vals[0];
        return vals.every(v => v === first);
    }
    var zero = (vals: number[]) => vals.every(v => v === 0);

    var str = (v: number) => v < 10 ? '0' + v : v;
    var hm = (v: Date) => str(v.getHours()) + ':' + str(v.getMinutes());
    var hms = (v: Date) => hm(v) + ':' + str(v.getSeconds());
    var dm = (v: Date) => v.getDate() + '/' + (v.getMonth() + 1);
    var dmy = (v: Date) => dm(v) + '/' + v.getFullYear();

    if (same(years)) {
        if (!zero(secs)) {
            return v => dm(v) + ' ' + hms(v);
        }
        if (!zero(mins) || !zero(hours)) {
            return v => dm(v) + ' ' + hm(v);
        }
        return v => dmy(v);
    }
    else {
        if (!zero(secs)) {
            return v => dmy(v) + ' ' + hms(v);
        }
        if (!zero(mins) || !zero(hours)) {
            return v => dmy(v) + ' ' + hm(v);
        }
        if (!same(dates)) {
            return v => v.getFullYear() + "-" + (v.getMonth() + 1) + "-" + v.getDate();
        }
        if (!same(months)) {
            return v => v.getFullYear() + "-" + (v.getMonth() + 1);
        }
        return v => v.getFullYear() + "";
    }
}

export function first<T>(data: T[], p: Func<T, any>, dft?: T): T {
    if (!data || data.length === 0) {
        return dft;
    }
    for (let v of data) {
        if (p(v)) {
            return v;
        }
    }
    return dft;
}

export function keys(...data: StringMap<any>[]): string[] {
    if (data.length === 0) {
        return [];
    }
    if (data.length === 1) {
        return Object.keys(data[0] || {});
    }
    let result = {} as StringMap<true>;
    for (let d of data) {
        for (let k in d) {
            result[k] = true;
        }
    }
    return Object.keys(result);
}

export function clamp(v: number, min: number, max: number): number {
    if (v < min)
        return min;
    if (v > max)
        return max;
    return v;
}

export function dict(values: string[] | number[] | (string | number)[]): StringMap<string>;
export function dict<K>(values: K[], key: Func<K, string | number>): StringMap<K>;
export function dict<K, V>(values: K[], key: Func<K, string | number>, val: Func<K, V>): StringMap<V>;
export function dict<K, V>(values: K[], key?: Func<K, string | number>, val?: Func<K, V>): StringMap<V> {
    var dict = {} as StringMap<V>;
    if (key) {
        for (var v of values) {
            dict[key(v)] = val ? val(v) : (v as any);
        }
    }
    else {
        for (var v of values) {
            dict[v as any] = v as any;
        }
    }
    return dict;
}

export function sequence(start: number, count: number): number[] {
    var result = [] as number[], end = start + count;
    for (; start < end; start++) {
        result.push(start);
    }
    return result;
}

export function sort<T>(data: T[], selector: (datum: T, idx: number) => number): T[] {
    if (!data) {
        return null;
    }
    let idxs = sequence(0, data.length);
    idxs.sort((i1, i2) => selector(data[i1], i1) - selector(data[i2], i2));
    let result = [] as T[];
    for (const i of idxs) {
        result.push(data[i]);
    }
    return result;
}


export function groupBy<V extends T, T>(values: readonly V[], group: Func<T, string | number>): StringMap<V[]> {
    let result = {} as StringMap<V[]>;
    for (let r of values) {
        let key = group(r);
        if (key in result) {
            result[key].push(r);
        }
        else {
            result[key] = [r];
        }
    }
    return result;
}

export function remap<I, O>(input: StringMap<I>, map: (key: string, val: I) => O): StringMap<O> {
    let result = {} as StringMap<O>;
    for (let key in input) {
        result[key] = map(key, input[key]);
    }
    return result;
}

export function pick<I, O>(data: I[], conv: Func<I, O>, where?: Func<I, any>): O[] {
    var ret = [] as O[];
    if (where) {
        return data.filter(where).map(conv);
    }
    for (let v of data) {
        let o = conv(v);
        if (o !== undefined && o !== null) {
            ret.push(o);
        }
    }
    return ret;
}

export function values<T>(a: StringMap<T>): T[] {
    return Object.keys(a).map(k => a[k]);
}

export function partial<T>(a: T, keys: (keyof T)[]): Partial<T> {
    var ret = {} as T;
    for (var key of keys) {
        ret[key] = a[key];
    }
    return ret;
}


export function check(assert: any, msg: string) {
    if (!assert) {
        debugger;
        console.log(msg);
    }
}

export function override(source: any, target: any) {
    if (!source) {
        return target;
    }
    for (let p in target) {
        if (target[p].constructor == Object) {
            if (source[p])
                target[p] = override(source[p], target[p]);
        }
        else {
            if (p in source) {
                target[p] = source[p];
            }
        }
    }
    return target;
}

export function copy<S>(source: S): S;
export function copy<T>(source: Partial<T>, target: T): T;
export function copy<S, T>(source: S, target: T): T;
export function copy<S, T>(source: S, target: T, keys: (keyof (S))[]): T | Partial<S>;
export function copy<T>(source: Partial<T>, target?: T, keys?: (keyof T)[]): T {
    target = target || {} as any;
    if (!source) {
        return target;
    }
    if (keys) {
        for (const key of keys) {
            if (key in source) {
                target[key] = source[key];
            }
        }
    }
    else {
        for (const key in source) {
            target[key] = source[key];
        }
    }
    return target;
}