import { visualObjects as numberObjects, build as numberFormat } from 'numberFormat';
import { tooltip } from 'tooltip';
import { host, Persist } from "host";
import { StringMap, clamp, copy, dict, keys, values, Func, groupBy, obj, find } from "type";
import { ILocation } from "bing";
import { Grand, Category } from "data";
import { coords, dirty, isResizeMode } from 'misc';
import { extent } from 'array';

import { Format } from 'bing/flowmap/format';
import { util } from 'bing/flowmap/misc';
import { $mapctl, init, $cfg, $fmt, flowRows, reset, reformat } from 'bing/flowmap/app';

type Role = 'Origin' | 'Dest' | 'Width' | 'Color' | 'OLati' | 'OLong' | 'DLati' | 'DLong' | 'OName' | 'DName' | 'Tooltip' | 'Label';

class helper {
    public static line(role: Role): Func<number, string> {
        var conv = numberFormat(ctx.fmt.valueFormat.meta);
        if (ctx.roles.exist(role)) {
            let vals = ctx.roles.columns(role).map(c => c.values);
            return r => {
                let arr = [] as any[];
                for (var col of vals) {
                    var v = col[r];
                    arr.push(typeof v === 'number' ? conv(v) : v);
                }
                return arr.join(', ');
            }
        }
        else {
            return null;
        }
    }

    public static pathTip(rows: number[]): powerbi.extensibility.VisualTooltipDataItem[] {
        let src = ctx.exist('OName') ? ctx.key('OName') : ctx.key('Origin');
        let tar = ctx.exist('DName') ? ctx.key('DName') : ctx.key('Dest');
        if (!ctx.exist('Tooltip')) {
            if (ctx.fmt.style.meta.direction === 'out') {
                return [
                    { displayName: 'Origin', value: src(rows[0]) },
                    { displayName: 'Destination', value: rows.map(r => tar(r)).join(', ') }
                ];
            }
            else {
                return [
                    { displayName: 'Destination', value: tar(rows[0]) },
                    { displayName: 'Origin', value: rows.map(r => tar(r)).join(', ') }
                ];
            }
        }
        let conv = numberFormat(ctx.fmt.valueFormat.meta);
        let columns = ctx.roles.columns('Tooltip');
        let line = helper.line('Tooltip');
        if (rows.length === 1) {
            let row = rows[0];
            return columns.map(c => {
                let value = c.source.type.numeric ? conv(+c.values[row]) : c.values[row] + '';
                return {
                    displayName: c.source.displayName,
                    value: value,
                    header: src(row) + ' ⇨ ' + tar(row)
                }
            });
        }
        else {
            let header = '(From) ' + src(rows[0]), lead = tar;
            if (ctx.fmt.style.meta.direction !== 'out') {
                header = '(To) ' + tar(rows[0]), lead = src;
            }
            let tops = util.top(rows);
            let result = tops.map(row => {
                return {
                    displayName: lead(row),
                    value: line(row),
                    header: header
                }
            });
            if (tops.length < rows.length) {
                result.push({
                    header: header,
                    displayName: '...',
                    value: `(${rows.length - tops.length} more)`
                });
            }
            return result;
        }
    }

    public static pieTip(rows: number[], type: 'in' | 'out'): powerbi.extensibility.VisualTooltipDataItem[] {
        let src = ctx.exist('OName') ? ctx.key('OName') : ctx.key('Origin');
        let tar = ctx.exist('DName') ? ctx.key('DName') : ctx.key('Dest');
        if (!ctx.exist('Tooltip')) {
            if (type === 'out') {
                return [{ displayName: '', value: src(rows[0]) }];
            }
            else {
                return [{ displayName: '', value: tar(rows[0]) }];
            }
        }
        else {
            let conv = numberFormat(ctx.fmt.valueFormat.meta);
            let columns = ctx.roles.columns('Tooltip');
            let line = helper.line('Tooltip');
            if (rows.length === 1) {
                let row = rows[0];
                return columns.map(c => {
                    let value = c.source.type.numeric ? conv(+c.values[row]) : c.values[row] + '';
                    return {
                        displayName: c.source.displayName,
                        value: value,
                        header: type === 'out' ? '(From) ' + src(row) : '(To) ' + tar(row)
                    }
                });
            }
            else {
                let header = '(From) ' + src(rows[0]), lead = tar;
                if (type !== 'out') {
                    header = '(To) ' + tar(rows[0]), lead = src;
                }
                let tops = util.top(rows);
                let result = tops.map(r => <any>{
                    displayName: lead(r),
                    value: line(r),
                    header: header
                });
                if (tops.length < rows.length) {
                    result.push({
                        displayName: '...',
                        value: `(${rows.length - tops.length} more)`,
                        header: header
                    });
                }
                return result;
            }
        }
    }

