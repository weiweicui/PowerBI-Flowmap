import { msgs, d3util } from './app';
import { tooltip } from 'tooltip';
import { sum } from 'array';
import { VisualFlow } from './structure';
import { translate } from 'd3/attr';
import { $con, $fmt } from "./visual";
import { Func, randomID, StringMap, keys, pick, values, sameKeys, sameArray } from "type";
import { Banner } from "banner";
import { Fill } from "./format";


interface ColorLegend {
    rows   : number[];
    id     : powerbi.visuals.ISelectionId;
    label  : string;
    key    : string;
    d3?    : d3.Any;
    center?: number;
    warn?  : HTMLElement;
}

export class Legend {

    height(): number {
        return (+$fmt.legend.values.fontSize) * 1.5 + 4;
    }

    constructor(div: d3.Any) {
        this._svg = div.append('svg');
        this._svg.sty.font_size($fmt.legend.values.fontSize + 'px');
        this._svg.sty.cursor('default');
        this._svg.att.width(0).att.height(this.height()).sty.position('absolute');
        this._svg.append('rect')
            .att.id('mask').att.fill('white')
            .att.transform(translate(0, -2))
            .attr('width', '100%').attr('height', '100%');
        this._svg.append('g').att.id("cat");
        this._svg.append('g').att.id("scale");
        this._svg.append('text').att.id('info');
        this._banner = new Banner<string>(d3.select('#lava_warn'), [238, 130, 124])
            .key(k => k)
            .border(() => $con.border())
            .content(k => this._colors[k].warn)
            .anchor(k => {
                if ($fmt.legend.values.position === 'top') {
                    return { x: this._colors[k].center, y: this._textY() };
                }
                else {
                    var svg = this._svg.node<SVGSVGElement>();
                    var zero = svg.createSVGPoint();
                    zero.x = this._colors[k].center;
                    zero.y = 2;
                    zero = zero.matrixTransform(svg.getScreenCTM());
                    return zero;
                }
            });
    }

    private _catGap = 10;
    private _svg: d3.Any;
    private _banner: Banner<string>;
    private _svgWidth = 0;
    private _barGap = 10;
    private _scale: Func<number, number>;
    private _domain = [0, 1];
    private _lenScale = 0;
    private _lenCat = 0;
    private _barWidth = 0;
    private _range = [0, 0];
    
    
    resize(width: number) {
        this._svgWidth = width;
        this._svg.att.width(width).att.height(this.height());
        let space = width - this._lenCat;
        let bias = space < this._lenScale ? this._lenCat : width - this._lenScale;
        this._root('scale').att.transform(translate(bias, 0));
    }

    private _textY() {
        return (+$fmt.legend.values.fontSize) + 2;
    }

    clear() {
        this._svg.select('#cat').selectAll('*').remove();
        this._svg.select('#scale').selectAll('*').remove();
        this._svg.select('#info').sty.display('none');
        this._colors = {};
        this._domain = [0, 1];
        this._range = [0, 0];
    }

    private _root(tag: 'cat' | 'scale' | 'info') {
        return this._svg.select('#' + tag);
    }

    private _radius() {
        return (+$fmt.legend.values.fontSize) * 0.7 / 2;
    }

    public resetWarnings() {
        for (var color of keys(this._colors)) {
            this._resetWarning(color);
        }
        this._root('cat').selectAll<string>('text')
            .att.fill(c => {
                return this._colors[c].warn ? 'red' : null
            });
    }

