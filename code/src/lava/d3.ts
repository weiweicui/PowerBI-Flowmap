import { select, Selection, ValueFn, BaseType } from "d3";

declare module 'd3-selection' {
    interface Selection<GElement extends BaseType, Datum, PElement extends BaseType, PDatum> {
        node<T = HTMLElement>(): T;
    }
}

type Value<I, O> = ValueFn<any, I, O> | O;
type IPoint = { x: number, y: number }

export interface ISelex<D = any> extends Selection<any, D, any, any> {
    att: Attr<D>;
    sty: Style<D>;
    datum<NewDatum>(value: ValueFn<any, D, NewDatum>): ISelex<NewDatum>;
    datum<NewDatum>(value: NewDatum): ISelex<NewDatum>;
    datum(value: null): ISelex<D>;
    datum(): D;
    selectAll(s: undefined | null): ISelex<undefined>;
    selectAll(): ISelex<undefined>;
    selectAll<T = D>(selector: string): ISelex<T>;
    select(selector: string): ISelex<D>;
    select(selector: null): ISelex<undefined>;
    select(selector: ValueFn<any, D, any>): ISelex<D>;
    enter(): ISelex<D>;
    append<K extends keyof ElementTagNameMap>(type: K): ISelex<D>;
    data<NewDatum>(data: NewDatum[]): ISelex<NewDatum>;
    data(): any;
}

class Attr<D = any> {
    private _sel: ISelex<D>;
    constructor(sel: ISelex<D>) {
        this._sel = sel;
    }

    public size(width: number | string, height: number | string): ISelex<D> {
        this.width(width);
        this.height(height);
        return this._sel;
    }
    public title(v: Value<D, string | null>): ISelex<D>;
    public title(): string
    public title(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('title', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('title');
        }
    }

    public href(v: Value<D, string | null>): ISelex<D>;
    public href(): string
    public href(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('href', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('href');
        }
    }