    // public static autoColor = false;
    public static colorLegend(rows: number[]): StringMap<string> {
        let cat = ctx.cat('Color'), color = ctx.fmt.color.meta;
        if (!cat.column || !color.customize) {
            let label = ctx.fmt.legend.meta.color_label;
            return label ? obj(color.fill.solid.color, label) : {};
        }
        else if (cat.column.source.type.numeric) {
            return {};
        }
        else {
            let fill = $cfg.color.conv;
            let label = ctx.fmt.legend.property('color_label');
            let groups = groupBy(cat.distincts(rows), r => fill(r));
            let legend = {} as StringMap<string>;
            let autofill = ctx.fmt.legend.meta.color_default;
            for (let key in groups) {
                let row = find(groups[key], r => {
                    let v = label(+r);
                    return v !== null && v !== undefined;
                });
                if (row !== undefined) {
                    let v = label(+row);
                    v && (legend[key] = v);
                }
                else if (autofill) {
                    let id = cat.key, rows = groups[key];
                    legend[key] = groups[key].map(r => id(+r)).join(', ');
                }
            }
            return legend;
        }
    }

    public static widthLegend(rows: number[]) {
        if (!ctx.exist('Width') || ctx.column('Width').source.type.numeric) {
            return {};
        }
        let width = ctx.fmt.width.property('item');
        let label = ctx.fmt.legend.property('width_label');
        let groups = groupBy(ctx.cat('Width').distincts(rows), width);
        let legend = {} as StringMap<string>, cat = ctx.cat('Width');
        let autofill = ctx.fmt.legend.meta.width_default;
        for (let key in groups) {
            let row = find(groups[key], r => {
                let v = label(+r);
                return v !== null && v !== undefined;
            });
            if (row !== undefined) {
                let v = label(+row);
                v && (legend[key] = v);
            }
            else if (autofill) {
                let id = cat.key, rows = groups[key];
                legend[key] = groups[key].map(r => id(+r)).join(', ');
            }
        }
        return legend;
    }
}

class Context extends Grand<Role, Format> {
    constructor() {
        super(new Format(), ['Origin', 'Dest']);
        this.roles.silence('Tooltip');
        this.selection.highlight(() => $cfg.selection.highlight());

        this.require(['Origin', 'Dest'], ['Origin', 'Destination']);
        this.fmt.width.bind<Role>('Width', 'item', 'customize');
        this.fmt.color.bind<Role>('Color', 'fill', 'customize');
        this.fmt.legend.bind<Role>('Width', 'width_label', 'width');
        this.fmt.legend.bind<Role>('Color', 'color_label', 'color');

        $cfg.selection.flags = () => this.selection.flags();
        $cfg.selection.click = rows => this.selection.click(rows);

        $cfg.flow.onPathChanged = sel => {
            tooltip.add(sel, arg => helper.pathTip(arg.data.leafs as number[]));
        };
        $cfg.bubble.onPieChanged = sel => { 
            tooltip.add(sel, arg => helper.pieTip(arg.data.rows, arg.data.type));
        };

        $cfg.location.done = () => {
            if (this.fmt.advance.meta.cache) {
                let code = {} as StringMap<ILocation>;
                let locs = $cfg.location.geocode;
                for (let key in locs) {
                    let { longitude, latitude } = locs[key];
                    code[key] = { longitude, latitude };
                }
                persist.geocode.write(code, 0);
            }
        };
    }

