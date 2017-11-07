import { select } from 'd3-selection';


declare module 'd3-selection' {
    type Any<T = any> = Selection<any, T, any, any>;
    type Value<I, O> = ((d: I, inner?: number, outter?: number) => O) | O;
    type Number<I> = Value<I, number>;
    type String<I> = Value<I, string>;
    interface Attribute<GElement extends BaseType, D, PElement extends BaseType, PDatum> {
        cx(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        cy(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        r(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        height(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        stroke(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        stroke_width(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        stroke_opacity(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        stroke_linecap(v: Value<D, 'butt' | 'square' | 'round'>): Selection<GElement, D, PElement, PDatum>;
        x(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        x1(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        x2(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        y(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        y1(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        y2(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        d(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        tabIndex(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        width(v: Value<D, any>): Selection<GElement, D, PElement, PDatum>;
        transform(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        height(v: Value<D, any>): Selection<GElement, D, PElement, PDatum>;
        class(value: string): Selection<GElement, D, PElement, PDatum>;
        id(id: String<D>): Selection<GElement, D, PElement, PDatum>;
        fill(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        offset(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        stop_color(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        type(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        text_anchor(v: Value<D, 'start' | 'middle' | 'end'>): Selection<GElement, D, PElement, PDatum>;
        font_size(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        stroke_dasharray(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        title(v: String<D>): Selection<GElement, D, PElement, PDatum>;
    
    }
    
    interface Style<GElement extends BaseType, D, PElement extends BaseType, PDatum> {
        text_align(v: Value<D, 'left' | 'right' | 'center' | 'justify' | 'initial' | 'inherit'>): Selection<GElement, D, PElement, PDatum>;
        text_anchor(v: Value<D, 'start' | 'middle' | 'end' | 'inherit'>): Selection<GElement, D, PElement, PDatum>;
        user_select(v: Value<D, 'none' | 'auto' | 'text' | 'contain' | 'all'>): Selection<GElement, D, PElement, PDatum>;
        position(v: Value<D, 'static' | 'absolute' | 'fixed' | 'relative' | 'initial' | 'inherit'>): Selection<GElement, D, PElement, PDatum>;
        display(v: Value<D, 'block' | 'inline' | 'none' | 'inherit' | string>): Selection<GElement, D, PElement, PDatum>;
        visibility(v: Value<D, 'hidden' | 'visible' | 'collapse' | 'initial' | 'inherit'>): Selection<GElement, D, PElement, PDatum>;
        fill(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        fill_opacity(v: Number<D>): Selection<GElement, D, PElement, PDatum>;
        cursor(v: Value<D, 'hand' | 'default' | 'pointer' | 'move'>): Selection<GElement, D, PElement, PDatum>;
        top(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        right(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        padding(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        padding_top(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        padding_bottom(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        padding_left(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        padding_right(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        left(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        font_size(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        font_weight(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        margin_top(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        margin_bottom(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        margin_left(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        margin_right(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        width(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        height(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        background_color(v: String<D>): Selection<GElement, D, PElement, PDatum>;
        pointer_events(v: String<'none' | 'visiblePainted'>): Selection<GElement, D, PElement, PDatum>;
    }

    interface Selection<GElement extends BaseType, Datum, PElement extends BaseType, PDatum> {
        att: Attribute<GElement, Datum, PElement, PDatum>;
        sty: Style<GElement, Datum, PElement, PDatum>;
        node<T = HTMLElement>(): T;
        selectAll<T>(sel: string): Selection<GElement, T, PElement, PDatum>;
    }    
}