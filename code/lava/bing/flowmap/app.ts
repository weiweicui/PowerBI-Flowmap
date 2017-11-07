import { IRect, keys, dict, Func, StringMap, Action, values, groupBy } from "type";
import { ILocation, GeoQuery, Controller, MapFormat } from "bing";
import { Legend } from "./legend";
import * as flows from './flow';
import * as pins from './pin';
import * as pies from './pie';
import * as marks from './mark';
import { Format, merge, Dirty } from './format';
import { util } from "./misc";
import { interpolateRgb } from 'd3-interpolate';
import { extent } from "array";
import { scaleLinear, scaleIdentity, scaleSqrt } from 'd3-scale';
import { Any, select } from 'd3-selection';
import { IPath } from './shape';


export let GRAY = '#AAA';
export let $mapctl: Controller;
export let $fmt: Format;
export let $border: IRect;
export let issues = {} as StringMap<Issue>;
export let flowRows = [] as number[];

let legend: Legend;

export function loc(addr: string) {
    if (addr in $cfg.location.manual) {
        return $cfg.location.manual[addr];
    }
    if (addr in $cfg.location.injection) {
        return $cfg.location.injection[addr];
    }
    if (addr in $cfg.location.geocode) {
        return $cfg.location.geocode[addr];
    }
    return null;
}

export function hover(rows: number[]) {
    if (!rows) {
        pies.hover(null);
    }
    else {
        let srcs = dict(rows, r => $cfg.source(r));
        let tars = dict(rows, r => $cfg.target(r));
        pies.hover(keys(srcs, tars));
    }
}

interface Issue {
    unlocate?: string;
    selflink?: string;
    negative?: string;
}

interface IConfig {
    source(row: number): string;
    target(row: number): string;
    group(row: number): string;
    weight?(row: number): number;

    color: {
        value?(row: number): number;//smooth values
        conv?: { (row: number): string, domain?: number[] };
    };

    width: {
        value?(row: number): number;//distinct values
        scale?: { (weight: number): number, invert?(w: number): number };
    };

    mark: {
        init?(marks: string[]);
        onChanged?(locs: string[]);
    };

    flow: {
        onPathChanged?(paths: Any<IPath>);
    };

    bubble: {
        onPieChanged?(pies: Any<pies.Pie>);        
    };

    legend: {
        color?(rows: number[]): StringMap<string>;
        width?(rows: number[]): StringMap<string>;
    }

    location: {
        injection: StringMap<ILocation>;
        geocode: StringMap<ILocation>;
        manual: StringMap<ILocation>;
        done?()
    };

    selection?: {
        flags?(): StringMap<true>;
        click?(rows: number[]);
        highlight();
    };

    label: {
        line(row: number): string;
        source(row: number): string;
        target(row: number): string;
    };
}

function resetColor() {
    if ($cfg.color.value) {
        let value = $cfg.color.value;
        let domain = extent(flows.rows(r => !issues[r]), r => value(r));
        let range = [$fmt.color.min.solid.color, $fmt.color.max.solid.color];
        let scale = scaleLinear<any,any>().domain(domain).range(range)
            .interpolate(interpolateRgb).clamp(true);
        $cfg.color.conv = r => scale(value(r));
        $cfg.color.conv.domain = domain;
    }
}

export let $cfg = {
    location: { geocode: {}, injection: {}, manual: {} },
    color: {},
    width: {},
    selection: {
        highlight: () => {
            flows.highlight();
            flows.reorder();
            pies.reorder();
            legend.highlight();
            pies.all().each(r => r.highlight());
            tryFitView();
        }
    },
    flow: {},
    bubble: {},
    mark: { init: marks.init },
    legend: {},
    label: {}
} as IConfig;

let root = null as Any;
export function init(div: HTMLDivElement, done: Func<Microsoft.Maps.Map, void>) {
    $fmt = new Format();
    root = select(div);
    root.append('div').att.id('view').sty.width('100%').sty.height('100%');
    root.append('div').att.id('mark');
    root.append('div').att.id('legend').sty.position('absolute').sty.top('0px').sty.left('0px');
    root.append('div').att.id('warn');
    legend = new Legend(root.select('#legend'));
    $mapctl = new Controller(root.select('#view').node<HTMLDivElement>());
    $mapctl.restyle(MapFormat.build($fmt.mapControl, $fmt.mapElement), map => {
        layout();
        $mapctl.svg.sty.cursor('default').sty.pointer_events('visiblePainted');
        $mapctl.add({ resize(map) { layout(); } });
        $mapctl.add(flows.listener($mapctl.svg.append('g')));
        $mapctl.add(pins.listener($mapctl.svg.append('g')));
        $mapctl.add(pies.listener($mapctl.svg.append('g')));
        $mapctl.add(marks.listener(root.select('#mark')));
        done(map);
    });
}

function clear(message: string) {
    legend.info(message);
    flows.clear();
    pins.clear();
    pies.clear();
    marks.clear();
    flowRows = [];
    // key2rows = {};
    issues = {};
}

