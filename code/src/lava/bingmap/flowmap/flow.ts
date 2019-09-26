import { Func } from '../../type';
import { $state } from './app';
import { IShape, build } from './shape';
import { IPath } from './algo';
import { ISelex } from '../../d3';
import { IListener } from '../controller';
import { IBound } from '../converter';

let root: ISelex;

export const events = {
    hover: null as Func<number[], void>,
    pathInited: null as Func<ISelex<IPath>, void>
}

class VisualFlow {
     rows: number[];
    
    public get bound() {
        return this._shape.bound;
    }

    reweight(weight: Func<number, number>) {
        return this._shape.calc(weight);
    }

    private _tRoot: ISelex;
    private _sRoot: ISelex;
    private _shape: IShape;
    constructor(d3: ISelex, rows: number[]) {
        this._tRoot = d3.datum(this).att.class('vflow anchor');
        this._sRoot = this._tRoot.append('g').att.class('scale');
        this.rows = rows;
        this._relayout();
    }

    remove() {
        this._tRoot.remove();
    }

    public reformat(recolor: boolean, rewidth: boolean) {
        if (recolor) {
            const paths = this._sRoot.selectAll<IPath>('.base');
            if ($state.config.style === 'flow') {
                const color = $state.color(this.rows[0]);
                paths.att.stroke(color);
            }
            else {
                paths.att.stroke(p => $state.color(+p.id));
            }
        }
        if (rewidth && this._shape) {
            this._shape.rewidth();
        }
    }
    
    private _hoverTimer = null as number;
    private _hoverState = null as any;
    private _onover = (p: IPath) => {
        const rows = p.leafs as number[];
        if (this._hoverTimer) {
            clearTimeout(this._hoverTimer);
            this._hoverTimer = null;
        }
        if (this._hoverState !== p.id && this._hoverState) {
            this._hoverState = null;
            events.hover && events.hover(null);
        }
        if (this._hoverState === null) {
            this._hoverTimer = window.setTimeout(() => {
                if (this._hoverState) {
                    events.hover && events.hover(null);
                }
                events.hover && events.hover(rows);
                this._hoverState = p.id;
                this._hoverTimer = null;
            }, 300);
        }
    };

    private _onout = () => {
        if (this._hoverTimer) {
            clearTimeout(this._hoverTimer);
            this._hoverTimer = null;
        }
        this._hoverTimer = window.setTimeout(() => {
            if (this._hoverState) {
                this._hoverState = null;
                events.hover && events.hover(null);
            }
            this._hoverTimer = null;
        }, 100);
    };

    private _relayout() {
        this._shape = this._build();
        if (!this._shape) {
            return;
        }
        let all = this._sRoot
            .selectAll<IPath>('.flow')
            .on('mouseover', this._onover)
            .on('mouseout', this._onout);
        
        this._translate();
        events.pathInited && events.pathInited(all);
    }

    transform(map: Microsoft.Maps.Map, pzoom: number) {
        if (this._shape) {
            this._shape.transform(map, pzoom);
            this._translate();
        }
    }

    private _translate() {
        this._tRoot.att.translate($state.mapctl.pixel(this._shape.bound));
    }

    private _build() {
        const source = $state.loc($state.config.source(this.rows[0]));
        const weights = this.rows.map(r => Math.max($state.config.weight.conv(r), 0));
        const targets = this.rows.map(r => $state.loc($state.config.target(r)));
        return build($state.config.style, this._sRoot, source, targets, this.rows, weights);
    }
}

export function init(d3: ISelex): IListener {
    root = d3;
    return { transform: (ctl, pzoom) => { flows.forEach(v => v.transform(ctl.map, pzoom)); } }
}

export function add(rows: number[]) {
    flows.push(new VisualFlow(root.append('g'), rows));
}

export function clear() {
    for (const v of flows) {
        v.remove();
    }
    flows = [];
}

export function bounds(): IBound[] {
    return flows.map(f => f.bound);
}

let flows = [] as VisualFlow[];

export function reweight(weight: Func<number, number>): number[] {
    let exts = flows.map(v => v.reweight(weight));
    let min = Math.min(...exts.map(e => e[0]));
    let max = Math.max(...exts.map(e => e[1]));
    return [min, max];
}

export function reformat(recolor: boolean, rewidth: boolean) {
    for (let f of flows) {
        f.reformat(recolor, rewidth);
    }
}
