import { tooltip } from 'tooltip';
import { Banner } from 'banner';
import { msgs } from './app';
import { Flow, VisualFlow } from './structure';
import { ILocation, ILayer, append, query } from "bing";
import { $con, $fmt } from "./visual";
import { dict, values, select, StringMap, IPoint, keys, randomID, Func, clamp } from "type";
import { min, max, sum } from "array";
import { translate, scale } from "d3/attr";

import { pixel, coordinate } from 'bing';

class FlowGroup {
    d3: d3.Any;
    
    constructor(root: d3.Any) {
        this.d3 = root;
    }

    clear() {
        this.d3.selectAll('*').remove();
        this._flows = {};
    }

    remove(flows: VisualFlow[]) {
        for (var flow of flows) {
            flow.remove();
            delete this._flows[flow.key];
        }
    }

    sortFlows() {
        var score = { empty: '1', partial: '2', full: '3' };
        this.d3.selectAll<VisualFlow>('.visualflow')
            .sort((a, b) => score[a.state].localeCompare(score[b.state]));
        for (var f of values(this._flows)) {
            f.sortPaths();
        }
    }
    
    move(addrs: string[]) {
        var filter = (f: VisualFlow) => addrs.some(a => f.contains(a));
        for (var f of select(values(this._flows), filter)) {
            f.relayout();
        }
    }

    rescale() {
        for (var f of values(this._flows)) {
            f.rescale();
        }
    }

    transform(map: Microsoft.Maps.Map, tzoom: number) {
        for (var f of values(this._flows)) {
            f.transform(map, tzoom);
        }
    }

    add(input: Flow): VisualFlow {
        var flow = new VisualFlow(this.d3.append('g'), input);
        this._flows[input.key] = flow;
        return flow;
    }
    
    display(v: boolean) {
        this.d3.sty.display(v ? null : 'none');
    }

    contains(key: string) {
        return key in this._flows;
    }

    //calc null or [min, max]    
    extend(): [number, number] {
        if (!this._flows) {
            return null;
        }            
        var flows = values(this._flows);
        if (flows.length === 0) {
            return null;
        }
        var min = Number.POSITIVE_INFINITY;
        var max = Number.NEGATIVE_INFINITY;
        for (var flow of flows) {
            if (flow.extend) {
                min = Math.min(min, flow.extend[0]);
                max = Math.max(max, flow.extend[1]);
            }
        }
        if (min === Number.POSITIVE_INFINITY) {
            return null;
        }
        else {
            return [min, max];
        }
    }
    
    get flows() {
        return this._flows;
    }

    flow(key: string): VisualFlow {
        return this._flows[key];
    }

    private _flows = {} as StringMap<VisualFlow>;
}

class Pie {
    readonly addr: string;
    sum: number;
    rows = {} as StringMap<number>;
    readonly d3: d3.Any;
    constructor(root: d3.Any, addr: string) {
        this.addr = addr;
        this.d3 = root.datum(this);
        var { label, show } = $fmt.bubble.values;
        this.d3.sty.cursor(label === 'manual' ? 'pointer' : 'default')
            .sty.display(show ? null : 'none');
    }
    
    public topFlows(): [string[], number] {
        var ids = keys(this.rows);
        var { sort, top } = $con.fmt.valueFormat.values;
        var weight = (key: string) => $con.weight(this.rows[key]);
        if (sort === 'des') {
            ids.sort((a, b) => weight(b) - weight(a));
        }
        else {
            ids.sort((a, b) => weight(a) - weight(b));
        }
        var rest = ids.length - (+top);
        if (rest > 0) {
            ids = ids.slice(0, +top);
        }
        return [ids, rest];
    }

    tooltip(): HTMLElement {
        var div = d3.select(document.createElement('div'))
            .att.class('info').att.id(randomID(this.addr)).datum(this);
        var row = values(this.rows)[0];
        div.append('div').text($con.targetTip(row)).att.class('header');
        var [keys, rest] = this.topFlows();
        for (var fkey of keys) {
            var flow = $con.layer.flow(fkey);
            var prow = div.append('div').att.class('row');
            prow.append('div').att.class('cell color').append('svg')
                .append('circle').att.class(randomID(fkey))
                .att.cx(5).att.cy(8).att.r(5)
                .att.fill(flow.colorOf(this.addr))
                .att.stroke('white').att.stroke_width(1).att.stroke_opacity(0.8);
            if ($con.colour !== $con.source) {
                prow.append('div').att.class('class title')
                    .text($con.sourceTip(flow.row));
            }
            prow.append('div').att.class('cell value')
                .text($con.weightTip(flow.tar2row[this.addr]));
        }
        if (rest > 0) {
            var prow = div.append('div').att.class('row');
            prow.append('div').att.class('cell color').text('...')
                .sty.text_align('center');
            if ($con.colour !== $con.source) {
                prow.append('div').att.class('class title');
            }
            prow.append('div').att.class('cell value')
                .text('(' + rest + ' more)');
        }
        return div.node() as HTMLElement;
    }