function resetWidth() {
    let domain = flows.reweight(util.weighter()), [dmin, dmax] = domain;
    if (freeUnit || !$fmt.width.unit || $fmt.width.unit <= 0) {
        if (dmin === dmax) {
            $fmt.width.unit = 3 / dmin;
        }
        else {
            $fmt.width.unit = 25 / dmax;
        }
    }
    let rmax = +$fmt.width.max, rmin = +$fmt.width.min, range = [rmin, rmax];
    if ($cfg.width.value) {//categorical
        $cfg.width.scale = scaleIdentity();
    }
    else if (!$cfg.weight && $fmt.style.type !== 'flow') { //no Weight field
        $cfg.width.scale = scaleIdentity();
    }
    else if (dmin === dmax) {
        $cfg.width.scale = scaleLinear().domain(domain).range(range);
    }
    else {//no value && (has weight || is flow)
        if ($fmt.width.scale === 'none') {
            let unit = $fmt.width.unit, range = [dmin * unit, dmax * unit];
            $cfg.width.scale = scaleLinear().domain(domain).range(range);
        }
        else if ($fmt.width.scale === 'log') {
            let exp = 0.5, pow = scaleSqrt().domain([0, dmax]).range([0, rmax]);
            while (pow(dmin) > +$fmt.width.min && exp < 1.1) {
                pow.exponent(exp += 0.1);
            }
            if (pow(dmin) > +$fmt.width.min) {
                $cfg.width.scale = pow;
            }
            else {
                let lin = scaleLinear().domain([pow(dmin), rmax]).range(range);
                $cfg.width.scale = w => lin(pow(w));
                $cfg.width.scale.invert = r => pow.invert(lin.invert(r));
            }
        }
        else {
            let lin = scaleLinear().domain([0, dmax]).range([0, rmax]);
            lin(dmin) < rmin && lin.domain(domain).range(range);
            $cfg.width.scale = lin;
        }
    }
    
}

function remove(...ids: string[]) {
    if (!ids || ids.length === 0) {
        return;
    }
    flows.remove(...ids);
    if ($fmt.advance.relocate) {
        pins.reset(flows.rows());
    }
    else {
        resetColor();
        resetWidth();
        flows.reformat(true, true);
        pies.reset(flows.rows(r => !issues[r]));
        marks.reset();
    }
    tryFitView();
}

function add(group: number[]) {
    let source = $cfg.source(group[0]);
    for (let r of group) {
        let target = $cfg.target(r);
        let issue = {} as Issue;
        if (target === source) {
            (issues[r] = issue).selflink = target;
        }
        if (!loc(target)) {
            (issues[r] = issue).unlocate = target;
        }
        if ($cfg.weight && $cfg.weight(r) < 0) {
            (issues[r] = issue).negative = target;
        }
    }
    if (!loc(source)) {
        issues[group[0]] = { unlocate: source };
    }

    flows.add(group);
    if ($fmt.advance.relocate) {
        pins.reset(flows.rows());
    }
    else {
        resetColor();
        resetWidth();
        //color and width are changed, so need to reformat previous ones
        flows.reformat(true, true);
        legend.reformat(false);
        pies.reset(flows.rows(r => !issues[r]));
        marks.reset();
    }
    tryFitView();
    //add flow, try fit view, reformat
}

function tryFitView() {
    if ($fmt.mapControl.autoFit) {
        let flags = $cfg.selection.flags(), rows = null as number[];
        if (flags) {
            rows = keys(flags).map(r => +r);
        }
        let bounds = flows.bounds(rows);
        if (bounds && bounds.length > 0) {
            $mapctl.fitView(bounds);
        }
    }
}

let geoquery = null as GeoQuery;
function queue(groups: number[][], done: Action) {
    if (geoquery) {
        geoquery.cancel();
        geoquery = null;
    }
    var next = () => {
        if (groups.length === 0) {
            legend.info(null);
            geoquery && geoquery.cancel();
            geoquery = null;
            done();
            return;
        }
        let flow = groups.shift(), source = $cfg.source(flow[0]);
        let addrs = [source].concat(flow.map(r => $cfg.target(r)));
        let total = addrs.length, sofar = 0;
        addrs = addrs.filter(d => !loc(d));
        if (addrs.length === 0) {
            add(flow);
            next();
            return;
        }
        sofar = total - addrs.length;
        geoquery = new GeoQuery(addrs);
        let cancel = () => {
            legend.d3('info').sty.cursor('default');
            geoquery && geoquery.cancel();
            geoquery = null;
            legend.info(null);
            add(flow);
            done();
        };
        geoquery.run(loc => {
            sofar++;
            if (loc) {
                $cfg.location.geocode[loc.address] = loc;
            }
            legend.info(`Geocoding ${sofar}/${total} (click to cancel): ${loc && loc.address}`);
            legend.d3('info').sty.cursor('pointer').on('click', cancel);
            if (sofar === total && geoquery) {
                // debugger;
                add(flow);
                next();
                legend.d3('info').sty.cursor('default').on('click', null);
            }
        });
    };
    next();
}

