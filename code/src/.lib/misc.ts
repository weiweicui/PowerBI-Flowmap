import { Grand } from './data';
import { Func, StringMap, clamp } from '../../lava/type';
import { ILocation } from '../../lava/bing';
import { IFormatter } from './formatter';
interface ILegendFormat {
    show: boolean;
    positoin: 'top' | 'bottom' | 'bot'
}
interface Legend {
    height(): number;
    resize(w: number): void;
}

export function coords<R extends string>(data: Grand<R, any>, keys: Func<number, string>, lati: R, long: R, dirty = false): StringMap<ILocation> {
    if (!data.dirty('data') && !data.roles.dirty(lati, long) && !dirty) {
        return null;
    }
    let result = {} as StringMap<ILocation>;
    if (!data.exist(lati, long)) {
        return result;
    }
    let lats = data.column(lati).values;
    let lons = data.column(long).values;
    let bad = (v: number) => isNaN(v) || v === null || v === undefined;
    for (let r of data.items.rows()) {
        let addr = keys(r);
        if (addr in result) {
            continue;
        }
        let lon = +lons[r], lat = +lats[r];
        if (bad(lon) || bad(lat)) {
            continue;
        }
        result[addr] = {
            longitude: clamp(lon, -180, 180),
            latitude: clamp(lat, -85.05112878, 85.05112878),
            type: 'injected',
            name: addr,
            address: addr
        };
    }
    return result;
}

export function layout(map: Microsoft.Maps.Map, fmt: ILegendFormat) {

}

export function obj(key: any, v: any) {
    let ret = {};
    ret[key] = v;
    return ret;
}

export function groupBy(rows: number[], group: Func<number, any>) {
    let result = {} as StringMap<number[]>;
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

export function dirty<F>(fmt: {[P in keyof F]: IFormatter<F[P]> }): F & { $: F } {
    let mark = { $: {}} as any;
    for (let key in fmt) {
        mark.$[key] = fmt[key as keyof F].dirty();
        mark[key] = mark.$[key] || {};
    }
    return mark;
}

export function compare<T>(a: T, b: T): T & { $: T } {

    return null;
}

export function isResizeMode(type: number) {
    return type === powerbi.VisualUpdateType.Resize
        || type === powerbi.VisualUpdateType.ResizeEnd
        || type === powerbi.VisualUpdateType.ViewMode;
}