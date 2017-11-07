export interface IBorder {
    left  : number;
    right : number;
    top   : number;
    bottom: number;
}

export interface ISize {
    width : number;
    height: number;
}

export interface IRect {
    x     : number;
    y     : number;
    width : number;
    height: number;
}

export interface IPoint {
    x: number;
    y: number;
}

export interface IResettable {
    reset(v?: any): this;
}

export type Match<T>     = { add: T[], remove: T[], update: T[] };
export type Action       = () => void;
export type StringMap<T> = { [k: string]: T };
export type Func<I, O>   = (i: I) => O;


export function dateString(values: Date[]): (v: Date) => string {
    var valids = values.filter(v => v && v instanceof Date);
    if (valids.length === 0) {
        return d => d + "";
    }
    var years = valids.map(v => v.getFullYear());
    var months = valids.map(v => v.getMonth());
    var dates = valids.map(v => v.getDate());
    var hours = valids.map(v => v.getHours());
    var mins = valids.map(v => v.getMinutes());
    var secs = valids.map(v => v.getSeconds());
    var same = (vals: number[]) => {
        var first = vals[0];
        return vals.some(v => v !== first);
    }
    var hm = (v: Date) => v.getHours() + ':' + v.getMinutes();
    var hms = (v: Date) => v.getHours() + ':' + v.getMinutes() + ':' + v.getSeconds();
    var dmy = (v: Date) => v.getDate() + '/' + (v.getMonth() + 1) + '/' + v.getFullYear();
    if (same(years)) {
        if (same(months) && same(dates)) {
            return same(secs) ? v => hm(v) + ' ' + dmy(v) : v => hms(v) + ' ' + dmy(v);
        }
        else {
            return v => dmy(v) + ' ' + hms(v);
        }
    }
    else {
        if (!same(secs)) {
            return v => dmy(v) + ' ' + hms(v);
        }
        if (!same(mins) || !same(hours)) {
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

export function keys(...data: StringMap<any>[]): string[] {
    let result = {} as StringMap<true>;
    for (let d of data) {
        for (let k in d) {
            result[k] = true;
        }
    }
    return Object.keys(result);
}

// export function keys(a: any): string[] {
//     return Object.keys(a);
// }

// export function mark(...data: StringMap<any>[]): StringMap<true> {
//     let result = {} as StringMap<true>;
//     for (let d of data) {
//         for (let k in d) {
//             result[k] = true;
//         }
//     }
//     return result;
// }

export function sameKeys(a: any, b: any): boolean {
    let keys = Object.keys(a);
    if (keys.length === Object.keys(b).length) {
        return keys.every(k => k in b);
    }
    return false;
}

export function copy<T>(source: Partial<T>, target?: T): T {
    target = target || {} as any;
    for (var key in source) {
        target[key] = source[key];
    }
    return target;
}

export function clamp(v: number, min: number, max: number): number {
    if (v < min)
        return min;
    if (v > max)
        return max;
    return v;
}

export function sameArray<T>(a: T[], b: T[]): boolean {
    if (a.length === b.length) {
        for (var i = 0, len = a.length; i < len; i++) {
            if (a[i] !== b[i])
                return false;
        }
        return true;
    }
    return false;
}

export function match<A, B>(exist: StringMap<A>, desire: StringMap<B>, remove: (a: A) => void, add: (b: B) => void, update?: (a: A, b: B) => void) {
    for (var ka of keys(exist)) {
        if (!(ka in desire)) {
            remove(exist[ka]);
        }
        else {
            update && update(exist[ka], desire[ka]);
        }
    }
    for (var kb of keys(desire)) {
        if (!(kb in exist)) {
            add(desire[kb]);
        }
    }
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

export function obj(key: string, val: any): StringMap<string> {
    let result = {};
    result[key] = val;
    return result;
}

export function find<T>(data: T[], p: Func<T, any>): T {
    for (let v of data) {
        if (p(v)) return v;
    }
    return undefined;
}

export function groupBy<T>(rows: T[], group: Func<T, any>):StringMap<T[]> {
    let result = {} as StringMap<T[]>;
    for (let r of rows) {
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


var idCache = {} as StringMap<string>;
export function randomID(key?: string) {
    if (key && key in idCache) {
        return idCache[key];
    }
    else {
        var text = "lava_";
        if (key === undefined || !(key in idCache)) {
            let keys = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            for (let i = 0; i < 8; i++)
                text += keys.charAt(Math.floor(Math.random() * keys.length));
        }
        if (key) {
            idCache[key] = text;
        }
        return text;
    }
}

export function check(assert: any, msg: string) {
    if (!assert) {
        console.log(msg);
    }
}

export function override(target, source) {
    for (let p in target) {
        if (target[p] === null) {
            if (source[p])
                target[p] = source[p];
        }
        else if (target[p].constructor == Object) {
            if (source[p])
                target[p] = override(target[p], source[p]);
        }
        else {
            if (source[p]) {
                target[p] = source[p];
            }
        }
    }
    return target;
}