    update(view: powerbi.DataView) {
        let initing = !!this.issue();
        super.update(view);
        initing = initing || this.dirty('content');
        $cfg.label.line = helper.line('Label');
        $cfg.source = this.key('Origin');
        $cfg.target = this.key('Dest');
        $cfg.label.source = this.exist('OName') ? this.key('OName') : $cfg.source;
        $cfg.label.target = this.exist('DName') ? this.key('DName') : $cfg.target;

        if (this.fmt.style.meta.direction === 'in') {
            [$cfg.source, $cfg.target] = [$cfg.target, $cfg.source];
            [$cfg.label.source, $cfg.label.target] = [$cfg.label.target, $cfg.label.source];
            $cfg.group = this.key('Dest', 'Color');
        }
        else {
            $cfg.group = this.key('Origin', 'Color');
        }

        let colorCat = this.cat('Color'), color = this.fmt.color.meta;
        $cfg.legend.color = $cfg.legend.width = null;
        if (!colorCat.column || !color.customize) {
            let dft = color.fill.solid.color;
            $cfg.legend.color = helper.colorLegend;
            $cfg.color = { conv: r => dft };
        }
        else if (colorCat.column.source.type.numeric) {
            let vals = colorCat.column.values;
            $cfg.color = { value: r => +vals[r], conv: $cfg.color.conv };
        }
        else {
            $cfg.legend.color = helper.colorLegend;
            if (this.fmt.color.meta.autofill) {
                let prop = this.fmt.color.property('fill', null);
                let pale = host.visualhost.colorPalette, key = colorCat.key;
                $cfg.color = {
                    conv: r => {
                        let fill = prop(+r);
                        return fill ? fill.solid.color : pale.getColor(key(r)).value;
                    }
                }
            }
            else {
                let fill = this.fmt.color.property('fill');
                $cfg.color = { conv: r => fill(r).solid.color };
            }
        }

        if (this.exist('Width')) {
            if (this.column('Width').source.type.numeric) {
                let values = this.column('Width').values;
                $cfg.weight = r => +values[r];
                $cfg.width = { scale: $cfg.width.scale };
            }
            else {
                $cfg.legend.width = helper.widthLegend;
                let widthOf = this.fmt.width.property('item');
                $cfg.weight = null;
                $cfg.width = { value: widthOf, scale: $cfg.width.scale };
            }
        }
        else {
            $cfg.weight = null;
            $cfg.width = { scale: $cfg.width.scale };
        }
        
        if (this.issue()) {
            reset(this.delta(), this.issue());
            return;
        }

        let injections = this._injections(initing);
        if (injections) {
            $cfg.location.injection = injections;
        }

        if (!initing && this.roles.dirty('Origin', 'Dest', 'Width', 'Color')) {
            initing = true;
        }
        else if (this.dirty('count') || this.dirty('content')) {
            initing = true;
        }

        if (initing) {
            reset(this.delta(), this.items.rows());
        }
        else {
            reformat(this.delta());
        }

        if (this.selection.dirty) {
            $cfg.selection.highlight();
        }
    }

    private _injections(initing: boolean): StringMap<ILocation> {
        let origin = coords(this, this.key('Origin'), 'OLati', 'OLong', initing);
        let destin = coords(this, this.key('Dest'), 'DLati', 'DLong', initing);
        if (origin || destin) {
            return copy(origin || {}, destin || {});
        }
        else {
            return null;
        }
    }

    issue(view?: powerbi.DataView): string {
        view = view || this._view;
        let msg = super.issue(view);
        if (msg || !view.metadata || !view.metadata.objects) {
            return msg;
        }
        let color = this.column('Color', view);
        if (!color || !color.source.type.numeric) {
            return msg;
        }
        let meta = view.metadata.objects as any as Format;
        if (meta.style && meta.style.type && meta.style.type === 'flow') {
            return 'Flow style cannot be used with a numeric "Color" field.';
        }
        return msg;
    }
}

let persist = {
    map    : new Persist<[Microsoft.Maps.Location, number]>('persist', 'map'),
    geocode: new Persist<StringMap<ILocation>>('persist', 'geocoding'),
    manual : new Persist<StringMap<ILocation>>('persist', 'manual'),
    banner : new Persist<string[]>('persist', 'banner')
}

let ctx = new Context();
export class Visual implements powerbi.extensibility.visual.IVisual {
    private _div: HTMLDivElement;
    private _loading = false;
    private _options = null as powerbi.extensibility.visual.VisualUpdateOptions;
    constructor(options: powerbi.extensibility.visual.VisualConstructorOptions) {
        host.init(options.host);
        tooltip.init(options);
        this._div = options.element as HTMLDivElement;
    }
    
    update<T>(options: powerbi.extensibility.visual.VisualUpdateOptions, viewModel?: T): void {
        if (this._loading) {
            this._options = options;
            return;
        }
        let view = options.dataViews[0] || {} as powerbi.DataView;
        if (!$mapctl) {
            this._options = options;
            this._loading = true;
            ctx.init(view, 'mapControl', 'mapElement');
            $cfg.location.geocode = persist.geocode.read(view, {});
            $cfg.location.manual = persist.manual.read(view, {});
            $cfg.mark.onChanged = keys => persist.banner.write(keys.sort(), 10);
            $cfg.mark.init && $cfg.mark.init(persist.banner.read(view, {}));
            let fmt = new Format();
            copy(ctx.fmt.mapControl.meta, fmt.mapControl);
            copy(ctx.fmt.mapElement.meta, fmt.mapElement);
            init(this._div, fmt, map => {
                this._loading = false;//set to false befor calling update(...)
                let view = this._options.dataViews[0];
                let [center, zoom] = persist.map.read(view, []);
                center && map.setView({ center, zoom });
                this.update(this._options);
            });
            $mapctl.add({
                transform(m, p, e) { e && persist.map.write([m.getCenter(), m.getZoom()], 400); }
            });
            return;
        }

        if (ctx.isPersistingCache(view)) {
            console.log('return by new persist');
            return;
        }
        if (isResizeMode(options.type)) {
            return;
        }
        //////////////////////////////////////////////
        ctx.update(view);

        if (ctx.fmt.advance.flip('cache') === 'off') {
            persist.geocode.write({}, 0);
            persist.manual.write({}, 0);
        }
        if (ctx.fmt.advance.flip('relocate') === 'on') {
            persist.manual.write($cfg.location.manual || {}, 10);
        }
        console.log('update done');
    }

