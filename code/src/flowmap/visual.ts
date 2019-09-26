import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import { Format } from "./format";
import { Persist } from "../pbi/Persist";
import { Context } from '../pbi/Context';
import { override, groupBy, StringMap, first, Func, pick, partial, copy, values, sort } from '../lava/type';
import { selex } from "../lava/d3";
import { tooltip } from '../pbi/tooltip';
import { MapFormat } from "../lava/bingmap/controller";
import { ILocation } from "../lava/bingmap/converter";
import * as app from '../lava/bingmap/flowmap/app';
import * as flows from '../lava/bingmap/flowmap/flow';
import * as pins from '../lava/bingmap/flowmap/pin';
import * as pies from '../lava/bingmap/flowmap/pie';
import * as popups from '../lava/bingmap/flowmap/popup';
import { Config } from '../lava/bingmap/flowmap/config';
import { visualObjects as numberObjects, build as numberFormat } from '../pbi/numberFormat';

import { coords } from '../pbi/misc';
import { keys, sum } from "d3";
import * as deepmerge from 'deepmerge';

type Role = 'Origin' | 'Dest' | 'width' | 'color' | 'OLati' | 'OLong' | 'DLati' | 'DLong' | 'OName' | 'DName' | 'Tooltip' | 'Label';

const LEGEND = {
    color: { role: 'color', default: 'color_default', label: 'color_label' } as const,
    width: { role: 'width', default: 'width_default', label: 'width_label' } as const
} as const;

const persist = {
    map: new Persist<[Microsoft.Maps.Location, number]>('persist', 'map'),
    geocode: new Persist<StringMap<ILocation>>('persist', 'geocoding'),
    manual: new Persist<StringMap<ILocation>>('persist', 'manual'),
    banner: new Persist<string[]>('persist', 'banner')
} as const;

