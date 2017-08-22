import { ILocation } from 'bing';
import { scale } from 'd3/attr';
import { dict, Func, StringMap } from 'type';
import { Flow } from './structure';
import { Key, IPathPoint, IPoint, ILayout, IPath, layout } from 'flowmap';
import { util } from "./app";
import { $con, $fmt } from "./visual";

export { IPoint, IPath, IPathPoint } from 'flowmap';

class LinePath implements IPath {
    public id: string;
    private _width: number;
    private static CNT = 0;

    leafs = {} as StringMap<number>;
    constructor(src: IPoint, tar: IPoint, public weight: number) {
        this.id = 'linenode_' + LinePath.CNT++;
        this._width = weight;
        this.leafs[tar.key] = weight;
        this._path = ['M', src.x, src.y, tar.x, tar.y].join(' ');
    }

    private _path = '';

    d(tran?: (input: IPathPoint, output: number[]) => void): string {
        return this._path;
    }
    
    width(scale?: Func<number, number>): number {
        if (scale) {
            this._width = scale(this.weight);
        }
        return this._width;
    }
}

class ArcPath implements IPath {
    id: string;    
    leafs = {} as StringMap<number>;

    private _width: number;
    private static CNT = 0;
    constructor(path: string, key: number, public weight: number) {
        this.id = 'arcnode_' + ArcPath.CNT++;
        this._width = weight;
        this.leafs[key] = weight;
        this._path = path;
    }

    private _path = '';

    d(tran?: (input: IPathPoint, output: number[]) => void): string {
        return this._path;
    }
    
    width(scale?: Func<number, number>): number {
        if (scale) {
            this._width = scale(this.weight);
        }
        return this._width;
    }
}

class ArcLayout implements ILayout {
    private _paths = [] as ArcPath[];
    private _dict = {} as StringMap<ArcPath>;
    constructor(src: ILocation, tars: ILocation[], trows: number[], weis?: number[]) {
        var slon = src.longitude, slat = src.latitude;
        var scoord = { x: 0, y: slat }, tcoord = { x: 0, y: 0 };
        for (var i = 0, len = tars.length; i < len; i++) {
            var t = tars[i], tlon = t.longitude, trow = trows[i];
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
                console.log('***************************');
                console.log('!!!: Cannot find arc module');
                console.log('***************************');
            }
            var gen = new arc.GreatCircle(scoord, tcoord);
            var cnt = Math.max(Math.round(Math.abs(tcoord.x / 4)), 10);
            var path = gen.Arc(cnt), map = $con.$20map;
            var coords = path.geometries[0].coords as number[][];
            var ax = map.x(0), ay = map.y(scoord.y);
            var str = 'M 0 0';
            for (var pair of coords) {
                var dx = Math.round(map.x(pair[0]) - ax);
                var dy = Math.round(map.y(pair[1]) - ay);
                str += ' L ' + dx + ' ' + dy;
            }
            var apath = new ArcPath(str, trow, weis ? weis[i] : 1);
            this._paths.push(apath);
            this._dict[trow] = apath;
        }
    }

    flow(v: IPath): IPath[] {
        return [v];
    }

    subroots(keys: Key[]): IPath[] {
        return keys.map(k => this._dict[k]);
    }

    private _scale: (w: number) => number;

    paths(scale?: (w: number) => number): IPath[] {
        if (scale) {
            this._scale = scale;
            for (var p of this._paths) {
                p.width(scale);
            }
        }
        return this._paths;
    }

    build(scale?: (w: number) => number): IPath[] {
        return this.paths(scale);
    }

    visit(v: (p: IPoint) => void): this {
        return this;
    }
}

class LineLayout implements ILayout {
    private _paths = [] as LinePath[];
    private _dict = {} as StringMap<LinePath>;
    private _src: IPoint;
    private _tars: IPoint[];
    constructor(src: IPoint, tars: IPoint[], weis?: number[]) {
        for (var i = 0, len = tars.length; i < len; i++){
            var t = tars[i];
            var path = new LinePath(src, t, weis ? weis[i] : 1);
            this._paths.push(path);
            this._dict[t.key] = path;
        }
        this._src = src;
        this._tars = tars;
    }

    flow(v: IPath): IPath[] {
        return [v];
    }

    subroots(keys: Key[]): IPath[] {
        return keys.map(k => this._dict[k]);
    }

    private _scale: (w: number) => number;