    enumerateObjectInstances(options: powerbi.EnumerateVisualObjectInstancesOptions): powerbi.VisualObjectInstanceEnumeration {
        let oname = options.objectName;
        if (ctx.fmt.advance.meta.relocate) {
            if (oname !== 'advance') {
                return [];
            }
            return ctx.inser(oname).meta(['relocate', 'located', 'unlocated']).dump();
        }
        switch (oname) {
            case 'legend':
                let legend = ctx.inser(oname).meta(['show', 'position', 'fontSize']);
                if ($fmt.color.customize && ctx.exist('Color')) {
                    legend.meta(['color']);
                    if (!ctx.column('Color').source.type.numeric && $fmt.legend.color) {
                        legend.meta(['color_default']);
                        legend.items('color_label', flowRows, $cfg.color.conv, $fmt.legend.color_default);
                    }
                }
                else {
                    legend.meta('color', ['color_label']);
                }
                if ($cfg.weight || $cfg.width.value) {
                    legend.meta(['width']);
                    if ($cfg.width.value && $fmt.legend.width) {
                        legend.meta(['width_default']);
                        legend.items('width_label', flowRows, ctx.fmt.width.property('item'), $fmt.legend.width_default);
                    }
                }
                return legend.dump();
            case 'style':
                return ctx.inser(oname, $fmt.style).meta(['type'])
                    .meta($fmt.style.type === 'flow', ['direction', 'limit']).dump();
            case 'color':
                let color = ctx.inser('color').meta(['fill']);
                if (ctx.exist('Color')) {
                    let key = ctx.cat('Color').key;
                    color.meta(['customize']);
                    if ($fmt.color.customize) {
                        if (ctx.column('Color').source.type.numeric) {
                            color.meta(['min', 'max']);
                        }
                        else {
                            color.meta(['autofill']);
                            if ($fmt.color.autofill) {
                                let pal = host.visualhost.colorPalette;
                                color.items('fill', flowRows, null, r => pal.getColor(key(r)).value);
                            }
                            else {
                                color.items('fill', flowRows);
                            }
                        }
                    }
                }
                return color.dump();
            case 'width':
                let width = ctx.inser('width', $fmt.width);
                if (!ctx.exist('Width') && $fmt.style.type !== 'flow') {
                    return width.meta(['item']).dump();
                }
                if ($cfg.width.value) {//has column and is distinct
                    let rows = ctx.cat('Width').distincts(flowRows);
                    return width.meta(['item']).custom('item', rows).dump();
                }
                else {
                    width.meta(['scale']);
                    if (ctx.fmt.width.meta.scale !== 'none') {
                        width.meta(['min', 'max']);
                    }
                    else {
                        width.meta(['unit']);
                    }
                }
                return width.dump();
            case 'valueFormat':
                return ctx.inser(oname).meta(['sort', 'top'])
                    .add(numberObjects(ctx.fmt.valueFormat.meta, oname)).dump();
            case 'advance':
                return ctx.inser(oname).meta(['cache', 'relocate']).dump();
            case 'bubble':
                let fmt = $fmt.bubble;
                let bubble = ctx.inser(oname, $fmt.bubble).meta(['for']);
                if (fmt.for !== 'none') {
                    bubble.meta(['scale', 'slice']);
                    !fmt.slice && bubble.meta(['bubbleColor']);
                    bubble.meta(['label']);
                    if (fmt.label !== 'hide' && fmt.label !== 'none') {
                        let both = fmt.for === 'both';
                        bubble.meta(['labelOpacity'])
                            .meta(both || fmt.for === 'dest', ['destinColor'])
                            .meta(both || fmt.for === 'origin', ['originColor']);
                    }
                }    
                return bubble.dump();
            case 'mapControl':
            case 'mapElement':
                return ctx.inser(oname).dump();
        }
        return [];
    }
}