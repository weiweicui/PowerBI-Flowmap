import { IStyle, IPoint, IPath, arcStyle, flowStyle, lineStyle } from './renderer';
import { tooltip } from 'tooltip';
import { $con } from "./visual";
import { IArea, query, ILocation } from "bing";
import { sum } from 'array';
import { values, dict, match, keys, randomID, StringMap, Func } from "type";
import { translate, scale } from 'd3/attr';
import { util } from "./app";

export class Flow {
    static GRAY = '#AAA';
    readonly rows: ReadonlyArray<number>;
    readonly key: string;
    readonly addrs: ReadonlyArray<string>;//[src, tar1, tar2, ...]

    // color: string;
    constructor(rows: ReadonlyArray<number>) {
        this.rows = rows;
        this.key = $con.colour(rows[0]) + "_" + $con.source(rows[0]);
        var addrs = new Array(this.rows.length + 1);
        addrs[0] = $con.source(this.rows[0]);
        for (var i = 0; i < this.rows.length; i++) {
            addrs[i + 1] = $con.target(this.rows[i]);
        }
        this.addrs = addrs;
    }
}

export interface Issue {
    unlocatable: StringMap<true>,
    selflink   : StringMap<true>,
    negative   : StringMap<true>
}

export class VisualFlow {
    private base: Flow;
    private _all: d3.Any;
    private _root: d3.Any;
    private _color: string;
    tar2row: StringMap<number>;
    
    private _level = $con.$20map.level();
    private _anchor: ILocation;
    private _invalidTargets: StringMap<number>;
    constructor(root: d3.Any, raw: Flow) {
        this.base = raw;
        this._root = root.datum(this).att.class('visualflow');
        this._all = root.append('g');
        this.relayout();
    }

    remove() {
        this._root.remove();
        this._root = null;
        this._renderer = null;
    }

    get row() {
        return this.base.rows[0];
    }
    get key() {
        return this.base.key;
    }

    get color() {
        return this._color;
    }
    
    get rows() {
        return this.base.rows;
    }

    contains(addr: string): boolean {
        return addr === $con.source(this.row) || addr in this.tar2row || addr in this._invalidTargets;
    }
    
    sortPaths() {
        this._renderer.sort();
    }

    //rebuild _layout, and paths
    relayout() {
        this._all.selectAll('.flow').remove();
        this._renderer = this._buildStyle();
        if (!this._renderer) {
            return;
        }
        this._translate();
        var conv = util.pathConverter(null);
        var width = $con.legend.scale();
        this._color = $con.legend.color(this.row);
        this._all.selectAll('.base')
            .data(this._renderer.paths()).enter()
            .append('path')
            .att.class('flow base')
            .att.stroke(this._color)
            .att.stroke_width(p => p.width(width))
            .att.stroke_linecap('round')
            .att.d(p => p.d(conv))
            .att.fill('none')
            .on('click', util.pathClick)
            .on('mouseover', this._onover)
            .on('mouseout', this._onout);
        
        this.highlight($con.selection.flags());

        //todo better update extend
        var weights = this._renderer.paths().map(p => sum(values(p.leafs)));
        weights.sort((a, b) => a - b);
        tooltip.add(this._all.selectAll<IPath>('.flow'), util.pathTooltip);
        this.extend = [weights[0], weights[weights.length - 1]] as any;

        this._renderer.rescale(null);
    }

    state = 'full' as 'full' | 'empty' | 'partial';

    private _hoverTimer = null as number;
    private _hoverState = null as string;
    private _hover(p: IPath, type: 'over' | 'out') {
        if (type === 'over') {
            if (this._hoverState === p.id) {
                if (this._hoverTimer) {
                    clearTimeout(this._hoverTimer);
                    this._hoverTimer = null;
                }
            }
            else if (this._hoverState) {
                this._hoverState = null;
                $con.layer.pies.hover(null, 'out');
            }
            if (this._hoverTimer) {
                clearTimeout(this._hoverTimer);
                this._hoverTimer = null;
            }
            this._hoverTimer = window.setTimeout(() => {
                if (this._hoverState) {
                    $con.layer.pies.hover(null, 'out');
                }
                var addrs = keys(p.leafs).map(r => $con.target(+r));
                $con.layer.pies.hover(addrs, 'over');
                this._hoverState = p.id;
            }, 300);
        }
        else {
            if (this._hoverTimer) {
                clearTimeout(this._hoverTimer);
                this._hoverTimer = null;
            }            
            this._hoverTimer = window.setTimeout(() => {
                if (this._hoverState) {
                    this._hoverState = null;
                    $con.layer.pies.hover(null, 'out');
                }
            }, 100);
        }
    }
    private _onover = (p: IPath) => this._hover(p, 'over');
    private _onout = (p: IPath) => this._hover(p, 'out');