    private _resetWarning(color: string) {
        var unlocate = {} as StringMap<true>;
        var selflink = {} as StringMap<true>;
        var negative = {} as StringMap<true>;
        for (var flow of this._flows(color)) {
            var issue = flow.issue();
            for (var k of keys(issue.unlocatable)) {
                unlocate[k] = true;
            }
            for (var k of keys(issue.selflink)) {
                selflink[k] = true;
            }
            for (var k of keys(issue.negative)) {
                negative[k] = true;
            }
        }
        var unlo = keys(unlocate);
        var self = keys(selflink);
        var nega = keys(negative);
        if (!unlo.length && !self.length && !nega.length) {
            delete this._colors[color].warn;
            return;
        }
        var div = d3.select(document.createElement('div')).att.class('war');
        div.append('div').att.class('header').text('The visualization is incomplete due to:');
        var section = (arr: string[], name: string) => {
            if (!arr.length) {
                return;
            }
            var content = '';
            if (arr.length > 8) {
                var rest = `...(${arr.length - 8} more)`;
                content = arr.slice(0, 5).concat(rest).join(', ');
            }
            else {
                content = arr.join(', ');
            }
            var row = div.append('div').att.class('row');
            row.append('div').att.class('sect').text(name);
            row.append('div').att.class('value').text(content);
        };
        section(unlo, 'Unlocatable:');
        section(self, 'Self-link:');
        section(nega, 'Negative value:');
        this._colors[color].warn = div.node<HTMLElement>();
    }

    private _flows(color: string): VisualFlow[] {
        var colorof = $con.property('color', 'fill');
        return $con.layer.data().filter(f => {
            return color === colorof(f.row).solid.color;
        });
    }

    highlight() {
        var solid = {} as StringMap<true>;
        var colorof = $con.property('color', 'fill');
        for (var flow of $con.layer.data()) {
            var color = colorof(flow.row).solid.color;
            if (flow.state !== 'empty') {
                solid[color] = true;
            }
        }
        this._svg.selectAll<string>('circle')
            .att.fill(c => c in solid ? c : 'white')
            .att.stroke(c => c);
    }
    
    private _onclick = (color: string) => {
        var rows = [] as number[], colorof = $con.property('color', 'fill');
        for (var flow of $con.layer.data()) {
            if (color === colorof(flow.row).solid.color) {
                rows = rows.concat(flow.rows as number[]);
            }
        }
        $con.selection.click(rows);
    };

    reformat() {
        var legend = $con.fmt.legend;
        this._svg.sty.font_size(legend.values.fontSize + 'px');
        if (!legend.values.show) {
            this._svg.sty.display('none');
            return;
        }
        else if (legend.dirty('show')) {
            this._svg.sty.display(null);
            this._resetBars();
            this._reArrangeColors();
            this.resize(this._svgWidth);
            return;
        }
        if (!this._info && legend.values.scale) {
            this._root('scale').sty.display(null);
        }
        else {
            this._root('scale').sty.display('none');
        }
        if (!this._info && legend.values.customize) {
            this._root('cat').sty.display(null);
        }
        else {
            this._root('cat').sty.display('none');
        }
        if (legend.dirty('fontSize')) {
            this._reArrangeColors();
            this._resetBars();
            this.resize(this._svgWidth);
        }
        if (this._resetColors()) {
            this._reArrangeColors();
            this.resize(this._svgWidth);
        }
        this.highlight();
    }

    private _reArrangeColors() {
        var root = this._root('cat'), radius = this._radius(), y = this._textY(), bias = 0;
        root.selectAll('circle').att.cx(radius + 3).att.cy(y - radius).att.r(radius);
        root.selectAll('text').att.x(2 * radius + 4).att.y(y);
        var self = this;
        root.selectAll<string>('.catItem')
            .each(function (k, i) {
                var sel = d3.select(this);
                sel.att.transform(translate(bias, 0));
                var box = sel.node<SVGGElement>().getBBox();
                self._colors[k].center = bias + box.x + box.width / 2;
                bias = bias + box.x + box.width + self._catGap;
            });
        this._lenCat = bias;
    }
    