    paths(scale?: (w: number) => number): IPath[] {
        if (scale) {
            this._scale = scale;
            for (var p of this._paths) {
                p.width(scale);
            }
        }
        return this._paths;
    }

    build(scale?: (w: number) => number): IPath[] {
        return this.paths(scale);
    }

    visit(v: (p: IPoint) => void): this {
        v(this._src);
        for (var t of this._tars) {
            v(t);
        }
        return this;
    }
}

declare var arc: any;
export function arcStyle(d3: d3.Any, src: ILocation, tars: ILocation[], trows: number[], weis?: number[]): IStyle {
    return new LineStyle(d3, new ArcLayout(src, tars, trows, weis));
}

export function flowStyle(d3: d3.Any, src: IPoint, tars: IPoint[], weis?: number[]): IStyle {
    return new FlowStyle(d3, src, tars, weis);
}

export function lineStyle(d3: d3.Any, src: IPoint, tars: IPoint[], weis?: number[]): IStyle {
    return new LineStyle(d3, new LineLayout(src, tars, weis));
}

export interface IStyle {
    highlight(selected: number[]|'all'|'none'):d3.Any;
    rescale(level: number);
    transform(map: Microsoft.Maps.Map, level: number);
    paths(): IPath[];
    sort(): void;
}

class FlowStyle implements IStyle {
    d3: d3.Any;
    private _layout: ILayout;
    private _highSubroots = {} as StringMap<IPath>;
    constructor(d3: d3.Any, src: IPoint, tars: IPoint[], weis?: number[]) {
        this._layout = layout(src, tars, weis);
        this.d3 = d3;
    }
    paths(): IPath[] {
        return this._layout.paths();
    }
    highlight(selected: number[] | 'all' | 'none'): d3.Any {
        if (selected === 'all' || selected === 'none') {
            this.d3.selectAll('.high').remove();
            this._highSubroots = {};
            return this.d3.selectAll('.base');
        }
        var subroots = dict(this._layout.subroots(selected as number[]), t => t.id);
        var conv = util.pathConverter(null);
        var width = $con.legend.scale(), old = this._highSubroots;
        for (var key in old) {
            if (!(key in subroots)) {
                this.d3.selectAll('.high.' + old[key].id).remove();
                delete old[key];
            }
        }
        for (var key in subroots) {
            if (key in old) {
                continue;
            }
            var path = subroots[key];
            this.d3.selectAll('.high.' + path.id)
                .data(this._layout.flow(path)).enter()
                .append('path')
                //need to call p.width before call p.d
                .att.stroke_width(p => p.width(width))
                .att.class('flow high ' + path.id)
                .att.stroke_linecap('round')
                .att.d(p => p.d(conv))
                .att.fill('none');
            old[key] = path;
        }
        return this.d3.selectAll('.high');
    }

    rescale(level: number) {
        var width = $con.legend.scale();
        var conv = util.pathConverter(level);
        this.d3.selectAll<IPath>('.flow')
            .att.stroke_width(p => p.width(width))
            .att.d(p => p.d(conv));
    }
    transform(map: Microsoft.Maps.Map, level: number) {
        var conv = util.pathConverter(level);
        if (conv) {
            this.d3.selectAll<IPath>('.flow').att.d(p => p.d(conv));
        }
    }
    sort() {
        
    }
}

class LineStyle implements IStyle {
    d3: d3.Any;
    private _layout: ILayout;
    constructor(d3: d3.Any, layout: ILayout) {
        this._layout = layout;//new LineLayout(src, tars, weis);
        this.d3 = d3;
    }
    highlight(selected: number[] | 'all' | 'none'): d3.Any {
        if (selected === 'all' || selected === 'none') {
            return this.d3.selectAll('.flow').att.class('flow base');
        }
        var keys = dict(this._layout.subroots(selected).map(p => p.id));
        return this.d3.selectAll<IPath>('.flow').att.class('flow base')
            .filter(p => p.id in keys).classed('high', true);
    }
    
    rescale(level: number) {
        var zoom = $con.layer.map.getZoom();
        var factor = $con.$20map.factor(zoom);
        this.d3.att.transform(scale(factor));
        var leg = $con.legend.scale();
        var width = v => leg(v) / factor;
        this.d3.selectAll<IPath>('path')
            .att.stroke_width(p => p.width(width));
    }
    transform(map: Microsoft.Maps.Map, level: number) {
        this.rescale(level);
    }

    paths(): IPath[] {
        return this._layout.paths();
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