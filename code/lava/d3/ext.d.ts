/// <reference path="./index.d.ts" />

declare namespace d3 {
    
    export type Any = Selection<any>;

    export interface Selection<Datum> {
        att: Attribute<Datum>;
        sty: Style<Datum>;
        select<T>(selector: string): Selection<T>;
        selectAll<T>(selector: string): Selection<T>;
        filter(selector: (datum: Datum, index: number, outerIndex: number) => any): Selection<Datum>;
        node<T extends Node>(): T;
        attr(tag: string, val: any): Selection<Datum>;
        style(tag: string, value: any): Selection<Datum>;
    }

    namespace selection {
        interface Update<Datum> {
            att: Attribute<Datum>;
            sty: Style<Datum>;
        }
    }

    type Value<I, O> = ((d: I, inner?: number, outter?: number) => O) | O;
    type Number<I> = Value<I, number>;
    type String<I> = Value<I, string>;

    interface Attribute<D> {
        cx(v: Number<D>): d3.Selection<D>;
        cy(v: Number<D>): d3.Selection<D>;
        r(v: Number<D>): Selection<D>;
        height(v: Number<D>): Selection<D>;
        stroke(v: String<D>): Selection<D>;
        stroke_width(v: Number<D>): Selection<D>;
        stroke_opacity(v: Number<D>): Selection<D>;
        stroke_linecap(v: Value<D, 'butt' | 'square' | 'round'>): Selection<D>;
        x(v: Number<D>): Selection<D>;
        y(v: Number<D>): Selection<D>;
        d(v: String<D>): Selection<D>;
        tabIndex(v: Number<D>): Selection<D>;
        width(v: Number<D>): Selection<D>;
        transform(v: String<D>): Selection<D>;
        height(v: Number<D>): Selection<D>;
        class(value: string): Selection<D>;
        id(id: String<D>): Selection<D>;
        fill(v: String<D>): Selection<D>;
        offset(v: String<D>): Selection<D>;
        stop_color(v: String<D>): Selection<D>;
        type(v: String<D>): Selection<D>;
        text_anchor(v: Value<D, 'start' | 'middle' | 'end'>): d3.Selection<D>;
        font_size(v: Number<D>): d3.Selection<D>;
        stroke_dasharray(v: String<D>): d3.Selection<D>;
        title(v: String<D>): Selection<D>;

    }

    interface Style<D> {
        text_align(v: Value<D, 'left' | 'right' | 'center' | 'justify' | 'initial' | 'inherit'>): Selection<D>;
        text_anchor(v: Value<D, 'start' | 'middle' | 'end' | 'inherit'>): Selection<D>;
        user_select(v: Value<D, 'none' | 'auto' | 'text' | 'contain' | 'all'>): Selection<D>;
        position(v: Value<D, 'static' | 'absolute' | 'fixed' | 'relative' | 'initial' | 'inherit'>): Selection<D>;
        display(v: Value<D, 'block' | 'inline' | 'none' | 'inherit' | string>): Selection<D>;
        visibility(v: Value<D, 'hidden' | 'visible' | 'collapse' | 'initial' | 'inherit'>): Selection<D>;
        fill(v: String<D>): Selection<D>;
        fill_opacity(v: Number<D>): Selection<D>;
        cursor(v: Value<D, 'hand' | 'default' | 'pointer' | 'move'>): Selection<D>;
        top(v: String<D>): d3.Selection<D>;
        right(v: String<D>): d3.Selection<D>;
        padding(v: String<D>): d3.Selection<D>;
        padding_top(v: String<D>): d3.Selection<D>;
        padding_bottom(v: String<D>): d3.Selection<D>;
        padding_left(v: String<D>): d3.Selection<D>;
        padding_right(v: String<D>): d3.Selection<D>;
        left(v: String<D>): d3.Selection<D>;
        font_size(v: String<D>): d3.Selection<D>;
        font_weight(v: String<D>): d3.Selection<D>;
        margin_top(v: String<D>): d3.Selection<D>;
        margin_bottom(v: String<D>): d3.Selection<D>;
        margin_left(v: String<D>): d3.Selection<D>;
        margin_right(v: String<D>): d3.Selection<D>;
        width(v: String<D>): d3.Selection<D>;
        height(v: String<D>): d3.Selection<D>;
        background_color(v: String<D>): d3.Selection<D>;
        pointer_events(v: String<'none' | 'visiblePainted'>): d3.Selection<D>;
    }
}