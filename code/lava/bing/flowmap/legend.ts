import { $fmt, $border, $cfg, issues, flowRows } from './app';
import { translate } from 'd3/attr';
import { Banner } from 'banner';
import { StringMap, keys, randomID, values, IPoint, Func } from 'type';
import { util } from './misc';
import { Format } from './format';
import * as flows from './flow';
import { select, Any } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
interface DistinctColor {
    center?: IPoint;
    rows: number[];
    label: string;
    color: string;
}

let msgs = {
    relocate: 'Drag/Drop to manually change geo-locations. Turn off "Relocate" when done.'
}

export class Legend {

    private _svg: Any;
    private _banner: Banner<DistinctColor>;
    
    constructor(div: d3.Any) {
        this._svg = div.append('svg');
        this._svg.sty.font_size($fmt.legend.fontSize + 'px');
        this._svg.sty.cursor('default');
        this._svg.att.width(0).att.height(this.height()).sty.position('absolute');
        this._svg.append('rect').att.id('mask').att.fill('white')
            .att.transform(translate(0, -1)).att.width('100%').att.height('100%');
        this._svg.append('g').att.id("color");
        this._svg.append('g').att.id("scale");
        this._svg.append('text').att.id('info').att.x(2);
        this._svg.append('defs').append('linearGradient').att.id('grad')
            .selectAll('stop').data([0, 0.5, 1]).enter().append('stop')
            .att.offset(i => (i * 100) + '%').att.stop_color(i => '#FF0000');
        this._banner = new Banner<DistinctColor>(select('#warn'), [238, 130, 124])
            .key(k => k.label)
            .border(() => $border)
            .content(k => this._warn(k))
            .anchor(k => {
                if ($fmt.legend.position === 'top') {
                    return k.center;
                }
                else {
                    var svg = this._svg.node<SVGSVGElement>();
                    var zero = svg.createSVGPoint();
                    zero.x = k.center.x;
                    zero.y = k.center.y;
                    zero = zero.matrixTransform(svg.getScreenCTM());
                    return zero;
                }
            });
    }

    private _textY() {
        return (+$fmt.legend.fontSize) + 2;
    }