    private _cnt = 0;
    reshape() {
        var fkeys = keys(this.rows), sum = this.sum, addr = this.addr;
        this._cnt = fkeys.length;
        this.d3.selectAll('*').remove();
        if (fkeys.length === 1) {
            var flow = $con.layer.flow(fkeys[0]);
            this.d3.append('circle')
                .att.class(randomID(flow.key) + ' mask')
                .att.fill(flow.colorOf(addr))
                .att.stroke_opacity(0.8)
                .att.stroke('white');
        }
        else {
            var slices = this.d3.append('g').att.class('slice');
            this.d3.append('circle').att.class('mask')
                .att.fill('none').att.stroke('white')
                .att.stroke_width(1).att.stroke_opacity(0.8);
            var angles = fkeys.map(key => {
                return $con.weight(this.rows[key]) / sum * 2 * Math.PI;
            });
            var start = 0 - Math.PI / 2;
            for (var i = 0; i < angles.length; i++) {
                var flow = $con.layer.flow(fkeys[i]);
                var path = ['M 0 0'] as any[];
                var sx = Math.cos(start);
                var sy = Math.sin(start);
                start += angles[i];
                var ex = Math.cos(start);
                var ey = Math.sin(start);
                path.push('L', sx, sy);
                path.push('A', 1, 1, 0);
                path.push(angles[i] > Math.PI ? 1 : 0, 1, ex, ey, 'Z');
                slices.append('path')
                    .att.d(path.join(' '))
                    .att.fill(flow.colorOf(addr))
                    .att.class(randomID(flow.key));
            }
        }
        this.d3.att.transform(this.translate($con.layer.map));
        this.radius($fmt.bubble.values.size, $con.legend.scale());
    }
    
    private _radius = 1;
    radius(unit?: number, factor?: Func<number, number>): number {
        if (unit === undefined) {
            return this._radius;
        }
        var radius = this._radius = Math.sqrt(factor(this.sum)) * unit;
        if (this._cnt === 1) {
            this.d3.select('circle').att.r(radius);
        }
        else {
            this.d3.select('.slice').att.transform(scale(radius));
            this.d3.select('.mask').att.r(radius);
        }
        return this._radius;
    }

    translate(map: Microsoft.Maps.Map): string {
        return translate(pixel(map, query(this.addr)));
        //return translate(map.tryLocationToPixel(query(this.addr) as any))
    }
}

class PieGroup {
    private _pies = {} as StringMap<Pie>;
    private _d3: d3.Any;
    private _banner = null as Banner<Pie>;
    
    clear() {
        this._d3.selectAll('*').remove();
        this._pies = {};
        this._banner.clear();
    }
    
    constructor(root: d3.Any) {
        this._d3 = root;
        var svg = this._d3.node() as SVGSVGElement;
        while (!svg.createSVGPoint) {
            svg = svg.parentNode as SVGSVGElement;
        }
        this._banner = new Banner<Pie>(d3.select('#lava_banner'))
            .content(p => p.tooltip())
            .key(p => p.addr)
            .anchor(p => {
                var pnt = $con.layer.pixel(p.addr, Microsoft.Maps.PixelReference.control);
                if ($con.fmt.legend.values.show && $con.fmt.legend.values.position === 'top') {
                    pnt.y += $con.legend.height();
                }
                pnt.y -= p.radius();
                return pnt;
            });
    }
    
    private _onclick = (p: Pie) => {
        if ($con.fmt.bubble.values.label === 'manual') {
            this._banner.flip(p, 'top');
            this._banner.contains(p) && tooltip.hide();
        }
    }

    sortPies() {
        if (!$fmt.bubble.values.show) {
            return;
        }
        var flags = $con.selection.flags();
        if (flags) {
            var marks = dict(keys(flags), i => $con.target(+i));
            this._d3.selectAll<Pie>('.bubble').sort((a, b) => {
                if (a.addr in flags) {
                    return b.addr in marks ? b.sum - a.sum : 1;
                }
                else {
                    return b.addr in marks ? -1 : b.sum - a.sum;
                }
            });
        }
    }

