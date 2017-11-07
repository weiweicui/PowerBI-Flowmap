import { ILocation, IBound } from 'bing';
import { Converter } from 'bing/converter';
import { scale } from 'd3/attr';
import { dict, Func, StringMap, values, pick } from 'type';
import { Key, IPathPoint, IPoint, ILayout, IPath, layout } from 'flowmap';
import { max, min, extent } from 'array';
import { $cfg, $mapctl, $fmt } from './app';
import { util } from './misc';
import { arc } from './arc';


export { IPoint, IPath, IPathPoint } from 'flowmap';

function pointConverter(level: number) {
    var zoom = $mapctl.map.getZoom();
    if (zoom === level) {
        return null;
    }
    let factor = map20.factor(zoom);
    return (input: IPathPoint, output: number[]) => {
        output[0] = input[0] * factor;
        output[1] = input[1] * factor;
    };
}

let map20 = new Converter(20);

class LinePath implements IPath {
    id: Key;
    leafs: Key[];

    private _width: number;
    private _path = '';
    
    constructor(path: string, key: number, public weight: number) {
        this.id = key;
        this._width = weight;
        this.leafs = [key];
        this._path = path;
    }   

    d(tran?: (input: IPathPoint, output: number[]) => void): string {
        return this._path;
    }
    
    width(scale?: Func<number, number>): number {
        if (scale) {
            this._width = scale(this.weight);
        }
        return this._width;
    }
    minLatitude: number;
    maxLatitude: number;
}

class helper {
    public static initPaths(root: d3.Any, style: IShape) {
        let conv = pointConverter(null);
        root.selectAll('*').remove();
        root.selectAll('.base')
            .data(style.paths()).enter().append('path')
            .att.class('base flow')
            .att.d(p => p.d(conv))
            .att.stroke_linecap('round')
            .att.fill('none');
    }
    public static line(src: ILocation, tlocs: ILocation[], trows: number[], weis?: number[]) {
        let slon = src.longitude, slat = src.latitude;
        let all = tlocs.concat(src);
        let area = map20.points(all);
        let spnt = area.points.pop();
        let pre = 'M ' + Math.round(spnt.x) + ' ' + Math.round(spnt.y);
        let paths = {} as StringMap<LinePath>;
        let row2tar = {} as StringMap<ILocation>;
        for (let i = 0; i < area.points.length; i++) {
            row2tar[i] = tlocs[i];
            let tpnt = area.points[i], trow = trows[i];
            var str = pre + ' L ' + Math.round(tpnt.x) + ' ' + Math.round(tpnt.y);
            paths[trow] = new LinePath(str, trow, weis ? weis[i] : 1);
        }
        let bounder = (rows: number[]) => {
            if (!rows) return area;
            let locs = pick(rows, r => row2tar[r]);
            if (locs.length === 0) {
                return null;
            }
            locs.push(src);
            return $mapctl.bound(locs);
        }
        return { paths, bounder };
    }
    public static arc(src: ILocation, tlocs: ILocation[], trows: number[], weis?: number[]) {
        let slon = src.longitude, slat = src.latitude;
        let scoord = { x: 0, y: slat }, tcoord = { x: 0, y: 0 };
        let all = tlocs.concat(src);
        let yext = extent(all, p => p.latitude);
        let bound = $mapctl.bound(all);
        let anchor = bound.anchor;
        anchor.latitude = slat;
        let alon = anchor.longitude;
        let bias = map20.x(slon) - map20.x(alon);
        if (Math.abs(alon - slon) > 180) {
            if (alon > slon) {
                bias = map20.x(slon + 360 - alon - 180);
            }
            else {
                bias = 0 - map20.x(alon + 360 - slon - 180);
            }
        }
        let paths = {} as StringMap<LinePath>;
        let row2tar = {} as StringMap<ILocation>;
        let minlat = Number.POSITIVE_INFINITY;
        let maxlat = Number.NEGATIVE_INFINITY;
        for (var i = 0, len = tlocs.length; i < len; i++) {
            let t = tlocs[i], tlon = t.longitude, trow = trows[i];
            row2tar[trow] = t;
            let miny = Number.POSITIVE_INFINITY;
            let maxy = Number.NEGATIVE_INFINITY;
            tcoord.y = t.latitude;
            if (Math.abs(tlon - slon) < 180) {
                tcoord.x = tlon - slon;
            }
            else {
                if (tlon < slon) {
                    tcoord.x = 360 - slon + tlon;
                }
                else {
                    tcoord.x = tlon - slon - 360;
                }
            }
            if (!arc) {
                debugger;
            }
            var cnt = Math.max(Math.round(Math.abs(tcoord.x / 4)), 10);
            var coords = arc(scoord, tcoord, cnt);
            var sx = map20.x(0), sy = map20.y(scoord.y);
            var str = 'M ' + Math.round(bias) + ' 0';
            for (var pair of coords) {
                let [px, py] = pair;
                if (py < miny) {
                    miny = py;
                }
                if (py > maxy) {
                    maxy = py;
                }
                var dx = Math.round(map20.x(px) - sx + bias);
                var dy = Math.round(map20.y(py) - sy);
                str += ' L ' + dx + ' ' + dy;
            }
            var apath = new LinePath(str, trow, weis ? weis[i] : 1);
            minlat = Math.min(minlat, miny);
            maxlat = Math.max(maxlat, maxy);
            apath.minLatitude = miny;
            apath.maxLatitude = maxy;
            paths[trow] = apath;
        }
        bound.margin.north = maxlat - slat;
        bound.margin.south = slat - minlat;
        let bounder = (rows: number[]) => {
            if (!rows) return bound;
            let locs = pick(rows, r => row2tar[r]);
            if (locs.length === 0) {
                return null;
            }
            locs.push(src);
            let ret = $mapctl.bound(locs);
            let ps = pick(rows, r => paths[r]);
            let miny = Math.min(...ps.map(p => p.minLatitude));
            let maxy = Math.max(...ps.map(p => p.maxLatitude));
            let mean = miny / 2 + maxy / 2;
            ret.margin.north = maxy - mean;
            ret.margin.south = mean - miny;
            ret.anchor.latitude = mean;
            return ret;
        };
        return { paths, bounder };
    }
}

