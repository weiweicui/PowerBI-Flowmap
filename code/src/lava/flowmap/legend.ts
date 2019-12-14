import { $state } from './app';
import { Banner } from './banner';
import { StringMap, keys, values, IPoint, Func } from '../type';
import * as util from './util';
import { scaleLinear } from 'd3-scale';
import { ISelex, selex } from '../d3';

interface DistinctColor {
    center?: IPoint;
    label: string;
    color: string;
}

let msgs = {
    relocate: 'Drag/Drop to manually change geo-locations. Turn off "Relocate" when done.'
}

export class Legend {

    private _svg: ISelex;
    private _banner: Banner<'issue'>;

    constructor(div: ISelex) {
        this._banner = new Banner<'issue'>(selex('#warn'), [238, 130, 124])
            .key(k => k)
            .border(() => $state.border)
            .content(k => this._warn())
            .anchor(k => {
                if ($state.config.legend.position === 'top') {
                    return { x: $state.border.width / 2, y: this.height() };
                }
                else {
                    return { x: $state.border.width / 2, y: $state.border.height - this.height() };
                }
            });
        this._svg = div.append('svg')
            .sty.cursor('default').sty.pointer_events('visiblePainted');
        this._svg.sty.cursor('default').sty.position('absolute');
        this._svg.append('rect').att.id('mask').att.fill('white')
            .att.translate(0, -1).att.width('100%').att.height('100%')
            .on('mouseover', _ => {
                if (values($state.issues).some(v => v.negative || v.selflink || v.unlocate)) {
                    const position = $state && $state.config && $state.config.legend.position !== 'top' ? 'top' : 'bottom';
                    this._banner.add('issue', position);
                }
            })
            .on('mouseout', _ => this._banner.clear());
        this._svg.append('g').att.id("color");
        this._svg.append('g').att.id("scale");
        this._svg.append('text').att.id('info').att.x(2);
        this._svg.append('defs').append('linearGradient').att.id('grad')
            .selectAll('stop').data([0, 0.5, 1]).enter().append('stop')
            .att.offset(i => (i * 100) + '%').att.stop_color(i => '#FF0000');
    }

    private _textY() {
        return (+$state.config.legend.fontSize) + 2;
    }

    private _warn() {
        const issues = values($state.issues);
        const div = selex(document.createElement('div')).att.class('war');
        div.append('div').att.class('header').text('The visualization is incomplete due to:');
        const section = (arr: string[], name: string) => {
            if (arr.length === 0) {
                return;
            }
            let content = '';
            if (arr.length > 8) {
                var rest = `...(${arr.length - 8} more)`;
                content = arr.slice(0, 8).concat(rest).join(', ');
            }
            else {
                content = arr.join(', ');
            }
            let row = div.append('div').att.class('row');
            row.append('div').att.class('sect').text(name);
            row.append('div').att.class('value').text(content);
        };
        section(issues.filter(v => v.unlocate).map(v => v.unlocate), 'Unlocatable:');
        section(issues.filter(v => v.selflink).map(v => v.selflink), 'Self-link:');
        section(issues.filter(v => v.negative).map(v => v.negative), 'Negative value:');
        return div.node<HTMLElement>();
    }

    height(): number {
        return +$state.config.legend.fontSize * 1.5 + 4;
    }

    private _colorWidth = 0;
    private _scaleWidth = 0;
    resize() {
        const { show, position } = $state.config.legend;
        const height = $state.mapctl.map.getHeight();
        const width = $state.mapctl.map.getWidth();
        const legHeight = show ? this.height() : 0;
        const top = position === 'top' ? null : (height - legHeight + 2) + 'px';
        this._svg.sty.margin_top(top).sty.display(show ? null : 'none');
        this._resize(width);
    }


    private _resize(width: number) {
        this._svg.att.width(width).att.height(this.height()).sty.font_size($state.config.legend.fontSize + 'px');
        let space = width - this._colorWidth;
        let bias = space < this._scaleWidth ? this._colorWidth : width - this._scaleWidth;
        this._svg.select('#scale').att.translate(bias, 0);
    }

    private _info: string;
    info(v: string): void {
        // throw 'show info';
        this._info = v;
        if (!v && $state.config.advance.relocate) {
            this._info = msgs.relocate;
        }
        this._updateDisplay();
        this._svg.select('#info').att.y(this._textY()).text(this._info);
    }

    public clear() {
        this._svg.select('#scale').selectAll('*').remove();
        this._svg.select('#color').selectAll('*').remove();
        this._svg.select('#info').text('');
    }

    d3(key: 'info') {
        return this._svg.select('#info');
    }