    recolor(color: string) {
        this._color = color;
        if (this.state === 'full') {
            this._all.selectAll('.base.flow').att.stroke(color);
        }
        else if (this.state === 'partial') {
            this._all.selectAll('.high.flow').att.stroke(color);
        }
    }

    colorOf: Func<string, string>;
    highlight(flag: StringMap<true> | null) {
        if (!this._renderer) {
            return;
        }
        if (flag === null) {
            var selected = this.base.rows as number[];
            this.colorOf = t => this._color;
        }
        else {
            var selected = this.base.rows.filter(r => flag[r]);
            var mark = dict(selected, r => $con.target(r));
            this.colorOf = t => t in mark ? this._color : Flow.GRAY;
        }

        if (selected.length === this.base.rows.length) {
            this._renderer.highlight('all').att.stroke(this._color);
            if (this.state !== 'full') {
                $con.layer.pies.recolor(this);
            }
            this.state = 'full';
            return;
        }
        else if (selected.length === 0) {
            this._renderer.highlight('none').att.stroke(Flow.GRAY);
            if (this.state !== 'empty') {
                $con.layer.pies.recolor(this);
            }
            this.state = 'empty';
            return;
        }
        else {
            this._all.selectAll('.base').att.stroke(Flow.GRAY);
            this.state = 'partial';
            this._renderer.highlight(selected)
                .att.stroke(this._color)
                .on('click', util.pathClick)
                .on('mouseover', this._onover)
                .on('mouseout', this._onout);
            $con.layer.pies.recolor(this);
            tooltip.add(this._all.selectAll<IPath>('.flow'), util.pathTooltip);
        }
    }
    
    private _translate() {
        if (!this._renderer) {
            return;
        }
        var pix = $con.layer.pixel(this._anchor);
        this._root.att.transform(translate(pix));
    }
    
    rescale() {//update width scale and repaint
        if (!this._renderer) {
            return;
        }
        this._translate();
        this._renderer.rescale(this._level);
    }

    public extend: ReadonlyArray<number>;
    private _renderer: IStyle;
    
    private _issue = { unlocatable: {}, selflink: {}, negative:{} } as Issue;
    issue(): Issue {
        return this._issue;
    }

    private _buildStyle(): IStyle {
        this.tar2row = {};
        this._invalidTargets = {};

        let { rows, addrs } = this.base;
        let issue = { unlocatable: {}, selflink: {}, negative: {} } as Issue;
                
        if (!query(addrs[0])) {
            issue.unlocatable[addrs[0]] = true;
            this._issue = issue;
            return null;    
        }
        var tcoords = [], weights = [], trows = [];
        for (var i = 1; i < addrs.length; i++) {
            let trow = rows[i - 1], addr = addrs[i], coord = query(addr);
            if (!coord) {
                issue.unlocatable[addr] = true;
                this._invalidTargets[addr] = trow;
            }
            else if (addrs[0] === addr) {
                issue.selflink[addr] = true;
                this._invalidTargets[addr] = trow;
            }
            else {
                var weight = $con.weight(trow);
                if (weight < 0) {
                    issue.negative[addr] = true;
                    this._invalidTargets[addr] = trow;
                }
                else {
                    this.tar2row[addr] = trow;
                    trows.push(trow);
                    tcoords.push(coord);
                    weights.push(weight);
                }
            }
        }
        this._issue = issue;
        
        if (tcoords.length === 0) {
            return null;
        }
        if ($con.fmt.advance.values.style === 'arc') {
            this._anchor = query(addrs[0]);
            return arcStyle(this._all, query(addrs[0]), tcoords, trows, weights);
        }
        else {
            var locs = [query(addrs[0])].concat(tcoords);
            var { anchor, points } = $con.$20map.points(locs);
            this._anchor = anchor;
            var src = points.splice(0, 1)[0] as IPoint;
            src.key = $con.source(this.row);
            for (var i = 0, len = points.length; i < len; i++) {
                (<IPoint>points[i]).key = trows[i];
            }
            if ($con.fmt.advance.values.style === 'curve'){
                return flowStyle(this._all, src, points, weights);
            }
            else {
                return lineStyle(this._all, src, points, weights);
            }
        }
    }

    transform(map: Microsoft.Maps.Map, tzoom: number) {
        if (!this._renderer) {
            return;
        }
        this._translate();
        this._renderer.transform(map, this._level);
        this._level = map.getZoom();
    }
}