// declare var arc: any;

export interface IShape {
    highlight(selected: number[] | 'all' | 'none'): d3.Any;
    rewidth();
    reweight(weight: (row: number) => number): number[];
    transform(map: Microsoft.Maps.Map, pzoom: number);
    bound(rows: number[]): IBound;
    paths(): IPath[];
    sort(): void;
}

export function build(type: 'straight' | 'flow' | 'arc', d3: d3.Any, src: ILocation, tars: ILocation[], trows: number[], weis?: number[]): IShape {
    switch (type) {
        case 'flow':    
            return new FlowShape(d3, src, tars, trows, weis);
        case 'arc':
            let arc = helper.arc(src, tars, trows, weis);
            return new LineShape(d3, arc.paths, arc.bounder);
        case 'straight':
            let line = helper.line(src, tars, trows, weis);
            return new LineShape(d3, line.paths, line.bounder);
    }
}

class FlowShape implements IShape {
    d3: d3.Any;
    private _layout: ILayout;
    private _highSubroots = {} as StringMap<IPath>;
    private _row2tar = {} as StringMap<ILocation>;
    private _src = null as ILocation;
    private _bound = null as IBound;
    constructor(d3: d3.Any, src: ILocation, tars: ILocation[], trows: number[], weis?: number[]) {
        this._src = src;
        let bnd = map20.points([src].concat(tars));
        this._bound = { anchor: bnd.anchor, margin: bnd.margin };
        let points = bnd.points;
        let source = points.shift() as IPoint;    
        source.key = $cfg.source(trows[0]);
        for (let i = 0; i < points.length; i++){
            (points[i] as IPoint).key = trows[i];
            this._row2tar[trows[i]] = tars[i];
        }
        this._layout = layout(source, points, weis);
        helper.initPaths(d3, this);
        this.d3 = d3;
    }

    paths(): IPath[] {
        return this._layout.paths();
    }

    bound(rows: number[]): IBound {
        if (!rows) {
            return this._bound;
        }
        let locs = pick(rows, r => this._row2tar[r]);
        if (locs.length === 0) {
            return null;
        }
        locs.push(this._src);
        return $mapctl.bound(locs);
    }

