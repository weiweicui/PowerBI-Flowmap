import { StringMap, randomID, Func, keys, dict, remap, groupBy } from 'type';
import { $fmt, $mapctl, loc, $cfg, GRAY } from './app';
import { values } from 'd3';
import { translate, scale } from 'd3/attr';
import { util } from './misc';
import { sum, extent } from 'array';
import * as flows from './flow';
import { IListener } from 'bing';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { Any } from 'd3-selection';
export class Pie {
    readonly addr: string;
    sum: number;
    readonly d3: d3.Any;
    readonly type: 'out'|'in';
    constructor(root: d3.Any, addr: string, rows: number[], type: 'out'|'in') {
        this.addr = addr;
        this.type = type;
        this.d3 = root.datum(this).att.class('pie');
        let weight = util.weighter();
        this.total = sum(rows, r => weight(r));
        this.rows = rows;
    }
    public rows: number[];
    public total: number;

    highlight() {
        this.reshape();
        this.radius(this._radius);
    }

    reshape() {
        this.d3.selectAll('*').remove();
        let slice = $fmt.bubble.slice, weight = util.weighter();
        if (!slice) {
            let color = $fmt.bubble.bubbleColor.solid.color;
            this.d3.append('circle').att.class('mask').att.fill(color)
                .att.stroke_opacity(0.8).att.stroke('white');
        }
        else {
            let flags = $cfg.selection.flags();
            let conv = $cfg.color.conv;
            if (flags) {
                conv = r => r in flags ? $cfg.color.conv(r) : GRAY;
            }
            let groups = groupBy(this.rows, conv);
            let colors = keys(groups);
            if (colors.length === 1) {
                this.d3.append('circle').att.class('mask').att.fill(colors[0])
                    .att.stroke_opacity(0.8).att.stroke('white');
            }
            else {
                let slices = this.d3.append('g').att.class('slice');
                this.d3.append('circle').att.class('mask')
                    .att.fill('none').att.stroke('white')
                    .att.stroke_width(1).att.stroke_opacity(0.8);
                let unit = 1 / this.total * 2 * Math.PI;
                let angles = colors.map(c => sum(groups[c], r => weight(r)) * unit);
                var start = 0 - Math.PI / 2;
                for (var i = 0; i < angles.length; i++) {
                    var path = ['M 0 0'] as any[];
                    var sx = Math.cos(start);
                    var sy = Math.sin(start);
                    start += angles[i];
                    var ex = Math.cos(start);
                    var ey = Math.sin(start);
                    path.push('L', sx, sy);
                    path.push('A', 1, 1, 0);
                    path.push(angles[i] > Math.PI ? 1 : 0, 1, ex, ey, 'Z');
                    slices.append('path').att.d(path.join(' '))
                        .att.fill(colors[i]);
                }
            }
        }        
        this.d3.att.transform(this.translate($mapctl.map));
    }
        
    private _radius = 1;
    radius(radius?: number): number {
        if (radius === undefined) {
            return this._radius;
        }
        radius = radius || this._radius;
        this.d3.selectAll('.slice').att.transform(scale(radius));
        this.d3.selectAll('.mask').att.r(radius);
        return this._radius = radius;
    }

    translate(map: Microsoft.Maps.Map): string {
        return translate($mapctl.pixel(loc(this.addr)));
    }
}

let root: d3.Any;

export function listener(d3: d3.Any): IListener {
    root = d3;
    return {
        transform(map: Microsoft.Maps.Map, tzoom: number) {
            root.selectAll<Pie>('.pie').att.transform(p => p.translate(map));
        }
    }
}

export function clear(): void {
    root.selectAll('*').remove();
    _rows = [];
    origins = {};
    destins = {};
}

export function get(key: string): Pie {
    if (key.split(' ')[0] === 'in') {
        return destins[key.substr('in '.length)];
    }
    else {
        return origins[key.substr('out '.length)];
    }
}

export function all() {
    return root.selectAll<Pie>('.pie');
}

let _rows = [] as number[];
export function reset(data: number[]) {
    _rows = data;
    root.selectAll('*').remove();
    let type = $fmt.bubble.for;
    let orig = $cfg.source, dest = $cfg.target;
    if ($fmt.style.direction !== 'out') {
        orig = $cfg.target, dest = $cfg.source;
    }
    origins = destins = {};
    if (type === 'origin' || type === 'both') {
        origins = build(groupBy(data, orig), 'out');
    }
    if (type === 'dest' || type === 'both') {
        destins = build(groupBy(data, dest), 'in');
    }
    let allPies = values(origins).concat(values(destins));
    root.selectAll<Pie>('.pie').sort((a, b) => b.total - a.total);
    $cfg.bubble.onPieChanged && $cfg.bubble.onPieChanged(root.selectAll<Pie>('.pie'));
    resetRadius();
}