    rescale(): boolean {
        var domain = $con.layer.flys.extend();
        var root = this._svg.select('#scale');
        if (!domain) {
            root.selectAll('*').remove();
            return;
        }
        var format = $fmt.scale.values;
        if (format.autoScale) {
            var map = $con.layer.map;
            var cap = Math.min(map.getWidth(), map.getHeight()) / 30;
        }
        else {
            var cap = format.factor * 2;
        }
        if (domain[0] === this._domain[0] && domain[1] == this._domain[1]) {
            if (this._range[0] === +format.min && this._range[1] === cap) {
                if (!$fmt.scale.dirty()) {
                    return false;
                }
            }
        }
        this._domain = domain;
        this._range = [+format.min, cap];
        this._resetBars();
        this._scale = d3util.scale(format, domain, cap);
        return true;
    }

    private _resetBars() {
        let root = this._root('scale');
        root.selectAll('*').remove();
        if ($con.column('Weight')) {
            root.append('title').text($con.column('Weight').source.displayName + ' by width');
        }
        this._lenScale = this._barWidth = 0;
        if (!$fmt.legend.values.scale) {
            return;
        }
        let format = $fmt.scale.values;
        let domain = this._domain, cap = this._range[1];
        let height = this._textY() + 1;
        let ticks = d3util.ticks(format, domain, height, cap);
        if (ticks.length !== 3) {
            return;
        }
        let widthLimit = 50;
        let scale = d3util.scale(format, domain, cap);
        let bars = root.selectAll('.bar').data(ticks).enter().append('g').att.class('bar');
        let texts = [] as SVGTextElement[];
        bars.append('rect').sty.fill('#ccc');
        bars.append('text')
            .att.class('mark')
            .sty.text_anchor('middle')
            .att.y(this._textY())
            .each(function () { texts.push(this); });
            
        let prec = (ticks[0] + '').length - 1, len = ticks.length, i = 0;
        let maxTextWidth = (strs: any[]) => {
            for (i = 0; i < len; i++) {
                texts[i].textContent = strs[i];
            }
            return Math.max(...texts.map(m => m.getBBox().width)) + 2;
        };

        let width = maxTextWidth(ticks);
        while (width > widthLimit && prec > 1) {
            let strs = ticks.map(v => v.toPrecision(prec));
            for (i = 1; i < len; i++) {
                if (strs[i - 1] === strs[i]) {
                    break;
                }
            }
            if (i < len) {
                width = maxTextWidth(ticks.map(v => v.toPrecision(prec + 1)));
                break;
            }
            else {
                width = maxTextWidth(strs);
                prec -= 1;
            }
        }
        this._barWidth = width;

        bars.selectAll('rect')
            .att.x(0)
            .att.y(d => height - scale(+d))
            .att.width(width)
            .att.height(d => scale(+d));
        bars.selectAll('text')
            .att.x(width / 2);
        bars.att.transform((d, i) => {
            return translate(i * (this._barWidth + this._barGap), 0);
        })
        this._lenScale = (this._barWidth + this._barGap) * ticks.length - this._barGap;
        this.resize(this._svgWidth);
    }

    scale(): Func<number, number> {
        return this._scale || (w => Math.max(1, w / 20000));
    }
    
    private _info: string;
    info(info: string): void {
        this._info = info;
        if (info) {
            this._root('cat').sty.display('none');
            this._root('scale').sty.display('none');
            this._root('info').sty.display(null)
                .att.x(2).att.y(this._textY())
                .text(info);
        }
        else {
            if ($fmt.advance.values.relocate) {
                this.info(msgs.relocate);
            }
            this._root('cat').sty.display(null);
            if ($fmt.legend.values.scale) {
                this._root('scale').sty.display(null);
            }
            this._root('info').sty.display('none')
        }
    }