    private _warn(inf: DistinctColor) {
        let { rows, color } = inf;
        if (color) {
            rows = rows.filter(r => ($cfg.color.conv(r) === color) && issues[r]);
        }
        else {
            rows = rows.filter(r => issues[r]);
        }
        if (rows.length === 0) {
            return null;
        }
        let unlocate = {} as StringMap<true>;
        let selflink = {} as StringMap<true>;
        let negative = {} as StringMap<true>;
        for (let info of rows.map(r => issues[r])) {
            info.negative && (negative[info.negative] = true);
            info.selflink && (selflink[info.selflink] = true);
            info.unlocate && (unlocate[info.unlocate] = true);
        }
        let div = select(document.createElement('div')).att.class('war');
        div.append('div').att.class('header').text('The visualization is incomplete due to:');
        let section = (arr: string[], name: string) => {
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
        section(keys(unlocate), 'Unlocatable:');
        section(keys(selflink), 'Self-link:');
        section(keys(negative), 'Negative value:');
        return div.node<HTMLElement>();
    }
    
    highlight(rows?:StringMap<any>) {
        let flags = $cfg.selection.flags();
        this._svg.select('#color').selectAll<DistinctColor>('circle')
            .att.fill(info => {
                let { rows, color } = info;
                if (!flags) {
                    return color;
                }
                else if (rows.some(r => r in flags && !issues[r])) {
                    return color;
                }
                else {
                    return 'white';
                }
            });
    }

    height(): number {
        return +$fmt.legend.fontSize * 1.5 + 4;
    }

    private _colorWidth = 0;
    private _scaleWidth = 0;
    private _totalWidth = 0;
    resize(width: number) {
        if (this._totalWidth === width) {
            return;
        }
        this._resize(width);
    }

    private _resize(width: number) {
        this._totalWidth = width;
        this._svg.att.width(width);
        let space = width - this._colorWidth;
        let bias = space < this._scaleWidth ? this._colorWidth : width - this._scaleWidth;
        this._svg.select('#scale').att.transform(translate(bias, 0));
    }
    
    info(v: string): void {
        this._info = v;
        if (!v && $fmt.advance.relocate) {
            this._info = msgs.relocate;
        }
        this._updateDisplay();
        this._svg.select('#info').att.y(this._textY()).text(this._info);
    }

    d3(key: 'info') {
        if (key === 'info') {
            return this._svg.select('#info');
        }
    }

    private _updateDisplay(): void {
        let { color, width } = $fmt.legend;
        if (this._info) {
            width = color = false;
        }
        this._svg.select('#color').sty.display(color ? null : 'none');
        this._svg.select('#scale').sty.display(width ? null : 'none');
        this._svg.select('#info').sty.display(this._info ? null : 'none');
    }

    private _info: string;
    reformat(refontsize: boolean) {
        if (refontsize) {
            this._svg.att.height(this.height());
        }
        let legend = $fmt.legend;
        this._svg.sty.font_size(legend.fontSize + 'px');
        this._svg.sty.display(legend.show ? null : 'none');
        if (!legend.show) {
            return;
        }
        if ($fmt.advance.relocate) {
            this.info(msgs.relocate);
            return;
        }
        if (this._info) {
            this.info(this._info);
            return;
        }
        this._recolor();
        this._rewidth();
        this._resize(this._totalWidth);
        this.highlight();
    }
    
    private _recolor() {
        let root = this._svg.select('#color');
        root.sty.display($fmt.legend.color ? null : 'none');
        if (!$fmt.legend.color) {
            return;
        }
        root.selectAll('*').remove();
        if ($cfg.legend.color) {
            let distinct = $cfg.legend.color(flowRows);
            let colors = {} as StringMap<DistinctColor>;
            for (let color of keys(distinct)) {
                let label = distinct[color];
                let rows = flows.rows(r => $cfg.color.conv(r) === color); 
                colors[color] = { color, label, rows };
            }
            let pos = $fmt.legend.position === 'top' ? 'bottom' : 'top';
            let groups = root.selectAll('g').data(values(colors)).enter().append('g')
                .att.class('distinct').sty.cursor('hand')
                .on('mouseover', info => this._banner.add(info, pos as any))
                .on('click', info => $cfg.selection.click(info.rows))
                .on('mouseout', info => this._banner.clear());
            
            let r = (+$fmt.legend.fontSize) * 0.7 / 2, y = this._textY(), bias = 0;
            groups.append('circle')
                .att.cx(r + 3).att.cy(y - r).att.r(r).att.stroke_width(1)
                .att.fill(info => info.color).att.stroke(info => info.color);
            groups.append('text').att.x(2 * r + 4).att.y(y)
                .text(info => info.label)
                .att.fill(info => info.rows.some(r => !!issues[r]) ? 'red' : null);

            let centerY = pos === 'top' ? 2 : this._textY();
            groups.each(function (info, i) {
                let item = select(this);
                item.att.transform(translate(bias, 0));
                let box = item.node<SVGGElement>().getBBox();
                info.center = { x: bias + box.x + box.width / 2, y: centerY };
                bias += box.x + box.width + 10;//10 is the gap between color items
            });
            this._colorWidth = bias;
        }
        else if ($cfg.color.conv.domain) {
            let domain = $cfg.color.conv.domain;
            let range = [$fmt.color.min.solid.color, $fmt.color.max.solid.color];
            // let { domain, range } = $cfg.color.smooth;
            let conv = scaleLinear<any,any>().domain(domain).range(range);
            if (domain.some(v => util.bad(v))) {
                conv = scaleLinear<any,any>().domain([0, 1]).range(range);
                this._svg.select('#grad').selectAll<number>('stop')
                    .att.stop_color(v => conv(+v));
            }
            else {
                this._svg.select('#grad').selectAll<number>('stop')
                    .att.stop_color(v => {
                        if (v === 0)
                            return conv(domain[0]);
                        if (v === 1)
                            return conv(domain[1]);
                        else
                            return conv(domain[0] / 2 + domain[1] / 2);
                    });
            }
            let fontsize = +$fmt.legend.fontSize, height = this.height();
            let w = fontsize * 15, h = fontsize / 2;
            root.append('rect').att.width(w).att.height(h).att.x(0).att.y(height - 2 - h)
                .sty.fill('url(#grad)');
            let labels = util.nice(domain);
            root.append('text').text(labels[0])
                .att.x(0).att.y(fontsize + 1).att.text_anchor('start');
            root.append('text').text(labels[1])
                .att.x(w).att.y(fontsize + 1).att.text_anchor('end');
            let { x, width } = root.node<SVGGElement>().getBBox();
            this._colorWidth = width + 2;
            root.att.transform(translate(2, 0));
            if (flowRows.some(r => !!issues[r])) {
                root.select('rect').att.stroke('red').att.stroke_width(1)
                    .on('mouseover', () => {
                        let pos = $fmt.legend.position === 'top' ? 'bottom' : 'top';
                        let center = { x: w / 2, y: 0 };
                        center.y = pos === 'top' ? height - 4 - h : height;
                        this._banner.add({ rows: flowRows, center, color: null, label: '_all_' }, pos as any);
                    })
                    .on('mouseout', () => this._banner.clear());
            }
        }
    }

    private _rewidth() {
        let root = this._svg.select('#scale');
        root.sty.display($fmt.legend.width ? null : 'none');
        root.selectAll('*').remove();
        if (!$cfg.weight && !$cfg.width.value) {//not set
            return;
        }
        if ($cfg.legend.width) {
            let fsize = +$fmt.legend.fontSize;
            let distinct = $cfg.legend.width(flowRows), wids = keys(distinct).map(w => +w);
            let middle = this._textY() - fsize * 0.7 / 2, width = 1.5 * fsize;
            let groups = root.selectAll('g').data(wids).enter().append('g');
            groups.append('rect').att.y(w => middle - w / 2)
                .att.width(width).att.height(w => w).att.fill('#555');
            let bias = 0;
            groups.append('text').att.x(width + 2).att.y(this._textY()).text(w => distinct[w]);
            groups.each(function (key) {
                let item = select(this);
                item.att.transform(translate(bias, 0));
                bias += item.node<SVGGElement>().getBBox().width + 10;//10 is the gap
            });
            this._scaleWidth = bias;
            return;
        }
        else if ($cfg.weight) {
            let scale = $cfg.width.scale, cap = this.height() - 2;
            let v1 = scale.invert(1), vhalf = scale.invert(cap / 2), vcap = scale.invert(cap);
            let [dmin, dmax] = flows.reweight(null), linear = scaleLinear();
            v1 = Math.max(0, v1);
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
            let ticks = null as number[], fmt = null as Func<number,string>;
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
            let bars = root.selectAll('.bar').data(ticks).enter().append('g').att.class('bar');
            let barw = 0;
            bars.append('rect').sty.fill('#AAA');
            bars.append('text')
                .att.class('mark')
                .sty.text_anchor('middle')
                .att.y(this._textY())
                .text(v => fmt(v))
                .each(function () {
                    barw = Math.max((this as any).getBBox().width + 2, barw);
                });
            barw = Math.max(barw, 20);           
        
            bars.selectAll('rect')
                .att.x(0)
                .att.y(d => cap - scale(+d))
                .att.width(barw)
                .att.height(d => scale(+d));
            bars.selectAll('text')
                .att.x(barw / 2);
            bars.att.transform((d, i) => {
                return translate(i * (barw + 10), 0);//10 is the gap between bars
            })
            this._scaleWidth = (barw + 10) * ticks.length - 10;
        }
    }
}