    public text_anchor(v: Value<D, 'start' | 'end' | 'middle' | null>): ISelex<D>;
    public text_anchor(): string
    public text_anchor(v?: Value<D, 'start' | 'end' | 'middle' | null>): any {
        if (v !== undefined) {
            this._sel.attr('text-anchor', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('text-anchor');
        }
    }

    public stroke_dasharray(v: Value<D, string | null>): ISelex<D>;
    public stroke_dasharray(): string
    stroke_dasharray(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('stroke-dasharray', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('stroke-dasharray');
        }
    }

    public font_size(v: Value<D, number | null>): ISelex<D>;
    public font_size(): number
    public font_size(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('font-size', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('font-size');
        }
    }

    public type(v: Value<D, string | null>): ISelex<D>;
    public type(): string
    public type(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('type', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('type');
        }
    }

    public stop_color(v: Value<D, string | null>): ISelex<D>;
    public stop_color(): string
    public stop_color(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('stop-color', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('stop-color');
        }
    }

    public offset(v: Value<D, string | null>): ISelex<D>;
    public offset(): string
    public offset(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('offset', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('offset');
        }
    }

    public fill(v: Value<D, string | null>): ISelex<D>;
    public fill(): string
    public fill(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('fill', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('fill');
        }
    }

    
    public class(v: Value<D, string | null>): ISelex<D>;
    public class(): string
    public class(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('class', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('class');
        }
    }

    public transform(v: Value<D, string | null>): ISelex<D>;
    public transform(): string
    public transform(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('transform', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('transform');
        }
    }

    public scale(x: number, y: number): ISelex<D>;
    public scale(p: IPoint): ISelex<D>
    public scale(factor: number): ISelex<D>
    scale(a: any, b?: number): ISelex<D> {
        if (b === undefined) {
            if (typeof a === 'number') {
                this._sel.attr('transform', `scale(${a})`);
            }
            else {
                this._sel.attr('transform', `scale(${a.x},${a.y})`);
            }
        }
        else {
            this._sel.attr('transform', `scale(${a},${b})`);
        }
        return this._sel;
    }

    public translate(p: IPoint): ISelex<D>
    public translate(l: (t: D, i: number) => IPoint): ISelex<D>;
    public translate(x: (t: D, i: number) => number, y: (t: D, i: number) => number): ISelex<D>;
    public translate(x: number, y: number): ISelex<D>;
    translate(a: any, b?: any): ISelex<D> {
        if (b === undefined) {
            if (typeof a === 'function') {
                this._sel.attr('transform', (v, i) => {
                    const p = a(v, i) as IPoint;
                    return `translate(${p.x},${p.y})`;
                });
            }
            else {
                this._sel.attr('transform', `translate(${a.x},${a.y})`);
            }
        }
        else {
            if (typeof a === 'number') {
                this._sel.attr('transform', `translate(${a},${b})`);
            }
            else {
                this._sel.attr('transform', (v,i) => `translate(${a(v, i)},${b(v, i)})`);
            }
        }
        return this._sel;
    }

    public tabIndex(v: Value<D, number | null>): ISelex<D>;
    public tabIndex(): number
    tabIndex(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('tabIndex', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('tabIndex');
        }
    }

    public d(v: Value<D, string | null>): ISelex<D>;
    public d(): string
    public d(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('d', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('d');
        }
    }

    public y2(v: Value<D, number | null>): ISelex<D>;
    public y2(): number
    public y2(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('y2', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('y2');
        }
    }

    public y1(v: Value<D, number | null>): ISelex<D>;
    public y1(): number
    public y1(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('y1', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('y1');
        }
    }

    public x2(v: Value<D, number | null>): ISelex<D>;
    public x2(): number
    public x2(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('x2', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('x2');
        }
    }

    public x1(v: Value<D, number | null>): ISelex<D>;
    public x1(): number
    public x1(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('x1', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('x1');
        }
    }

    public y(v: Value<D, number | null>): ISelex<D>;
    public y(): number
    public y(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('y', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('y');
        }
    }

    public x(v: Value<D, number | null>): ISelex<D>;
    public x(): number
    public x(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('x', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('x');
        }
    }

    public stroke_linecap(v: Value<D, 'butt' | 'square' | 'round'>): ISelex<D>;
    public stroke_linecap(): string
    public stroke_linecap(v?: Value<D, 'butt' | 'square' | 'round' | null>): any {
        if (v !== undefined) {
            this._sel.attr('stroke-linecap', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('stroke-linecap');
        }
    }

    public fill_opacity(v: Value<D, number | null>): ISelex<D>;
    public fill_opacity(): number
    public fill_opacity(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('fill-opacity', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('fill-opacity');
        }
    }

    public stroke_opacity(v: Value<D, number | null>): ISelex<D>;
    public stroke_opacity(): number
    public stroke_opacity(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('stroke-opacity', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('stroke-opacity');
        }
    }

    public stroke_width(v: Value<D, number | null>): ISelex<D>;
    public stroke_width(): number
    public stroke_width(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('stroke-width', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('stroke-width');
        }
    }

    public stroke(v: Value<D, string | null>): ISelex<D>;
    public stroke(): string
    public stroke(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('stroke', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('stroke');
        }
    }

    public width(v: Value<D, string | number | null>): ISelex<D>;
    public width(): string
    public width(v?: Value<D, string | number | null>): any {
        if (v !== undefined) {
            this._sel.attr('width', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('width');
        }
    }

    public height(v: Value<D, string | number | null>): ISelex<D>;
    public height(): string
    public height(v?: Value<D, string | number | null>): any {
        if (v !== undefined) {
            this._sel.attr('height', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('height');
        }
    }

    public r(v: Value<D, number | null>): ISelex<D>;
    public r(): number
    public r(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('r', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('r');
        }
    }

    public cy(v: Value<D, number | null>): ISelex<D>;
    public cy(): number
    public cy(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('cy', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('cy');
        }
    }

    public cx(v: Value<D, number | null>): ISelex<D>;
    public cx(): number
    public cx(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.attr('cx', v as any);
            return this._sel;
        }
        else {
            return +this._sel.attr('cx');
        }
    }

    public id(v: Value<D, string>): ISelex<D>;
    public id(): string
    public id(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.attr('id', v as any);
            return this._sel;
        }
        else {
            return this._sel.attr('id');
        }
    }
}

class Style<D = any> {
    private _sel: ISelex<D>;
    constructor(sel: ISelex<D>) {
        this._sel = sel;
    }

    public pointer_events(v: Value<D, 'none' | 'visiblePainted' | null>): ISelex<D>;
    public pointer_events(): string
    public pointer_events(v?: Value<D, 'none' | 'visiblePainted' | null>): any {
        if (v !== undefined) {
            this._sel.style('pointer-events', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('pointer-events');
        }
    }

    public background_color(v: Value<D, string | null>): ISelex<D>;
    public background_color(): string
    public background_color(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('background-color', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('background-color');
        }
    }

    public size(value: string): ISelex<D>;
    public size(width: string, height: string): ISelex<D>;
    public size(width: string, height?: string): ISelex<D> {
        this.width(width);
        this.height(height || width);
        return this._sel;
    }

    public height(v: Value<D, string | null>): ISelex<D>;
    public height(): string
    public height(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('height', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('height');
        }
    }

    public width(v: Value<D, string | null>): ISelex<D>;
    public width(): string
    public width(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('width', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('width');
        }
    }

    public top(v: Value<D, string | null>): ISelex<D>;
    public top(): string
    public top(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('top', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('top');
        }
    }


    public margin_right(v: Value<D, string | null>): ISelex<D>;
    public margin_right(): string
    public margin_right(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('margin-right', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('margin-right');
        }
    }

    public margin_left(v: Value<D, string | null>): ISelex<D>;
    public margin_left(): string
    public margin_left(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('margin-left', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('margin-left');
        }
    }

    public margin_bottom(v: Value<D, string | null>): ISelex<D>;
    public margin_bottom(): string
    public margin_bottom(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('margin-bottom', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('margin-bottom');
        }
    }

    public margin_top(v: Value<D, string | null>): ISelex<D>;
    public margin_top(): string
    public margin_top(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('margin-top', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('margin-top');
        }
    }

    public margin(v: Value<D, string | null>): ISelex<D>;
    public margin(): string
    public margin(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('margin', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('margin');
        }
    }



    public padding_right(v: Value<D, string | null>): ISelex<D>;
    public padding_right(): string
    public padding_right(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('padding-right', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('padding-right');
        }
    }

    public padding_left(v: Value<D, string | null>): ISelex<D>;
    public padding_left(): string
    public padding_left(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('padding-left', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('padding-left');
        }
    }

    public padding_bottom(v: Value<D, string | null>): ISelex<D>;
    public padding_bottom(): string
    public padding_bottom(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('padding-bottom', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('padding-bottom');
        }
    }

    public padding_top(v: Value<D, string | null>): ISelex<D>;
    public padding_top(): string
    public padding_top(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('padding-top', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('padding-top');
        }
    }

    public padding(v: Value<D, string | null>): ISelex<D>;
    public padding(): string
    public padding(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('padding', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('padding');
        }
    }

    public font_weight(v: Value<D, string | null>): ISelex<D>;
    public font_weight(): string
    public font_weight(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('font-weight', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('font-weight');
        }
    }

    public font_size(v: Value<D, string | null>): ISelex<D>;
    public font_size(): string
    public font_size(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('font-size', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('font-size');
        }
    }

    public left(v: Value<D, string | null>): ISelex<D>;
    public left(): string
    public left(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('left', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('left');
        }
    }

    public right(v: Value<D, string | null>): ISelex<D>;
    public right(): string
    public right(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('right', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('right');
        }
    }

    public cursor(v: Value<D, 'hand' | 'default' | 'pointer' | 'move' | null>): ISelex<D>;
    public cursor(): string
    public cursor(v?: Value<D, 'hand' | 'default' | 'pointer' | 'move' | null>): any {
        if (v !== undefined) {
            this._sel.style('cursor', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('cursor');
        }
    }

    public fill_opacity(v: Value<D, number | null>): ISelex<D>;
    public fill_opacity(): string
    public fill_opacity(v?: Value<D, number | null>): any {
        if (v !== undefined) {
            this._sel.style('fill-opacity', v as any);
            return this._sel;
        }
        else {
            return +this._sel.style('fill-opacity');
        }
    }

    public fill(v: Value<D, string | null>): ISelex<D>;
    public fill(): string
    public fill(v?: Value<D, string | null>): any {
        if (v !== undefined) {
            this._sel.style('fill', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('fill');
        }
    }

    public visibility(v: Value<D, 'hidden' | 'visible' | 'collapse' | 'initial' | 'inherit' | null>): ISelex<D>;
    public visibility(): string
    public visibility(v?: Value<D, 'hidden' | 'visible' | 'collapse' | 'initial' | 'inherit' | null>): any {
        if (v !== undefined) {
            this._sel.style('visibility', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('visibility');
        }
    }

    public display(v: Value<D, 'block' | 'inline' | 'none' | 'inherit' | null>): ISelex<D>;
    public display(): string
    public display(v?: Value<D, 'block' | 'inline' | 'none' | 'inherit' | null>): any {
        if (v !== undefined) {
            this._sel.style('display', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('display');
        }
    }

    public position(v: Value<D, 'static' | 'absolute' | 'fixed' | 'relative' | 'initial' | 'inherit' | null>): ISelex<D>;
    public position(): string
    public position(v?: Value<D, 'static' | 'absolute' | 'fixed' | 'relative' | 'initial' | 'inherit' | null>): any {
        if (v !== undefined) {
            this._sel.style('position', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('position');
        }
    }

    public user_select(v: Value<D, 'none' | 'auto' | 'text' | 'contain' | 'all' | null>): ISelex<D>;
    public user_select(): string
    public user_select(v?: Value<D, 'none' | 'auto' | 'text' | 'contain' | 'all' | null>): any {
        if (v !== undefined) {
            this._sel.style('user-select', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('user-select');
        }
    }

    public text_anchor(v: Value<D, 'start' | 'middle' | 'end' | 'inherit' | null>): ISelex<D>;
    public text_anchor(): string
    public text_anchor(v?: Value<D, 'start' | 'middle' | 'end' | 'inherit' | null>): any {
        if (v !== undefined) {
            this._sel.style('text-anchor', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('text-anchor');
        }
    }

    public text_align(v: Value<D, 'left' | 'right' | 'center' | 'justify' | 'initial' | 'inherit' | null>): ISelex<D>;
    public text_align(): string
    public text_align(v?: Value<D, 'left' | 'right' | 'center' | 'justify' | 'initial' | 'inherit' | null>): any {
        if (v !== undefined) {
            this._sel.style('text-align', v as any);
            return this._sel;
        }
        else {
            return this._sel.style('text-align');
        }
    }
}


export function selex<D = any>(selector: BaseType | string): ISelex<D> {
    return wrap(select(selector as any));
}

function wrap<D>(obj: any) {
    const result = Object.create(obj) as ISelex<D>;
    result.att = new Attr<D>(result);
    result.sty = new Style<D>(result);
    const select = result.select.bind(result);
    result.select = _ => wrap(select(_)) as any;
    const append = result.append.bind(result);
    result.append = (_, v?: any) => {
        if (v === undefined) {
            return wrap(append(_));
        }
        else {
            return wrap(append(_).datum(v));
        }
    };
    const selectAll = result.selectAll.bind(result);
    result.selectAll = (v?: any) => wrap(selectAll(v)) as any;
    const enter = result.enter.bind(result);
    result.enter = () => wrap(enter());
    const data = result.data.bind(result);
    result.data = (_?: any) => wrap(data(_));
    return result;
}