    public recolor(color: { domain: number[], range: string[] } | { distinct: StringMap<string> }) {
        this._colorWidth = 0;
        const root = this._svg.select('#color');
        root.selectAll('*').remove();
        if (!$state.config.legend.color) {
            return;
        }
        if ('distinct' in color) {
            const distinct = color.distinct;
            const colors = {} as StringMap<DistinctColor>;
            for (let color of keys(distinct)) {
                colors[color] = { color, label: distinct[color] };
            }
            const pos = $state.config.legend.position === 'top' ? 'bottom' : 'top';
            let groups = root.selectAll('g').data(values(colors)).enter().append('g');

            let r = (+$state.config.legend.fontSize) * 0.7 / 2, y = this._textY(), bias = 0;
            groups.append('circle')
                .att.cx(r + 3).att.cy(y - r).att.r(r).att.stroke_width(1)
                .att.fill(info => info.color).att.stroke(info => info.color);
            groups.append('text').att.x(2 * r + 4).att.y(y)
                .text(info => info.label).att.fill(null);

            let centerY = pos === 'top' ? 2 : this._textY();
            groups.each(function (info, i) {
                const item = selex(this).att.translate(bias, 0);
                const box = item.node<SVGGElement>().getBBox();
                info.center = { x: bias + box.x + box.width / 2, y: centerY };
                bias += box.x + box.width + 10;//10 is the gap between color items
            });
            this._colorWidth = bias;
        }
        else {
            const { domain, range } = color;
            let conv = scaleLinear<any, any>().domain(domain).range(range);
            if (domain.some(v => util.bad(v))) {
                conv = scaleLinear<any, any>().domain([0, 1]).range(range);
                this._svg.select('#grad').selectAll<number>('stop').att.stop_color(v => conv(+v));
            }
            else {
                this._svg.select('#grad').selectAll<number>('stop')
                    .att.stop_color(v => {
                        if (v === 0)
                            return conv(domain[0]);
                        else if (v === 1)
                            return conv(domain[1]);
                        else
                            return conv(domain[0] / 2 + domain[1] / 2);
                    });
            }
            const fontsize = +$state.config.legend.fontSize, height = this.height();
            const w = fontsize * 15, h = fontsize / 2;
            root.append('rect').att.width(w).att.height(h).att.x(0).att.y(height - 2 - h)
                .sty.fill('url(#grad)');
            const labels = util.nice(domain);
            root.append('text').text(labels[0]).att.x(0).att.y(fontsize + 1).att.text_anchor('start');
            root.append('text').text(labels[1]).att.x(w).att.y(fontsize + 1).att.text_anchor('end');
            this._colorWidth = root.node<SVGGElement>().getBBox().width + 2;
            root.att.translate(2, 0);
        }
    }

    public rewidth(width: { invert: Func<number, number>, scale: Func<number, number>, dmax: number } | { distinct: StringMap<string> }) {
        this._scaleWidth = 0;
        this._svg.select('#scale').selectAll('*').remove();
        if (!$state.config.legend.width) {//hiden
            return;
        }
        else if ('invert' in width) {
            const { scale, invert, dmax } = width, root = this._svg.select('#scale'), cap = this.height() - 2;
            const v1 = Math.max(0, invert(1)), vhalf = invert(cap / 2), vcap = invert(cap), linear = scaleLinear();
            if (vcap <= 0 || dmax < v1) {
                return;
            }
            else if (dmax < vhalf) {
                linear.domain([v1, vhalf]).range([1, cap / 2]);
            }
            else if (dmax < vcap) {
                linear.domain([v1, dmax]).range([1, scale(dmax)]);
            }
            else {
                linear.domain([v1, vcap]).range([1, cap]);
            }
            let ticks = null as number[], fmt = null as Func<number, string>;
            for (let cnt = 4; cnt < 10; cnt++) {
                let vals = linear.ticks(cnt);
                if (vals[0] === 0) {
                    vals.shift();
                }
                if (vals.length >= 3) {
                    fmt = linear.tickFormat(cnt, 's');
                    ticks = vals.slice(0, 3);
                    break;
                }
            }
            if (!ticks) {
                return;
            }
            const bars = root.selectAll('.bar').data(ticks).enter().append('g').att.class('bar');
            let barWidth = 20;
            bars.append('rect').sty.fill('#AAA');
            bars.append('text').att.class('mark').sty.text_anchor('middle')
                .att.y(this._textY()).text(v => fmt(v))
                .each(function () { barWidth = Math.max((this as any).getBBox().width + 2, barWidth); });
            
            bars.selectAll('rect').att.x(0).att.y(d => cap - scale(+d))
                .att.width(barWidth).att.height(d => scale(+d));
            bars.selectAll('text').att.x(barWidth / 2);
            bars.att.translate((_, i) => i * (barWidth + 10), () => 0);
            this._scaleWidth = (barWidth + 10) * ticks.length - 10;
        }
        else {
            const distinct = width.distinct;
            const root = this._svg.select('#scale');
            const fsize = +$state.config.legend.fontSize;
            const wids = keys(distinct).map(w => +w);
            const middle = this._textY() - fsize * 0.7 / 2, length = 1.5 * fsize;
            const groups = root.selectAll('g').data(wids).enter().append('g');
            groups.append('rect').att.y(w => middle - w / 2)
                .att.width(length).att.height(w => w).att.fill('#555');
            let bias = 0;
            groups.append('text').att.x(length + 2).att.y(this._textY()).text(w => distinct[w]);
            groups.each(function () {
                const item = selex(this);
                item.att.translate(bias, 0);
                bias += item.node<SVGGElement>().getBBox().width + 10;//10 is the gap
            });
            this._scaleWidth = bias;
        }
    }

    private _updateDisplay(): void {
        let { color: showColor, width: showWidth } = $state.config.legend;
        if (this._info) {
            showColor = showWidth = false;
        }
        this._svg.select('#color').sty.display(showColor ? null : 'none');
        this._svg.select('#scale').sty.display(showWidth ? null : 'none');
        this._svg.select('#info').sty.display(this._info ? null : 'none');
    }
}