function layout() {
    let { show, position } = $fmt.legend;
    let width = $mapctl.map.getWidth();
    let height = $mapctl.map.getHeight();
    let legHeight = show ? legend.height() : 0;
    legend.resize(width);
    let top = position === 'top' ? null : (height - legHeight + 2) + 'px';
    root.select('#legend').att.width(width).att.height(legHeight);    
    root.select('#legend').sty.margin_top(top);
    $border = { x: 0, y: 0, width, height };
}

function updateFormat(dirty: Dirty<Format>): void {
    if (dirty.legend.fontSize || dirty.legend.position) {
        layout();
    }
    $mapctl.restyle(MapFormat.build($fmt.mapElement, $fmt.mapControl), map => layout());
    if ($fmt.advance.relocate) {
        pins.reformat();
        return;
    }

    if ($fmt.bubble.slice === null) {
        if ($cfg.color.value) {
            let map = $cfg.color.value;
            $fmt.bubble.slice = keys(dict(flowRows, r => map(r))).length < 64;
        }
        else if ($cfg.color.conv) {
            let map = $cfg.color.conv;
            $fmt.bubble.slice = keys(dict(flowRows, r => map(r))).length < 64;
        }
    }
    if ($fmt.bubble.for === null) {
        $fmt.bubble.for = $fmt.style.direction !== 'in' ? 'dest' : 'origin';
    }

    let { bubble, color, width } = dirty;
    let recolor = dirty.$.color || !$cfg.color.conv;
    let rewidth = dirty.$.width || !$cfg.width.scale;
    rewidth && resetWidth();
    recolor && resetColor();
    flows.reformat(recolor, rewidth);
    legend.reformat(dirty.legend.fontSize);
    let repie = bubble.for || bubble.slice || recolor || rewidth;
    pies.reformat(repie, bubble.bubbleColor, bubble.scale);
    if (dirty.mapControl.autoFit && $fmt.mapControl.autoFit) {
        tryFitView();
    }
    marks.reset();
}

let baseRows = [] as number[]
export function reformat(delta: Format) {
    // debugger;
    if (delta.width && 'unit' in delta.width) {
        freeUnit = delta.width.unit === null;
    }
    let dirty = merge(delta, $fmt);
    updateFormat(dirty);
    if (dirty.style.direction || dirty.style.type || dirty.advance.relocate) {
        reset({} as any, baseRows);
        return;
    }
    if (dirty.style.limit) {
        let desired = desiredFlows(baseRows);
        remove(...flows.keys().filter(k => !(k in desired)));
        let exists = dict(flows.keys());
        let toadd = keys(desired).filter(k => !(k in exists)).map(k => desired[k]);
        if (toadd.length > 0) {
            queue(toadd, $cfg.location.done);
        }
        flowRows = [].concat(...values(desired));
    }
}

let freeUnit = true;
export function reset(delta: Format, rows: number[] | string) {
    // debugger;
    if (delta.width && 'unit' in delta.width) {
        freeUnit = delta.width.unit === null;
    }
    let dirty = merge(delta, $fmt);
    if (typeof rows === 'string') {
        clear(rows);
        updateFormat(dirty);
        return;
    }
    clear(null);
    baseRows = rows;
    let desired = desiredFlows(rows);
    flowRows = [].concat(...values(desired));
    updateFormat(dirty);
    queue(values(desired), $cfg.location.done);
}

function desiredFlows(rows: number[]): StringMap<number[]> {
    let fmt = $fmt.style;
    let flowStyle = () => {
        let groups = groupBy(rows, $cfg.group);
        let keep = flows.keys().filter(key => key in groups);
        let need = +fmt.limit - keep.length;
        if (need === 0) {
            return dict(keep, k => k, k => groups[k]);
        }
        else if (need > 0) {
            let result = dict(keep, k => k, k => groups[k]);
            for (let key in groups) {
                if (!(key in result)) {
                    result[key] = groups[key];
                    if (--need === 0) {
                        break;
                    }
                }
            }
            return result;
        }
        else {
            return dict(keep.slice(0, +fmt.limit), k => k, k => groups[k]);
        }
    };
    if (fmt.type === 'straight' || fmt.type === 'arc') {
        //no problem with these two types
        return groupBy(rows, $cfg.source);
    }
    //null or flow
    if ($cfg.color.value) {
        //but flow cannot be used with smoothColor
        fmt.type = 'arc';
        return groupBy(rows, $cfg.source);
    }
    //distinct, (flow or auto)
    if (fmt.type === 'flow') {
        return flowStyle();
    }
    //style is null
    if (keys(groupBy(rows, $cfg.group)).length < 5) {
        fmt.type = 'flow';
        return flowStyle();
    }
    fmt.type = rows.length < 512 ? 'arc' : 'straight';
    return groupBy(rows, $cfg.source);
}