class helper {
    public static pieTooltip(rows: number[], type: 'in' | 'out', ctx: Context<Role, Format>): VisualTooltipDataItem[] {
        let src = ctx.cat('OName') ? ctx.key('OName') : ctx.key('Origin');
        let tar = ctx.cat('DName') ? ctx.key('DName') : ctx.key('Dest');
        if (!ctx.cat('Tooltip')) {
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
            let line = helper.description('Tooltip', ctx);
            if (rows.length === 1) {
                let row = rows[0];
                return columns.map(c => {
                    let value = c.source.type.numeric ? conv(+c.values[row]) : c.values[row] + '';
                    return {
                        displayName: c.source.displayName,
                        value: value,
                        header: type === 'out' ? src(row) : tar(row)
                    }
                });
            }
            else {
                let header = src(rows[0]), lead = tar;
                if (type !== 'out') {
                    header = tar(rows[0]), lead = src;
                }
                let tops = helper.top(ctx, rows);
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
    
    public static description(role: Role, ctx: Context<Role, Format>): Func<number, string> {
        const conv = numberFormat(ctx.fmt.valueFormat.meta);
        if (ctx.roles.exist(role)) {
            const vals = ctx.roles.columns(role).map(c => c.values);
            return r => {
                const arr = [] as any[];
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

    public static top(ctx: Context<Role, Format>, rows: number[]) {
        const { sort, top } = ctx.fmt.valueFormat.meta;
        const score = app.$state.config.weight.conv;
        if (score) {
            if (sort === 'des') {
                rows.sort((a, b) => score(b) - score(a));
            }
            else {
                rows.sort((a, b) => score(a) - score(b));
            }
        }
        return +top >= rows.length ? rows : rows.slice(0, +top);
    }

    public static pathTooltip(ctx: Context<Role, Format>, rows: number[]): VisualTooltipDataItem[] {
        let src = ctx.cat('OName') ? ctx.key('OName') : ctx.key('Origin');
        let tar = ctx.cat('DName') ? ctx.key('DName') : ctx.key('Dest');
        if (!ctx.cat('Tooltip')) {
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
        let line = helper.description('Tooltip', ctx);
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
            let tops = helper.top(ctx, rows);
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
}

export class Visual implements IVisual {
    private _target: HTMLElement;
    private _ctx = null as Context<Role, Format>;
    private _cfg = null as Config;
    constructor(options: VisualConstructorOptions) {
        this._target = options.element;
        tooltip.init(options);
        const ctx = this._ctx = new Context(options.host, new Format());
        ctx.fmt.width.bind('width', "item", "customize");
        ctx.fmt.color.bind("color", "item", 'customize');

        ctx.fmt.legend.bind('width', 'width_label', 'width');
        ctx.fmt.legend.bind('color', 'color_label', 'color');
        flows.events.pathInited = group => {
            tooltip.add(group, arg => helper.pathTooltip(this._ctx, arg.data.leafs as number[]));
        };

        app.events.doneGeocoding = locs => {
            copy(locs, persist.geocode.value());
            if (this._ctx.fmt.advance.meta.cache) {
                persist.geocode.write(persist.geocode.value(), 10);
            }
        }

        popups.events.onChanged = addrs => persist.banner.write(addrs, 10);
        pins.events.onDrag = (addr, loc) => {
            this._cfg.injections[addr] = loc;
            persist.manual.value()[addr] = loc;
        };
        pies.events.onPieCreated = group => {
            tooltip.add(group, arg => helper.pieTooltip(arg.data.rows, arg.data.type, this._ctx));
        };
        selex(this._target).sty.cursor('default');
    }

    private _legendItems(role: 'color' | 'width'): StringMap<string> {
        const ctx = this._ctx, legend = ctx.config('legend');
        if (!legend[role]) {
            return {};//hide
        }
        const cat = ctx.cat(role), defaultLabel = LEGEND[role].label;
        const autofill = legend[LEGEND[role].default];
        if (!cat || !ctx.fmt[role].meta.customize) {
            const key = role === 'color' ? ctx.fmt.color.value('item') : ctx.fmt.width.value('item');
            const txt = (legend[defaultLabel] || '').trim();
            return txt ? { [key]: txt } : {};
        }
        else {
            if (cat.column.source.type.numeric) {
                return null;//smooth legend
            }
            //has cat && customized
            let prop = role === 'color' ? ctx.fmt.color.property('item') : ctx.fmt.width.property('item');
            if (role === 'color' && ctx.fmt.color.meta.autofill) {
                prop = ctx.fmt.color.property('item', k => ctx.host.colorPalette.getColor(k).value);
            }
            
            const id = this._ctx.cat(role).key;
            const customLabels = this._ctx.fmt.legend.special(defaultLabel);
            const result = {} as StringMap<string>;
            const groups = groupBy(cat.distincts(), prop);
            for (const key in groups) {
                const row = first(groups[key], r => id(r) in customLabels);
                if (row !== undefined) {
                    result[key] = customLabels[id(row)] as string;
                }
                else if (autofill) {
                    result[key] = groups[key].map(r => id(r)).join(', ');
                }
            }
            return result;
        }
    }

    private config(): Config {
        const config = new Config(), ctx = this._ctx;
        // ctx.cat('Dest').data[2] = ctx.cat('Origin').data[2];
        /* #region  legend */
        override(ctx.fmt.legend.meta, config.legend);
        if (config.legend.show) {
            config.legend.colorLabels = this._legendItems('color');
            config.legend.widthLabels = this._legendItems('width');
        }
        else {
            config.legend.colorLabels = config.legend.widthLabels = {};
        }
        /* #endregion */
        
        /* #region  numberSorter, numberFormat */
        override(ctx.fmt.valueFormat.meta, config.numberSorter);
        override(ctx.fmt.valueFormat.meta, config.numberFormat);
        /* #endregion */

        /* #region  source, target, label */
        config.source = ctx.key('Origin');
        config.target = ctx.key('Dest');
        config.popup = {
            description: helper.description('Label', ctx),
            origin: ctx.cat('OName') ? ctx.key('OName') : config.source,
            destination: ctx.cat('DName') ? ctx.key('DName') : config.target
        };

        let sourceRole = 'Origin' as Role;
        let groups = null as number[][];

        //swith source/target
        if (ctx.fmt.style.meta.direction === 'in') {
            [config.source, config.target] = [config.target, config.source];
            sourceRole = 'Dest';
        }
        /* #endregion */

        /* #region  color */
        if (!ctx.cat('color') || !ctx.fmt.color.meta.customize) {
            const color = ctx.fmt.color.value('item');
            config.color = _ => color;
        }
        else if (ctx.cat('color').column.source.type.numeric) {
            const values = ctx.cat('color').data as number[];
            config.color = r => values[r];
            config.color.min = ctx.fmt.color.value('min');
            config.color.max = ctx.fmt.color.value('max');
        }
        else {
            if (ctx.fmt.color.meta.autofill) {
                config.color = ctx.fmt.color.property('item', k => ctx.host.colorPalette.getColor(k).value);
            }
            else {
                config.color = ctx.fmt.color.property('item');
            }
        }
        /* #endregion */

        /* #region  width */
        if (!ctx.cat('width') || !ctx.fmt.width.meta.customize) {
            const width = ctx.fmt.width.meta.item;
            config.weight = { conv: _ => width, scale: null };
        }
        else if (ctx.cat('width').column.source.type.numeric) {
            const values = ctx.cat('width').data as number[];
            if (ctx.fmt.width.meta.scale === 'none') {
                config.weight = { conv: r => values[r], unit: ctx.fmt.width.meta.unit, scale: 'none' };
            }
            else {
                config.weight = {
                    conv: r => values[r],
                    scale: ctx.fmt.width.meta.scale,
                    max: ctx.fmt.width.value('max'),
                    min: ctx.fmt.width.value('min')
                }
            }
        }
        else {
            //distinct
            const width = ctx.fmt.width.property('item');
            config.weight = { conv: r => width(r), scale: null };
        }
        /* #endregion */

        /* #region  update style */
        config.style = ctx.fmt.style.meta.style;
        if (config.style === null) {
            if (config.color.max) {
                config.style = ctx.rows().length < 512 ? 'arc' : 'straight';
            }
            else {
                groups = values(groupBy(ctx.rows(), ctx.key(sourceRole, 'color')));
                if (keys(groups).length <= ctx.fmt.style.meta.limit) {
                    config.style = 'flow';
                }
                else {
                    config.style = ctx.rows().length < 512 ? 'arc' : 'straight';
                }
            }
        }
        else if (config.style === 'flow') {
            if (config.color.max) {
                config.style = ctx.rows().length < 512 ? 'arc' : 'straight';
            }
        }
        /* #endregion */

        /* #region  collect groups and valid rows */
        let rows = ctx.rows();
        if (config.style === 'flow') {
            if (!groups) {
                groups = values(groupBy(ctx.rows(), ctx.key(sourceRole, 'color')));
            }
            const weights = groups.map(g => sum(g, i => config.weight.conv(i)));
            groups = sort(groups, (_, i) => weights[i]);
            if (ctx.fmt.style.meta.limit < groups.length) {
                groups = groups.slice(0, ctx.fmt.style.meta.limit);
                rows = [].concat(...groups);
            }
        }
        else {
            groups = values(groupBy(ctx.rows(), ctx.key(sourceRole)));
        }

        /* #endregion */

        /* #region  update bubble.for if null */
        copy(ctx.fmt.bubble.meta, config.bubble);
        if (config.bubble.for === null) {
            config.bubble.for = ctx.fmt.style.meta.direction !== 'in' ? 'dest' : 'origin';
        }
        if (config.bubble.for === 'origin' || config.bubble.for === 'both') {
            config.bubble.out = ctx.key('Origin');
        }
        if (config.bubble.for === 'dest' || config.bubble.for === 'both') {
            config.bubble.in = ctx.key('Dest');
        }
        /* #endregion */

        /* #region  update bubble.slice if null */
        if (config.bubble.slice === null) {
            let mark = {}, cnt = 0;
            for (const r of rows) {
                const color = config.color(r);
                if (color in mark) {
                    continue;
                }
                else {
                    mark[color] = true;
                    if (cnt++ > 32) {
                        config.bubble.slice = false;
                        break;
                    }
                }
            }
            if (config.bubble.slice !== false) {
                config.bubble.slice = true;
            }
        }
        /* #endregion */
        

        override(deepmerge(ctx.config('mapControl'), ctx.config('mapElement')), config.map);

        config.injections = Object.assign({}, persist.geocode.value());
        copy(coords(ctx, 'Origin', 'OLati', 'OLong', coords(ctx, 'Dest', 'DLati', 'DLong', {})), config.injections);
        copy(persist.manual.value(), config.injections);

        copy(ctx.fmt.advance.meta, config.advance);
        config.groups = groups;
        return config;
    }
    
    private _inited = false;
    private _initing = false;
    private _view = null as powerbi.DataView;
    private _metaObj<O extends keyof Format>(view: powerbi.DataView, oname: O): Format[O] {
        if (view && view.metadata && view.metadata.objects) {
            return (view.metadata.objects[oname as string] || {}) as Format[O];
        }
        return {} as Format[O];
    }
    
    public update(options: VisualUpdateOptions) {
        const view = options.dataViews && options.dataViews[0];
        if (Persist.update(view)) {
            // console.log("Return due to persist update");
            return;
        }
        if (this._initing) {
            this._view = view;
            return;
        }
        if (!this._inited) {
            this._view = view;
            this._initing = true;
            const mapFmt = new MapFormat();
            override(this._metaObj(view, 'mapControl'), mapFmt);
            override(this._metaObj(view, 'mapElement'), mapFmt);
            popups.reset(persist.banner.value() || []);
            app.init(this._target, mapFmt, ctl => {
                const [center, zoom] = persist.map.value() || [null, null];
                center && ctl.map.setView({ center, zoom });
                ctl.add({ transform: (c, p, e) => e && persist.map.write([c.map.getCenter(), c.map.getZoom()], 400) });
                this._initing = false;
                const ctx = this._ctx;
                ctx.update(this._view);
                const cfg = this._cfg = this.config();
                app.reset(cfg, () => ctx.fmt.mapControl.meta.autoFit && app.tryFitView());
                this._view = null;
            });
            this._inited = true;
        }
        else {
            if (options.type === 4 || options.type === 32 || options.type === 36) {
                return;
            }
            const ctx = this._ctx;
            ctx.update(view);
            const cfg = this._cfg = this.config();
            const reset = () => app.reset(cfg, () => ctx.fmt.mapControl.meta.autoFit && app.tryFitView());
            if (ctx.dirtyFormat()) {
                if (ctx.fmt.style.dirty()) {
                    reset();
                }
                if (ctx.fmt.advance.dirty()) {
                    if (ctx.fmt.advance.dirty('cache') === 'off') {
                        persist.geocode.write({}, 10);
                        persist.manual.write({}, 10);
                    }
                    else if (ctx.fmt.advance.dirty('cache') === 'on') {
                        copy(app.$state.geocode, persist.geocode.value());
                        persist.geocode.write(persist.geocode.value(), 10);
                        persist.manual.write(persist.manual.value(), 10);
                    }
                    else {
                        if (ctx.fmt.advance.dirty('relocate') === 'off') {
                            persist.manual.write(persist.manual.value() || {}, 10);
                        }
                        reset();
                    }
                }
                if (ctx.fmt.color.dirty() || ctx.fmt.width.dirty()) {
                    app.repaint(cfg, 'flow');
                }
                if (ctx.fmt.bubble.dirty()) {
                    app.repaint(cfg, 'bubble');
                }
                if (ctx.fmt.valueFormat.dirty()) {
                    app.repaint(cfg, 'banner');
                }
                if (ctx.fmt.legend.dirty()) {
                    app.repaint(cfg, 'legend');
                }
                if (ctx.fmt.mapControl.dirty() || ctx.fmt.mapElement.dirty()) {
                    if (ctx.fmt.mapControl.dirty(['type', 'lang', 'pan', 'zoom']) || ctx.fmt.mapElement.dirty()) {
                        app.repaint(cfg, 'map');
                    }
                    if (this._ctx.fmt.mapControl.dirty('autoFit') === 'on') {
                        app.tryFitView();
                    }
                }
            }
            else {
                reset();
            }
        }
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        const oname = options.objectName as keyof Format, ctx = this._ctx, config = this._cfg;
        if (ctx.fmt.advance.meta.relocate) {
            if (oname !== 'advance') {
                return null;
            }
            return ctx.fmt.advance.instancer().metas(['relocate', 'located', 'unlocated']).dump();
        }
        switch (oname) {
            case 'advance':
                return ctx.fmt.advance.instancer().metas(['cache', 'relocate']).dump();
            case 'legend':
                const fmt = ctx.fmt.legend;
                const leg = fmt.instancer().metas(['show', 'position', 'fontSize']);
                if (ctx.fmt.color.meta.customize && ctx.cat('color')) {
                    let prop = ctx.fmt.color.property('item');
                    if (ctx.fmt.color.meta.autofill) {
                        prop = ctx.fmt.color.property('item', k => ctx.host.colorPalette.getColor(k).value);
                    }
                    leg.metas(['color']);
                    if (!ctx.cat('color').column.source.type.numeric && fmt.meta.color) {
                        leg.metas(["color_default"]);
                        leg.items('color_label', null, prop, fmt.meta.color_default);
                    }
                }
                else {
                    leg.conditionalMetas('color', ['color_label']);
                }

                if (ctx.cat('width')) {
                    if (this._cfg.weight.scale === null) {
                        if (ctx.fmt.width.meta.customize) {
                            leg.metas(['width']);
                            if (fmt.meta.width) {
                                leg.metas(['width_default']);
                                leg.items('width_label', null, ctx.fmt.width.property('item'), fmt.meta.width_default);
                            }
                        }
                        else {
                            leg.conditionalMetas('width', ['width_label']);
                        }
                    }
                    else {
                        leg.metas(['width']);
                    }
                }
                else {
                    leg.conditionalMetas('width', ['width_label']);
                }
                return leg.dump();
            case 'style':
                const flowStyle = this._cfg.style === 'flow';
                return ctx.fmt.style.instancer(partial(this._cfg, ['style'])).metas(['style'])
                    .conditionalMetas(flowStyle, ['direction', 'limit']).dump();
            case 'color':
                const col = ctx.fmt.color.instancer().metas(['item']);
                if (ctx.cat('color')) {
                    const key = ctx.cat('color').key;
                    col.metas(['customize']);
                    if (ctx.fmt.color.meta.customize) {
                        if (ctx.cat('color').column.source.type.numeric) {
                            col.metas(['min', 'max']);
                        }
                        else {
                            col.metas(['autofill']);
                            if (ctx.fmt.color.meta.autofill) {
                                const pal = ctx.host.colorPalette;
                                col.items('item', null, null, r => pal.getColor(key(r)).value);
                            }
                            else {
                                col.items('item', null, null, r => ctx.fmt.color.meta.item);
                            }
                        }
                    }
                }
                return col.dump();
            case 'width':
                const wid = ctx.fmt.width.instancer();
                if (!ctx.cat('width')) {
                    return wid.metas(['item']).dump();
                }
                if (this._cfg.weight.scale === null) {//district
                    return wid.metas(['item']).conditionalItems('item').dump();
                }
                else {
                    wid.metas(['scale'], this._cfg.weight);
                    if (this._cfg.weight.scale === 'none') {
                        wid.metas(['unit'], this._cfg.weight);
                    }
                    else {
                        wid.metas(['min', 'max']);
                    }
                }
                return wid.dump();
            case 'valueFormat':
                return ctx.fmt.valueFormat.instancer().metas(['sort', 'top'])
                    .add(numberObjects(ctx.fmt.valueFormat.partial() as any, oname)).dump();
            case 'bubble':
                const bub = ctx.fmt.bubble.instancer().metas(['for'], this._cfg.bubble);
                if (ctx.fmt.bubble.meta.for !== 'none') {
                    bub.metas(['scale', 'slice'], this._cfg.bubble);
                    if (!this._cfg.bubble.slice) {
                        bub.metas(['bubbleColor']);
                    }
                    bub.metas(['label']);
                    if (ctx.fmt.bubble.meta.label !== 'hide' && ctx.fmt.bubble.meta.label !== 'none') {
                        const both = ctx.fmt.bubble.meta.for === 'both';
                        bub.metas(['labelOpacity'])
                            .conditionalMetas(both || this._cfg.bubble.for === 'dest', ['labelColor'])
                            .conditionalMetas(both || this._cfg.bubble.for === 'origin', ['labelColor'])
                    }
                }
                return bub.dump();
            case 'mapControl':
            case 'mapElement':
                return ctx.fmt[oname].objectInstances();
        }
        return null;
    }
}