    reformat() {
        if ($con.roleDirty('OName', 'DName', 'Tooltip') || $con.fmt.valueFormat.dirty()) {
            for (var pie of values(this._pies)) {
                this._banner.update(pie);
            }
        }
        if ($fmt.bubble.dirty('size')) {
            this.rescale();
        }
        var { show, label } = $fmt.bubble.values;
        if ($fmt.bubble.dirty('show')) {
            this._d3Display(show);
            this._banner.display(show && label !== 'none' && label !== 'hide');
            if (show) {
                this._d3Display(show);
                this.transform($con.layer.map, $con.layer.map.getZoom());
                this._d3.selectAll('.bubble').sty.display(null);
                if (label !== 'none' && label !== 'hide') {
                    this._banner.transform();
                }
            }
        }
        if ($fmt.legend.dirty('position')) {
            if (label !== 'none' && label !== 'hide') {
                this._banner.transform();
            }
        }
        if ($fmt.bubble.dirty('label')) {
            if (label === 'hide') {
                this._banner.display(false);
                this._d3.selectAll('.bubble').sty.cursor('default');
            }
            if (label === 'none') {
                this._banner.clear();
                this._banner.display(false);
                this._d3.selectAll('.bubble').sty.cursor('default');
            }
            if (label === 'all') {
                this._banner.display(show);
                this._d3.selectAll<Pie>('.bubble')
                    .each(p => this._banner.add(p));
                this._banner.transform();
            }
            if (label === 'manual') {
                this._banner.display(show);
                show && this._banner.transform();
            }
            this._d3.selectAll('.bubble')
                .sty.cursor(label === 'manual' ? 'pointer' : 'default');
        }
        if ($fmt.bubble.dirty('labelOpacity')) {
            this._banner.opacity(clamp(+$fmt.bubble.values.labelOpacity, 0, 1));
        }
    }

    hover(addrs: string[], type: 'over' | 'out') {
        if (type === 'out') {
            if (!$fmt.bubble.values.show) {
                this._d3Display(false);
            }
            this._d3.selectAll<Pie>('.bubble').classed('hover', false);
            this._d3.selectAll<Pie>('.mask').att.stroke('white');
        }
        else {
            var marks = dict(addrs);
            if ($fmt.bubble.values.show) {
                this._d3.selectAll<Pie>('.mask')
                    .filter(p => p.addr in marks)
                    .att.stroke('#333');
            }
            else {
                var map = $con.layer.map;
                this._d3.selectAll<Pie>('.bubble')
                    .sty.display(p => p.addr in marks ? null : 'none')
                    .filter(p => p.addr in marks)
                    .att.transform(p => p.translate(map))
                    .classed('hover', true)
                    .selectAll('.mask').att.stroke('#333');
                this._d3Display(true);
            }
        }
    }

    move(addrs: string[]) {
        if (!addrs || !addrs.length) {
            return;
        }
        if ($con.fmt.bubble.values.show) {
            var mark = dict(addrs), map = $con.layer.map;
            this._d3.selectAll<Pie>('.bubble')
                .filter(p => p.addr in mark)
                .att.transform(p => p.translate(map));
        }
        for (var tar of addrs) {
            if (tar in this._pies) {
                continue;
            }
            var flows = [] as VisualFlow[];
            for (var f of values($con.layer.flows)) {
                if (tar in f.tar2row) {
                    flows.push(f);
                }
            }
            if (flows.length === 0) {
                continue;
            }
            var root = this._d3.append('g').att.class('bubble')
                .on('click', this._onclick);
            tooltip.add(root, this._ontooltip);
            var pie = this._pies[tar] = new Pie(root, tar);
            for (var vflow of flows) {
                pie.rows[vflow.key] = vflow.tar2row[tar];
                pie.sum = sum(values(pie.rows).map(r => $con.weight(+r)));
            }
            pie.reshape();
            this._banner.update(pie);
            if ($fmt.bubble.values.label === 'all') {
                this._banner.add(pie);
            }
        }
        this.tryMoveBanners();
    }

    transform(map: Microsoft.Maps.Map, tzoom: number) {
        if ($con.fmt.bubble.values.show) {
            this._d3.selectAll<Pie>('.bubble').att.transform(p => p.translate(map));
            this.tryMoveBanners();
        }
        else {
            this._d3.selectAll<Pie>('.bubble.hover').att.transform(p => p.translate(map));
        }
    }

