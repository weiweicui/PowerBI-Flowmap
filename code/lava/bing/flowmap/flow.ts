import { $cfg, loc, $fmt, $mapctl, hover, issues, GRAY, flowRows } from './app';
import { StringMap, dict, values, Func, pick } from 'type';
import { IShape, IPoint, IPath, build } from './shape';
import { IBound, IListener } from 'bing';
import { translate } from 'd3/attr';
import { Format } from './format';
import { extent } from 'array';
import { util } from './misc';
import * as inte from 'd3-interpolate';
import { Any } from 'd3-selection';
let root: d3.Any;

class VisualFlow {
    public state: 'empty' | 'part' | 'full';
    highlight() {
        if (!this._shape) {
            this.state = 'empty';
            return;
        }
        let flags = $cfg.selection.flags();
        if (flags === null) {
            this._shape.highlight('all');
            this.state = 'full';
        }
        else {
            let hits = this._validRows.filter(r => r in flags);
            if (hits.length === 0) {
                this._shape.highlight('none');
                this.state = 'empty';
            }
            else if (hits.length === this._validRows.length) {
                this._shape.highlight('all');
                this.state = 'full';
            }
            else {
                let high = this._shape.highlight(hits);
                high.on('click', this._pathClick);                
                $cfg.flow.onPathChanged && $cfg.flow.onPathChanged(high);
                this.state = 'part';
            }
        }
        this._shape.sort();
        this.reformat(true, false);
    }

    key: string;
    rows: number[];
    row: number;
    
    bound(rows: number[]) {
        if (this._shape) {
            return this._shape.bound(rows);
        }
        return null;
    }

    reweight(weight: Func<number, number>) {
        if (this._shape) {
            return this._shape.reweight(weight);
        }
        else {
            return null;
        }
    }

    rewidth() {
        if (this._shape) {
            this._shape.rewidth();
        }
    }

    private _tRoot: d3.Any;
    private _sRoot: d3.Any;
    private _shape: IShape;
    private _bound: IBound;
    constructor(d3: d3.Any, rows: number[]) {
        this._tRoot = d3.datum(this).att.class('vflow anchor');
        this._sRoot = this._tRoot.append('g').att.class('scale');
        this.key = $cfg.group(rows[0]);
        this.rows = rows;
        this.row = rows[0];
        if (!$fmt.advance.relocate) {
            this._relayout();
        }
    }

    remove() {
        this._tRoot.remove();
    }

    public reformat(recolor: boolean, rewidth: boolean) {
        if (recolor) {
            this._sRoot.selectAll<IPath>('.base').att.stroke(GRAY);
            let conv = $cfg.color.conv;
            let highlighted = this._sRoot.selectAll<IPath>('.high');
            if ($fmt.style.type === 'flow') {
                highlighted.att.stroke(conv(this.row));
            }
            else {
                highlighted.att.stroke(p => conv(+p.id));
            }
        }
        if (rewidth && this._shape) {
            this._shape.rewidth();
        }
    }
    
    private _hoverTimer = null as number;
    private _hoverState = null as any;
    private _onover = (p: IPath) => {
        let rows = p.leafs as number[];
        if (this._hoverTimer) {
            clearTimeout(this._hoverTimer);
            this._hoverTimer = null;
        }
        if (this._hoverState !== p.id && this._hoverState) {
            this._hoverState = null;
            hover(null);
        }
        if (this._hoverState === null) {
            this._hoverTimer = window.setTimeout(() => {
                if (this._hoverState) {
                    hover(null);
                }
                hover(rows);
                this._hoverState = p.id;
                this._hoverTimer = null;
            }, 300);
        }
    };

    private _onout = (p: IPath) => {
        if (this._hoverTimer) {
            clearTimeout(this._hoverTimer);
            this._hoverTimer = null;
        }
        this._hoverTimer = window.setTimeout(() => {
            if (this._hoverState) {
                this._hoverState = null;
                hover(null);
            }
            this._hoverTimer = null;
        }, 100);
    };

    private _pathClick = (p: IPath) => {
        $cfg.selection.click(p.leafs as number[]);
    };

    private _relayout() {
        this._shape = this._build();
        if (!this._shape) {
            return;
        }
        let all = this._sRoot.selectAll<IPath>('.flow')
            .on('click', this._pathClick)
            .on('mouseover', this._onover)
            .on('mouseout', this._onout);
        
        this.reformat(true, false);
        this._translate();
        $cfg.flow.onPathChanged && $cfg.flow.onPathChanged(all);
        this.highlight();
    }

    transform(map: Microsoft.Maps.Map, pzoom: number) {
        if (this._shape) {
            this._shape.transform(map, pzoom);
            this._translate();
        }
    }

    private _translate() {
        if (this._shape) {
            let anchor = translate($mapctl.pixel(this._bound));
            this._tRoot.att.transform(anchor);
        }
    }

    private _validRows = [] as number[];
    private _build() {
        let src = loc($cfg.source(this.row));
        if (!src) {
            return null;
        }
        let trows = this._validRows = this.rows.filter(r => !issues[r]);
        let weight = util.weighter();
        let weis = trows.map(r => weight(r));
        let tars = trows.map(r => loc($cfg.target(r)));
        if (tars.length === 0) {
            return null;
        }
        let style = build($fmt.style.type, this._sRoot, src, tars, trows, weis);
        this._bound = style.bound(null);
        return style;
    }
}

export function reorder() {
    var score = { empty: 1, partial: 2, full: 3 };
    root.selectAll<VisualFlow>('.vflow')
        .sort((a, b) => score[a.state] - score[b.state]);
}

export function rows(f?: Func<number, boolean>): number[] {
    let all = [].concat(...values(vflows).map(f => f.rows));
    return f ? all.filter(f) : all;
}

export function listener(d3: d3.Any): IListener {
    root = d3;
    return {
        transform: (map, pzoom) => {
            data().forEach(v => v.transform(map, pzoom));    
        }
    }
}

let vflows = {} as StringMap<VisualFlow>;
export function add(rows: number[]) {    
    vflows[$cfg.group(rows[0])] = new VisualFlow(root.append('g'), rows);
}

export function clear() {
    for (let v of values(vflows)) {
        v.remove();
    }
    vflows = {};
}

export function bounds(rows: number[]): IBound[] {
    return pick(data(), f => f.bound(rows));
}

export function highlight() {
    data().forEach(f => f.highlight());
}

export function keys() {
    return values(vflows).map(f => f.key);
}

function data(): VisualFlow[] {
    return values(vflows);
}

export function remove(...keys: string[]) {
    for (let k of keys) {
        vflows[k] && vflows[k].remove();
        delete vflows[k];
    }
}

export function reweight(weight: Func<number, number>): number[] {
    let exts = pick(data(), v => v.reweight(weight));
    let min = Math.min(...exts.map(e => e[0]));
    let max = Math.max(...exts.map(e => e[1]));
    return [min, max];
}

export function reformat(recolor: boolean, rewidth: boolean) {
    for (let f of data()) {
        f.reformat(recolor, rewidth);
    }
}
