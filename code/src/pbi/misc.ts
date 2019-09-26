import { Context } from './Context';
import { Func, StringMap, clamp } from '../lava/type';
import { ILocation } from '../lava/bingmap/converter';

export function coords<R extends string>(data: Context<R, any>, key: R, lati: R, long: R, locs: StringMap<ILocation>): StringMap<ILocation> {
    if (!data.cat(key) || !data.cat(lati) || !data.cat(long)) {
        return locs;
    }
    const lats = data.cat(lati).data as number[];
    const lons = data.cat(long).data as number[];
    const keys = data.cat(key).data as string[];
    const bad = (v: number) => isNaN(v) || v === null || v === undefined;
    for (const r of data.rows()) {
        const addr = keys[r];
        if (addr in locs) {
            continue;
        }
        const lon = +lons[r], lat = +lats[r];
        if (bad(lon) || bad(lat)) {
            continue;
        }
        locs[addr] = {
            longitude: clamp(lon, -180, 180),
            latitude: clamp(lat, -85.05112878, 85.05112878),
            type: 'injected',
            name: addr,
            address: addr
        };
    }
    return locs;
}