    add(vflow: VisualFlow) {
        var targets = keys(vflow.tar2row);
        for (var tar of targets) {
            var pie = this._pies[tar];
            if (!pie) {
                var root = this._d3.append('g').att.class('bubble')
                    .on('click', this._onclick);
                tooltip.add(root, this._ontooltip);
                pie = this._pies[tar] = new Pie(root, tar);                
            }
            pie.rows[vflow.key] = vflow.tar2row[tar];
            pie.sum = sum(values(pie.rows).map(r => $con.weight(+r)));
            pie.reshape();
            this._banner.update(pie);
            if ($fmt.bubble.values.label === 'all') {
                this._banner.add(pie);
            }
        }
    }

    private _ontooltip = (arg: any) => {
        var pie = arg.data as Pie;
        if (this._banner.contains(pie)) {
            return null;
        }
        var [keys, rest] = pie.topFlows();
        var tips = [] as powerbi.extensibility.VisualTooltipDataItem[];
        var header = pie.addr;
        for (var key of keys) {
            var flow = $con.layer.flow(key);
            tips.push({
                header: header,
                displayName: $con.sourceTip(flow.row),
                value: $con.weightTip(flow.tar2row[pie.addr])
            })
        }
        if (rest > 0) {
            tips.push({
                header: header,
                displayName: "...",
                value: `(${rest} more)`
            })
        }
        return tips;
    };

    private _d3Display(v: boolean) {
        this._d3.sty.display(v ? null : 'none');
    }

    display(v: boolean) {
        if (v) {
            let { show, label } = $con.fmt.bubble.values;
            if (show) {
                this._d3Display(v);
                if (label !== 'none' && label !== 'hide') {
                    this._banner.display(v);
                }
            }
            this.transform($con.layer.map, $con.layer.map.getZoom());
        }
        else {
            this._d3Display(v);
            this._banner.display(v);
        }
    }

    rescale() {
        var unit = $fmt.bubble.values.size;
        var func = $con.legend.scale();
        for (var pie of values(this._pies)) {
            pie.radius(unit, func);
        }
        this.tryMoveBanners();
    }

    public tryMoveBanners() {
        var label = $con.fmt.bubble.values.label;
        if (label !== 'none' && label !== 'hide') {
            this._banner.transform();
        }
    }

    recolor(v: VisualFlow) {
        var selector = '.' + randomID(v.key);
        this._d3.selectAll<Pie>(selector)
            .att.fill(p => v.colorOf(p.addr));
        this._banner.root().selectAll<Pie>(selector)
            .att.fill(p => v.colorOf(p.addr));
    }

    remove(flows: VisualFlow[]) {
        var pies = {} as StringMap<Pie>;
        for (var flow of flows) {
            for (var tar of keys(flow.tar2row)) {
                var pie = this._pies[tar];
                if (pie) {
                    var weight = $con.weight(flow.tar2row[tar]);
                    pie.sum = Math.max(pie.sum - weight, 0.00001);
                    delete pie.rows[flow.key];
                    pies[tar] = pie;
                }
            }
        }
        for (var pie of values(pies)) {
            if (keys(pie.rows).length === 0) {
                pie.d3.remove();
                delete this._pies[pie.addr];
            }
            else {
                pie.reshape();
            }
        }
    }
}

class PinGroup {
    manual = {} as StringMap<ILocation>;
    groups = {} as StringMap<d3.Any>;
    
    constructor(root: d3.Any) {
        this.d3 = root;
    }

    private _clear() {
        this.manual = {};
        this.groups = {};
        this.d3.selectAll('*').remove();
    }
    
    private _drag = d3.behavior.drag()
        .origin((d: string) => {
            if (d in this.manual) {
                return $con.layer.pixel(this.manual[d]);
            }
            if (this.groups[d].classed('invalid')) {
                var str = this.groups[d].attr('transform');
                var [a, b] = str.split(',');
                var x = +a.split('(')[1];
                var y = +b.split(')')[0];
                return { x, y };
            }
            else {                
                return $con.layer.pixel(d);
            }
        })
        .on('dragstart', (d: string) => {
            (d3.event as any).sourceEvent.stopPropagation();
            if (this.groups[d].classed('invalid')) {
                this.groups[d].select('title').text(d);
            }
            this.groups[d].att.class('pin dirty');
        })
        .on('drag', (d: string) => {
            var pnt = d3.event as any;
            this.groups[d].att.transform(translate(pnt.x, pnt.y));
            this.manual[d] = $con.layer.location(pnt);
        });
    