let origins = {} as StringMap<Pie>;
let destins = {} as StringMap<Pie>;

function build(groups: StringMap<number[]>, type: 'in' | 'out') {
    return remap(groups, (addr, rows) => {
        let pie = new Pie(root.append('g'), addr, rows, type);
        pie.reshape();
        return pie;
    });
}

function resetRadius() {
    let width = $cfg.width.scale;
    let all = values(origins).concat(values(destins));
    let pmax = Math.max(...all.map(p => p.total));
    let [dmin, dmax] = flows.reweight(null);
    //pmax may be bigger than dmax, if sources are turned on
    let slider = +$fmt.bubble.scale, factor = slider / 10;
    let radius = w => 6;
    if ($cfg.width.value) {
        //categorical, so dmin and dmax are directly widths
        if (factor === 0) {
            radius = w => +$fmt.width.item + 2;
        }
        else {
            let domain = [dmin, Math.max(pmax, dmax)];
            let scale = scaleLinear().domain(domain).range([dmin, dmax]);
            radius = w => {
                // console.log(w, scale(w), dmin, dmax, pmax);
                return scale(w) * factor;
            };
        }
    }
    else if (!$cfg.weight && $fmt.style.type !== 'flow') {
        //no weight field and not flow style: only use default width
        if (factor === 0) {
            radius = w => Math.max(+$fmt.width.item, 2);
        }
        else {
            radius = w => Math.sqrt(width(w)) * factor;
        }
    }
    else {
        //has weight field or is flow type
        if ($fmt.width.scale === 'none') {
            let unit = +$fmt.width.unit;
            if (factor === 0) {
                radius = w => Math.max(dmin * unit, 2);
            }
            else if (pmax > dmax) {
                let scale = scaleLinear().domain([dmin, pmax]).range([dmin * unit, dmax * unit]);
                radius = w => Math.sqrt(scale(w)) * factor * 2;
            }
            else {
                radius = w => w * unit * factor;
            }
        }
        else {
            if (factor === 0) {
                radius = w => Math.max(width(dmin), 2);
            }
            else {
                let rmin = Math.max(0, +$fmt.width.min), rmax = +$fmt.width.max;
                if (pmax < dmax) {//is flow style && sources are not included
                    rmax = width(pmax);
                }
                let wmin = dmin, wmax = pmax;
                let span = 4, len = 0.5, start = span * (slider / 100) - span / 2;
                let sigx = linear(wmin, wmax, start, start + len), ext = len * slider / 500;
                let rad = linear(sigmoid(start - ext), sigmoid(start + len + ext), rmin / 4, rmax);
                let scale = Math.sqrt((slider > 70 ? (slider - 70) * 20 + 70 : slider) / 20);
                radius = w => Math.max(0.0000001, rad(sigmoid(sigx(w))) * scale);
            }
        }
    }
    
    for (let pie of all) {
        pie.radius(radius(pie.total));
    }
}

function linear(dmin: number, dmax: number, rmin: number, rmax: number): Func<number, number> {
    let dspan = dmax - dmin, rspan = rmax-rmin;
    return w => (w - dmin) / dspan * rspan + rmin;
}

function sigmoid(x: number): number {
    return x / (Math.sqrt(1 + x * x));
    // let v = Math.exp(x);
    // return v / (1 + v);
}

export function reorder() {
    if ($fmt.bubble.for === 'none') {
        return;
    }
    var flags = $cfg.selection.flags();
    if (flags) {
        root.selectAll<Pie>('.pie').sort((a, b) => {
            if (a.addr in flags) {
                return b.addr in flags ? b.sum - a.sum : 1;
            }
            else {
                return b.addr in flags ? -1 : b.sum - a.sum;
            }
        });
    }
    else {
        root.selectAll<Pie>('.pie').sort((a, b) => b.total - a.total)
    }
}


export function hover(addrs: string[]) {
    if (addrs) {
        var marks = dict(addrs);
        root.selectAll<Pie>('.mask').filter(p => p.addr in marks)
            .att.stroke('#333');
    }
    else {
        root.selectAll<Pie>('.mask').att.stroke('white');
    }
}

// export let config = {
//     slice: false,
//     for: 'dest' as 'none' | 'origin' | 'dest' | 'both',
// }

export function reformat(repie: any, recolor: any, reradius: any) {
    if (repie) {
        reset(_rows);
        return;
    }
    if (recolor) {
        root.selectAll('circle').att.fill($fmt.bubble.bubbleColor.solid.color);
    }
    if (reradius) {
        resetRadius();
    }
}