    private _colors = {} as StringMap<ColorLegend>;
    private _resetColors(): boolean {
        var dict = {} as StringMap<ColorLegend>;
        if (!$fmt.color.values.customize) {
            var color = $fmt.color.values.fill.solid.color;
            dict[color] = {
                rows: $con.layer.data().map(d => d.row).sort((a, b) => a - b),
                label: $fmt.legend.values.label,
                id: null,
                key: color
            };
        }
        else {
            var role = $con.category, cat = $con.cat(role);
            var colorOf = $con.property('color', 'fill');
            var labelOf = $con.property('legend', 'label');
            for (var flow of values($con.layer.flows)) {
                var row = flow.row, color = colorOf(row).solid.color, label = labelOf(row);
                if (color in dict) {
                    dict[color].rows.push(row);
                    if (!dict[color].label && label) {
                        dict[color].label = label;
                    }
                }
                else {
                    dict[color] = { rows: [row], label, id: cat.id(row), key: color };
                }
            }
            values(dict).forEach(d => {
                d.rows.sort((a, b) => a - b); d.id = cat.id(d.rows[0]);
            });
        }
        var valids = values(dict).filter(d => d.label && d.label.length > 0);
        var dirty = keys(this._colors).length !== valids.length;
        if (!dirty && valids.some(d => !(d.key in this._colors))) {
            dirty = true;
        }
        if (!dirty && valids.some(d => d.label !== this._colors[d.key].label)) {
            dirty = true;
        }
        if (!dirty && valids.some(d => !sameArray(d.rows, this._colors[d.key].rows))) {
            dirty = true;
        }

        this._colors = dict;
        if (!dirty) {
            return false;
        }
        var root = this._root('cat');
        root.selectAll('*').remove();
        var groups = root.selectAll('g').data(valids.map(v => v.key)).enter()
            .append('g').att.class('catItem').att.id(k => randomID(k))
            .sty.cursor('hand')
            .on('mouseover', k => {
                if (this._colors[k].warn) {
                    var top = $fmt.legend.values.position === 'top';
                    this._banner.add(k, top ? 'bottom' : 'top');
                }
            })
            .on('click', this._onclick)
            .on('mouseout', k => { this._banner.clear() });
        groups.append('circle');
        groups.append('text').text(k => dict[k].label);
        this.resetWarnings();
        this._reArrangeColors();
        return true;
    }

    labelFormats(): powerbi.VisualObjectInstance[] {
        let ret = [] as powerbi.VisualObjectInstance[], fmt = $con.fmt.legend.values;
        ret.push({
            objectName: 'legend',
            selector: null,
            properties: pick(fmt, ['customize'])
        });
        if (!fmt.customize) {
            return ret;
        }
        if (!$fmt.color.values.customize) {
            ret.push({
                objectName: 'legend',
                selector: null,
                properties: pick(fmt, ['label'])
            })
            return ret;
        }
        else {
            var cat = $con.cat($con.category);
            for (var info of values(this._colors)) {
                ret.push({
                    objectName: 'legend',
                    displayName: '• ' + cat.labels(info.rows).join(', '),
                    selector: info.id.getSelector(),
                    properties: { label: info.label }
                });
            }
            return ret;
        }
    }

    colorFormats(): powerbi.VisualObjectInstance[] {
        var ret = [] as powerbi.VisualObjectInstance[];
        ret.push({
            objectName: 'color',
            selector: null,
            properties: pick($fmt.color.values, ['fill', 'customize'])
        });
        if (!$fmt.color.values.customize) {
            return ret;
        }
        var cat = $con.cat($con.category), prop = $con.property('color', 'fill');
        var mark = {} as StringMap<true>;
        for (var flow of $con.layer.data()) {
            var key = $con.colour(flow.row);
            if (key in mark) {
                continue;
            }
            mark[key] = true;
            ret.push({
                objectName: 'color',
                displayName: '• ' + key,
                selector: cat.id(flow.row).getSelector(),
                properties: { fill: prop(flow.row) }
            });
        }
        return ret;
    }

    color(flow: number | string): string {
        return $con.property('color', 'fill')(flow).solid.color;
    }
}