    reset() {
        if ($fmt.advance.values.relocate) {
            this.d3.sty.display(null);
        }
        else {
            this._clear();
            this.d3.sty.display('none');
            return;
        }
        this.d3.selectAll('*').remove();
        var dict = {} as StringMap<ILocation>;
        for (var flow of $con.layer.data()) {
            var src = $con.source(flow.row);
            if (!(src in dict)) {
                dict[src] = query(src);
            }
            for (var r of flow.rows) {
                var tar = $con.target(r);
                if (!(tar in dict)) {
                    dict[tar] = query(tar);
                }
            }
        }
        var valids = [] as string[], invalids = [] as string[];
        for (var addr of keys(dict)) {
            dict[addr] ? valids.push(addr) : invalids.push(addr);
        }
        var validPins = this.d3.selectAll('.pin.valid').data(valids).enter().append('g');
        this._setup(validPins, true);
        if (invalids.length > 0) {
            invalids.sort();
            let invalidPins = this.d3.selectAll('.pin.invalid').data(invalids).enter().append('g');
            this._setup(invalidPins, false);
            this.resize();
        }
    }

    reformat() {
        var { located, unlocated } = $fmt.advance.values;
        this.d3.selectAll('.pin.valid').sty.display(located ? null : 'none');
        this.d3.selectAll('.pin.dirty').sty.display(located ? null : 'none');
        this.d3.selectAll('.pin.invalid').sty.display(unlocated ? null : 'none');
    }

    add(flow: VisualFlow) {
        var dict = {} as StringMap<ILocation>;
        var src = $con.source(flow.row);
        var addrs = [src].concat(flow.rows.map(r => $con.target(r)));
        addrs = select(addrs, a => !(a in this.groups));
        for (var a of select(addrs, a => !!query(a))) {
            this._setup(this.d3.append('g').datum(a), true);
        }
        for (var a of select(addrs, a => !query(a))) {
            this._setup(this.d3.append('g').datum(a), false);
        }

        this.d3.selectAll<string>('.pin.invalid')
            .sort((a, b) => a.localeCompare(b)).size();
        this.resize();
    }

    private _placer(length: number): Func<number, IPoint> {
        var { x, y, width, height } = $con.border();
        var loc = null as Func<number, IPoint>, gap = Math.min(20, width / length);
        return i => {
            return { x: i * gap - width / 2 + 10, y: height / 2 - 20 };
        }
    }

    d3: d3.Any;

    private _setup(group: d3.Any, valid: boolean) {
        group.append('path').att.d('m 0 0 c -0.73840 -3.6248 -2.0403 -6.6412 -3.6172 -9.4370 c -1.1697 -2.0738 -2.5246 -3.9879 -3.7784 -5.9988 c -0.41851 -0.67131 -0.77970 -1.3805 -1.1818 -2.0772 c -0.80411 -1.3931 -1.4561 -3.0083 -1.4146 -5.1035 c 0.040476 -2.0471 0.63253 -3.6892 1.4863 -5.0318 c 1.4042 -2.2083 3.7562 -4.0188 6.9121 -4.4946 c 2.5803 -0.38903 4.9995 0.26823 6.7151 1.2714 c 1.4019 0.81977 2.4875 1.9148 3.3128 3.2053 c 0.86133 1.3470 1.4545 2.9383 1.5042 5.0139 c 0.025467 1.0634 -0.14867 2.0482 -0.39398 2.8651 c -0.24826 0.82684 -0.64754 1.5180 -1.0028 2.2563 c -0.69345 1.4411 -1.5628 2.7616 -2.4353 4.0828 c -2.5988 3.9354 -5.0380 7.9488 -6.1063 13.448 Z');
        group.append('circle').att.fill('black').att.cx(0).att.cy(-23.24).att.r(3.5);
        group.call(this._drag);
        if (valid) {
            group.classed('pin valid', true)
                .att.transform(k => {
                    return translate($con.layer.pixel(this.manual[k] || k));
                })
                .append('title').text(k => k);
        }
        else {
            group.classed('pin invalid', true)
                .append('title').text(k => k+'(unlocated)');
        }
        var self = this;
        group.each(function (d: string) { self.groups[d] = d3.select(this); });
    }