    highlight(selected: number[] | 'all' | 'none'): d3.Any {
        if (selected === 'all' || selected === 'none') {
            this.d3.selectAll('.add').remove();
            this._highSubroots = {};
            return this.d3.selectAll('.base').classed('high', selected === 'all');
        }
        this.d3.selectAll('.base').classed('high', false);
        var subroots = dict(this._layout.subroots(selected), t => t.id);
        var conv = pointConverter(null);
        // var width = widthScale(), old = this._highSubroots;
        var old = this._highSubroots;
        for (var key in old) {
            if (!(key in subroots)) {
                this.d3.selectAll('.add.' + old[key].id).remove();
                delete old[key];
            }
        }
        for (var key in subroots) {
            if (key in old) {
                continue;
            }
            let path = subroots[key], width = $cfg.width.scale;//this._width();
            let root = this.d3.selectAll('.add.' + path.id)
                .data(this._layout.flow(path))
                .enter().append('path')
                .att.class('flow add high ' + path.id)
                .att.stroke_linecap('round')
                .att.fill('none')
                //need to call p.width before call p.d
                .att.stroke_width(p => p.width(width))
                .att.d(p => p.d(conv));
            old[key] = path;
        }
        return this.d3.selectAll('.high');
    }

    reweight(weight: (row: number) => number): number[] {
        weight && this._layout.build(weight);
        return extent(this._layout.paths().map(p => p.weight));
    }

    rewidth() {
        let scale = $cfg.width.scale, conv = pointConverter(null);
        this.d3.selectAll<IPath>('path')
            .att.stroke_width(p => p.width(scale))
            .att.d(p => p.d(conv));
    }

    transform(map: Microsoft.Maps.Map, pzoom: number) {
        var conv = pointConverter(pzoom);
        conv && this.d3.selectAll<IPath>('.flow').att.d(p => p.d(conv));
    }

    sort() {
        //nothing
    }
}

class LineShape implements IShape {
    d3: d3.Any;
    private _layout: ILayout;
    private _row2Path = {} as StringMap<LinePath>;
    private _row2Tar = {} as StringMap<ILocation>;
    private _src: ILocation;
    constructor(d3: d3.Any, row2Path: StringMap<LinePath>, bound: Func<number[], IBound>) {
        this.d3 = d3;
        this._row2Path = row2Path;
        this.bound = bound;
        helper.initPaths(d3, this);
    }

    bound(rows: number[]): IBound {
        return null;
    }

    highlight(selected: number[] | 'all' | 'none'): d3.Any {
        if (selected === 'all') {
            return this.d3.selectAll('.flow').att.class('flow high');
        }
        else if (selected === 'none') {
            return this.d3.selectAll('.flow').att.class('flow base');
        }
        var mark = dict(selected.filter(r => r in this._row2Path));
        return this.d3.selectAll<IPath>('.flow').att.class('flow base')
            .filter(p => p.id in mark).classed('high', true);
    }

    reweight(weight: (row: number) => number): number[] {
        if (weight) {
            for (let r in this._row2Path) {
                let path = this._row2Path[r];
                path.weight = weight(+r);
            }
        }        
        return extent(values(this._row2Path).map(p => p.weight));
    }

    rewidth() {
        let width = $cfg.width.scale;
        let factor = map20.factor($mapctl.map.getZoom());
        this.d3.att.transform(scale(factor));
        let w = v => width(v) / factor;
        this.d3.selectAll<IPath>('path').att.stroke_width(p => p.width(w));
    }

    transform(map: Microsoft.Maps.Map, pzoom: number) {
        this.rewidth();
    }

    paths(): IPath[] {
        return values(this._row2Path);
    }

    sort() {
        var mark = {} as StringMap<true>;
        var cnt = 0;
        this.d3.selectAll<IPath>('.flow.high').each(p => {
            mark[p.id] = true;
            cnt++;
        });
        if (cnt === 0 || cnt === this.paths().length) {
            return;
        }
        this.d3.selectAll<IPath>('.flow').sort((a, b) => {
            if (a.id in mark) {
                return b.id in mark ? 0 : 1;
            }
            else {
                return b.id in mark ? -1 : 0;
            }
        });
    }
}