import { ILocation,IListener } from "bing";
import { StringMap, IPoint, Func, dict, keys } from "type";
import { translate } from "d3/attr";
import { $cfg, $mapctl, loc, $fmt, $border } from './app';
import { drag } from 'd3-drag';
import { select, event } from 'd3-selection';
export function listener(d3: d3.Any): IListener {
    root = d3;
    return {
        transform(map: Microsoft.Maps.Map, tzoom: number) {
            if (!$fmt.advance.relocate) {
                return;
            }
            root.selectAll<string>('.pin.valid').att.transform(addr => {
                return translate($mapctl.pixel(loc(addr)));
            });
        },
        resize(map: Microsoft.Maps.Map) {
            resize();
        }
    }
}

function resize() {
    var length = root.selectAll('.pin.invalid').size();
    if (length === 0) {
        return;
    }
    var pixer = _placer(length);
    root.selectAll('.pin.invalid').att.transform((d, i) => translate(pixer(i)));
}

let root: d3.Any;
let groups = {} as StringMap<d3.Any>;

export function clear() {
    groups = {};
    root.selectAll('*').remove();
}

let _drag = drag()
    .subject((d: string) => {
        let location = loc(d);
        if (location) {
            return $mapctl.pixel(location);
        }
        else if (groups[d].classed('invalid')) {
            var str = groups[d].attr('transform');
            var [a, b] = str.split(',');
            var x = +a.split('(')[1];
            var y = +b.split(')')[0];
            return { x, y };
        }
        else {
            return { x: 0, y: 0 };
        }
    })
    .on('start', (d: string) => {
        (event as any).sourceEvent.stopPropagation();
        if (groups[d].classed('invalid')) {
            groups[d].select('title').text(d);
        }
        groups[d].att.class('pin valid dirty');
    })
    .on('drag', (d: string) => {
        var pnt = event as any;
        groups[d].att.transform(translate(pnt.x, pnt.y));
        $cfg.location.manual[d] = $mapctl.location(pnt);
    });


export function reset(rows: number[]) {
    if ($fmt.advance.relocate) {
        root.sty.display(null);
    }
    else {
        clear();
        root.sty.display('none');
        return;
    }
    root.selectAll('*').remove();
    let dict = {} as StringMap<ILocation>;
    for (let row of rows) {
        let src = $cfg.source(row);
        let tar = $cfg.target(row);
        dict[src] = loc(src);
        dict[tar] = loc(tar);
    }
    let valids = [] as string[], invalids = [] as string[];
    for (let key in dict) {
        dict[key] ? valids.push(key) : invalids.push(key);
    }
    _setup(valids, true);
    if (invalids.length > 0) {
        invalids.sort();
        _setup(invalids, false);
        resize();
    }
}

export function reformat() {
    var { located, unlocated } = $fmt.advance;
    root.selectAll('.pin.valid').sty.display(located ? null : 'none');
    root.selectAll('.pin.invalid').sty.display(unlocated ? null : 'none');
}    

function _placer(length: number): Func<number, IPoint> {
    var { x, y, width, height } = $border;
    var loc = null as Func<number, IPoint>, gap = Math.min(20, width / length);
    return i => {
        return { x: i * gap - width / 2 + 10, y: height / 2 - 20 };
    }
}

function _setup(addrs: string[], valid: boolean) {
    let selector = '.pin.' + (valid ? 'valid' : 'invalid');
    let group = root.selectAll(selector).data(addrs).enter().append('g');
    group.append('path').att.d('m 0 0 c -0.73840 -3.6248 -2.0403 -6.6412 -3.6172 ' +
        '-9.4370 c -1.1697 -2.0738 -2.5246 -3.9879 -3.7784 -5.9988 c -0.41851 ' +
        '-0.67131 -0.77970 -1.3805 -1.1818 -2.0772 c -0.80411 -1.3931 -1.4561 ' +
        '-3.0083 -1.4146 -5.1035 c 0.040476 -2.0471 0.63253 -3.6892 1.4863 -5.0318 ' +
        'c 1.4042 -2.2083 3.7562 -4.0188 6.9121 -4.4946 c 2.5803 -0.38903 4.9995 ' +
        '0.26823 6.7151 1.2714 c 1.4019 0.81977 2.4875 1.9148 3.3128 3.2053 c 0.86133 ' +
        '1.3470 1.4545 2.9383 1.5042 5.0139 c 0.025467 1.0634 -0.14867 2.0482 -0.39398 ' +
        '2.8651 c -0.24826 0.82684 -0.64754 1.5180 -1.0028 2.2563 c -0.69345 1.4411 ' +
        '-1.5628 2.7616 -2.4353 4.0828 c -2.5988 3.9354 -5.0380 7.9488 -6.1063 13.448 Z');
    group.append('circle').att.fill('black').att.cx(0).att.cy(-23.24).att.r(3.5);
    group.call(_drag as any);
    if (valid) {
        group.classed('pin valid', true)
            .att.transform(k => translate($mapctl.pixel(loc(k))))
            .append('title').text(k => k);
    }
    else {
        group.classed('pin invalid', true)
            .append('title').text(k => k+'(unlocated)');
    }
    group.each(function (d: string) { groups[d] = select(this); });
}