    transform(map: Microsoft.Maps.Map, tzoom: number) {
        if (!$con.fmt.advance.values.relocate) {
            return;
        }
        this.d3.selectAll<string>('.pin.valid').att.transform(addr => {
            return translate($con.layer.pixel(addr));
        });
        this.d3.selectAll<string>('.pin.dirty').att.transform(addr => {
            if (addr in this.manual) {
                return translate($con.layer.pixel(this.manual[addr]));
            }
            else {
                return translate($con.layer.pixel(addr));
            }
        });
    }

    resize() {
        var length = this.d3.selectAll('.pin.invalid').size();
        if (length === 0) {
            return;
        }
        var pixer = this._placer(length);
        this.d3.selectAll('.pin.invalid')
            .att.transform((d, i) => translate(pixer(i)));
    }
}

export class FlowLayer implements ILayer {

    private _svg: d3.Any;
    private _all: d3.Any;
    private _map: Microsoft.Maps.Map;

    public pies: PieGroup;
    public pins: PinGroup;
    public flys: FlowGroup;
    reset(map: Microsoft.Maps.Map) {
        if (this._svg) {
            map.getRootElement().appendChild(this._svg.node());
        }
        else {
            this._svg = append(map, 'svg');
            this._svg.att.width(map.getWidth()).att.height(map.getHeight());
            this._all = this._svg.append('g').att.id('all');
            this._all.sty.pointer_events('visiblePainted');
            this.flys = new FlowGroup(this._all.append('g').att.id('flows'));
            this.pies = new PieGroup(this._all.append('g').att.id('pies'));
            this.pins = new PinGroup(this._all.append('g').att.id('pins'));
        }
        this._map = map;
    }
    
    location(pixel: any): ILocation {
        return coordinate(this._map, pixel);
    }

    highlight(rows: StringMap<true>) {
        this.flys.sortFlows();
        this.pies.sortPies();
    }

    pixel(addr: string | ILocation, ref?: Microsoft.Maps.PixelReference): IPoint {
        return pixel(this._map, typeof addr === 'string' ? query(addr) : addr, ref);
    }

    resetPins() {
        if ($fmt.advance.values.relocate) {
            $con.legend.info(msgs.relocate);
            this.pies.display(false);
            this.flys.display(false);
            this.pins.reset();
        }
        else {
            $con.legend.info(null);
            this.pies.display(true);
            this.flys.display(true);
            $con.relocate(this.pins.manual);
            this.pins.reset();
        }
    }

    get map() {
        return this._map;
    }

    
    clear(keep?: Flow[]) {
        if (!keep) {
            this.flys.clear();
            this.pies.clear();
            this.pins.reset();
        }
        else {
            var mark = dict(keep, f => f.key);
            var rmvs = select(this.data(), f => !(f.key in mark));
            this.pies.remove(rmvs);
            this.flys.remove(rmvs);
            this.pins.reset();
            if ($con.legend.rescale()) {
                $con.layer.rescale();
            }
        }
    }

    move(addrs: string[]) {
        if (!addrs || !addrs.length) {
            return;
        }
        this.flys.move(addrs);
        if ($con.legend.rescale()) {
            $con.layer.rescale();
        }
        $con.legend.resetWarnings();
        this.pies.move(addrs);
    }

    add(input: Flow) {
        if (this.flys.contains(input.key)) {
            return;
        }
        var flow = this.flys.add(input);
        if ($con.legend.rescale()) {
            $con.layer.rescale();
        }
        this.pies.add(flow);
        if ($fmt.advance.values.relocate) {
            this.pins.add(flow);
        }
    }

    reformat() {
        for (var flow of this.data()) {
            var fill = $con.legend.color(flow.row);
            if (fill !== flow.color) {
                flow.recolor(fill);
                this.pies.recolor(flow);
            }
        }
        this.pies.reformat();
        this.pins.reformat();
    }

    rescale() {
        this.flys.rescale();
        this.pies.rescale();
    }

    data() {
        return values(this.flys.flows);
    }

    get flows() {
        return this.flys.flows;
    }
    flow(key: string) {
        return this.flys.flow(key);
    }
    contains(key: string) {
        return this.flys.contains(key);
    }

    transform(map: Microsoft.Maps.Map, tzoom: number) {
        this.flys.transform(map, tzoom);
        this.pies.transform(map, tzoom);
        this.pins.transform(map, tzoom);
    }
    
    resize(map: Microsoft.Maps.Map) {
        let w = map.getWidth(), h = map.getHeight();
        this._svg.att.width(w).att.height(h);
        this._all.att.transform(translate(w / 2, h / 2));
        this.pies.tryMoveBanners();
        this.pins.resize();
    }
}