import { IRect, IPoint, Func, StringMap } from "type";

//hint
    // this._banner = new Banner<Pie>(d3.select('#lava_banner'))
    //     .content(p => p.info())
    //     .key(p => p.addr)
    //     .origin(p => {
    //         var bubble = p.d3.node<SVGSVGElement>();
    //         // while (!bubble.getScreenCTM) {
    //         //     bubble = bubble.parentNode as SVGSVGElement;
    //         // }
    //         var zero = svg.createSVGPoint();
    //         var pnt = $con.layer.pixel(p.addr);
    //         zero.x = pnt.x;
    //         zero.y = pnt.y;
    //         pnt = zero.matrixTransform(bubble.getScreenCTM());
    //         pnt.y -= p.radius($fmt.bubble.values.size, $con.legend.scale());
    //         return pnt;
    //     })
    //     .border(() => $con.border());

//css
    // .tip {
    //     pointer-events: none;
    //     position: absolute;
    //     display: flex;
    //     .arrow {
    //         width:0px;
    //         height:0px;
    //         border-style: solid;
    //         border-width: 7px;
    //         border-color: transparent;        
    //     }
    //     .content-wrap {
    //         padding: 7px;
    //         font-size: 11px;
    //     }
    // }
    // .tip.top {
    //   flex-direction: column-reverse;
    // }
    // .tip.bottom {
    //   flex-direction: column;
    // }
    // .tip.left {
    //   flex-direction: row-reverse;
    // }
    // .tip.right {
    //   flex-direction: row;
    // }
export class Banner<T> {
    private _root = null as d3.Any;
    private _origin = null as Func<any, IPoint>;
    private _key = null as Func<any, string>;
    private _content = null as Func<any, HTMLElement>;
    private _data = {} as StringMap<{ tip: d3.Selection<any>, value: any, rect: IRect, pos: string }>;
    constructor(root: d3.Any, color = [242, 200, 17]) {
        this._root = root;
        this._rgb = color.join(', ');
    }

    private _rgb: string;
    public clear(): this {
        this._root.selectAll('.tip').remove();
        this._data = {};
        return this;
    }

    private _border = null as () => IRect;
    border(v: () => IRect): this {
        this._border = v;
        return this;
    }

    public display(v: boolean) {
        this._root.style('display', v ? null : 'none');
    }

    public anchor(conv: Func<T, IPoint>): this {
        this._origin = conv;
        return this;
    }

    public key(conv: Func<T, string>): this {
        this._key = conv;
        return this;
    }
    
    public add(v: T, pos = 'top' as 'top' | 'bottom' | 'left' | 'right') {
        var key = this._key(v);
        if (this._data[key] && this._data[key].pos === pos) {
            return;
        }
        else {
            this.remove(v);
            var tip = this._newTip(v, pos);
            var rect = this._arrange(tip, v, pos);
            this._data[key] = { tip: tip, value: v, rect: rect, pos };
            tip.datum(this._data[key]);
        }
    }

    public update(v: T) {
        var data = this._data[this._key(v)];
        if (data) {
            this.remove(v).add(v, data.pos as any);
        }
    }

    public root(): d3.Any {
        return this._root;
    }

    public flip(v: T, pos = 'top' as 'top' | 'bottom' | 'left' | 'right'): this {
        var key = this._key(v);
        this._data[key] ? this.remove(v) : this.add(v, pos);
        return this;
    }

    public contains(v: T): boolean {
        return this._key(v) in this._data;
    }

    private _arrange(tip: d3.Any, v: any, pos: string, rect?: IRect): IRect {
        var { x, y } = this._origin(v);
        if (rect) {
            var width = rect.width, height = rect.height;
        }
        else {
            var node = tip.select('.content-wrap').node<HTMLElement>();
            var width = node.offsetWidth, height = node.offsetHeight;
        }
        //7 is the magic number, the border of the arrow and the padding of the content
        if (pos === 'top' || pos === 'bottom') {
            tip.select('.arrow').style('margin-left', (width / 2 - 7) + 'px');
            y -= 7;
            tip.style('left', x - width / 2 + 'px');
            tip.style('top', (pos === 'top' ? y - height : y) + 'px');
        }
        else {
            tip.select('.arrow').style('margin-top', (height / 2 - 7) + 'px');
            x -= 7;
            tip.style('top', y - height / 2 + 'px');
            tip.style('left', (pos === 'left' ? x - width : x) + 'px');
        }
        if (this._border) {
            var border = this._border();
            if (pos === 'top' || pos === 'bottom') {
                var min = border.x, max = border.x + border.width;
                this._shift(tip, min, max, x, width, 'left');
            }
            else {
                var min = border.y, max = border.y + border.height;
                this._shift(tip, min, max, y, height, 'top');
            }
        }
        return { x: x - width / 2, y: y - 7 - height, width, height };
    }

    private _shift(tip: d3.Any, min: number, max: number, v: number, size: number, tag: string) {
        if (v - size / 2 < min) {
            if (min < v - 7) {
                var delta = v - 7 - min;
                tip.select('.arrow').style('margin-' + tag, delta + 'px');
                tip.style(tag, min + 'px');
            }
            else {
                tip.style(tag, v - 7 + 'px');
                tip.select('.arrow').style('margin-' + tag, '0px');
            }
        }
        else if (v + size / 2 > max) {
            if (max > v + 7) {
                tip.style(tag, max - size + 'px');
                var delta = size - max + v - 7;
                tip.select('.arrow').style('margin-' + tag, delta + 'px');
            }
            else {
                tip.style(tag, v + 7 - size + 'px');
                tip.select('.arrow').style('margin-' + tag, size - 14 + 'px');
            }
        }
    }

    public remove(v: T): this {
        var key = this._key(v);
        if (this._data[key]) {
            this._data[key].tip.remove();
            delete this._data[key];
        }
        return this;
    }

    public transform() {
        for (var key of Object.keys(this._data)) {
            var { tip, value, pos, rect } = this._data[key];
            this._arrange(tip, value, pos, rect);
        }
    }

    public content(conv: Func<T, HTMLElement>): this {
        this._content = conv;
        return this;
    }

    private _color(): string {
        return `rgba(${this._rgb}, ${this._opacity})`;
    }

    private _newTip(v: any, pos: string): d3.Any {
        var tip = d3.select(document.createElement('div')).classed('tip ' + pos, true);
        var color = this._color();
        var arrow = tip.append('div')
            .classed('arrow ' + pos, true)
            .style('border-' + pos + '-color', color);
        var wrap = tip.append('div')
            .classed('content-wrap', true)
            .style('background-color', color);
        var content = this._content(v);
        wrap.node().appendChild(content);
        this._root.node().appendChild(tip.node());
        return tip;
    }

    private _opacity = 1;
    public opacity(v: number): this {
        if (this._opacity === v) {
            return;
        }
        this._opacity = v;
        var color = this._color();
        this._root.selectAll('.content-wrap').style('background-color', color);
        for (var loc of ['top', 'left', 'right', 'bottom']) {
            this._root.selectAll('.arrow.' + loc)
                .style('border-' + loc + '-color', color);
        }
        return this;
    }
}