import { Setting } from 'numberFormat';
import { MapFormat } from 'bing';
import { keys } from 'type';
//pbi free

class ValueFormat extends Setting {
    sort = 'des' as 'asc' | 'des';
    top = 10;
}


export type Dirty<F> = {[O in keyof F]: {[P in keyof F[O]]?: true}} & { $: {[P in keyof F]?: true} };
export function merge<F>(from: F, to: F): Dirty<F> {
    let result = { $: {} } as any;
    for (let oname in to) {
        let fobjs = from[oname], tobjs = to[oname];
        if (!fobjs) {
            result[oname] = {};
            continue;
        }
        let dirty = {} as any;
        for (let pname in fobjs) {
            tobjs[pname] = fobjs[pname];
            dirty[pname] = true;
        }
        result[oname] = dirty;
        if (keys(dirty).length !== 0) {
            result.$[oname] = dirty;
        }
    }
    return result;
}

var mapfmt = new MapFormat();

export class Format {
    legend = {
        show: true,
        position: 'top' as 'top' | 'bot',
        fontSize: 12,
        color: true,
        width: true,
        color_default: false,
        width_default: false,
        color_label: null as string,
        width_label: null as string
    };

    style = {
        type: null as 'straight' | 'flow' | 'arc',
        direction: 'out' as 'in' | 'out',
        limit: 5
    };

    width = {
        customize: true,
        item: 2,
        scale: 'linear' as 'linear' | 'log' | 'none',
        min: 2,
        max: 10,
        unit: null as number
    };

    color = {
        fill: { solid: { color: '#01B8AA' } },
        min: { solid: { color: '#99e3dd' } },
        max: { solid: { color: '#015c55' } },
        autofill: false,
        customize: true
    };

    advance = {
        cache: true,
        relocate: false,
        located: true,
        unlocated: true
    };

    mapControl = MapFormat.control(mapfmt, { autoFit: true });

    mapElement = MapFormat.element(mapfmt, {});

    valueFormat = new ValueFormat();

    bubble = {
        for: null as 'none' | 'origin' | 'dest' | 'both',
        slice: null as boolean,
        bubbleColor: { solid: { color: '#888888' } },
        scale: 25,
        label: 'none' as 'none' | 'all' | 'manual' | 'hide',
        labelOpacity: 50,
        originColor: { solid: { color: '#888888' } },
        destinColor: { solid: { color: '#888888' } }
    };
}
