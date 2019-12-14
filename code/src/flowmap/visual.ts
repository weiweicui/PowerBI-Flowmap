import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { Format } from "./format";
import { Persist, Context, tooltip } from "../pbi";
import { override, groupBy, StringMap, Func, copy, values, sort, dict } from '../lava/type';
import { selex } from "../lava/d3";
import { MapFormat, ILocation } from "../lava/bingmap";
import * as app from '../lava/flowmap/app';
import { visualObjects as numberObjects, build as numberFormat } from '../pbi/numberFormat';

import { coords } from '../pbi/misc';
import { keys, sum } from "d3";

type Role = 'Origin' | 'Dest' | 'width' | 'color' | 'OLati' | 'OLong' | 'DLati' | 'DLong' | 'OName' | 'DName' | 'Tooltip' | 'Label';

const LEGEND = {
    color: { role: 'color', autofill: 'color_default', label: 'color_label' } as const,
    width: { role: 'width', autofill: 'width_default', label: 'width_label' } as const
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
            let conv = numberFormat(ctx.meta.valueFormat);
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
        const conv = numberFormat(ctx.meta.valueFormat);
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
        const { sort, top } = ctx.meta.valueFormat;
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
            if (ctx.meta.style.direction === 'out') {
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
        let conv = numberFormat(ctx.meta.valueFormat);
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
            if (ctx.meta.style.direction !== 'out') {
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
    private _cfg = null as app.Config;
    constructor(options: VisualConstructorOptions) {
        if (!options) {
            return;
        }
        this._target = options.element;
        tooltip.init(options);
        const ctx = this._ctx = new Context(options.host, new Format());
        ctx.fmt.width.bind('width', "item", "customize");
        ctx.fmt.color.bind("color", "item", 'customize', 'autofill', k => {
            return { solid: { color: ctx.palette(k) } };
        });

        ctx.fmt.legend.bind('width', 'width_label', 'width', 'width_default', '');
        ctx.fmt.legend.bind('color', 'color_label', 'color', 'color_default', '');
        app.events.flow.pathInited = group => {
            tooltip.add(group, arg => helper.pathTooltip(this._ctx, arg.data.leafs as number[]));
        };
        app.events.doneGeocoding = locs => {
            copy(locs, persist.geocode.value({}));
            if (this._ctx.meta.advance.cache) {
                persist.geocode.write(persist.geocode.value(), 10);
            }
        }
        app.events.popup.onChanged = addrs => persist.banner.write(addrs, 10);
        app.events.pin.onDrag = (addr, loc) => {
            persist.manual.value({})[addr] = this._cfg.injections[addr] = loc;
        };
        app.events.pie.onPieCreated = group => {
            tooltip.add(group, arg => helper.pieTooltip(arg.data.rows, arg.data.type, this._ctx));
        };
        selex(this._target).sty.cursor('default');
    }

    private _buildLegendLabels(role: 'color' | 'width'): StringMap<string> {
        const ctx = this._ctx, legend = ctx.fmt.legend, { autofill, label } = LEGEND[role];
        if (!legend.config(role)) {
            return {};//hide
        }
        const cat = ctx.cat(role);
        if (!cat || !ctx.meta[role].customize) {
            const txt = (legend.config(label) || '').trim();
            return txt ? { [ctx.config(role, 'item')]: txt } : {};
        }
        else if (cat.type.numeric) {
            return null;//smooth
        }
        else {
            //has cat && distinct
            const labels = ctx.labels(ctx.binding(role, 'item'), legend.special(label));
            if (legend.config(autofill)) {
                return dict(labels, r => r.key, r => r.value || r.name);
            }
            else {
                return dict(labels.filter(a => a.value), r => r.key, r => r.value);
            }
        }
    }

    private config(): app.Config {
        const config = new app.Config(), ctx = this._ctx;
        /* #region  legend */
        override(ctx.meta.legend, config.legend);
        if (config.legend.show) {
            config.legend.colorLabels = this._buildLegendLabels('color');
            config.legend.widthLabels = this._buildLegendLabels('width');
        }
        else {
            config.legend.colorLabels = config.legend.widthLabels = {};
        }
        /* #endregion */

        /* #region  numberSorter, numberFormat */
        override(ctx.meta.valueFormat, config.numberSorter);
        override(ctx.meta.valueFormat, config.numberFormat);
        /* #endregion */

        if (!ctx.cat('Origin')) {
            config.error = '"Origin" field is required.';
        }
        else if (!ctx.cat('Dest')) {
            config.error = '"Destination" field is required.'
        }

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
        if (ctx.meta.style.direction === 'in') {
            [config.source, config.target] = [config.target, config.source];
            sourceRole = 'Dest';
        }
        /* #endregion */

        /* #region  color */
        if (!ctx.cat('color') || !ctx.meta.color.customize) {
            const color = ctx.config('color', 'item');
            config.color = _ => color;
        }
        else if (ctx.type('color').numeric) {
            const values = ctx.nums('color');
            config.color = r => values[r];
            config.color.min = ctx.config('color', 'min');
            config.color.max = ctx.config('color', 'max');
        }
        else {
            config.color = ctx.fmt.color.item('item');
        }
        /* #endregion */

        /* #region  update style */
        config.style = ctx.meta.style.style;
        if (config.style === null) {
            if (config.color.max) {
                config.style = ctx.rows().length < 512 ? 'arc' : 'straight';
            }
            else {
                groups = values(groupBy(ctx.rows(), ctx.key(sourceRole, 'color')));
                if (keys(groups).length <= ctx.meta.style.limit) {
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

        /* #region  width */
        if (!ctx.cat('width') || ctx.type('width').numeric) {
            const { max, min, item, unit } = ctx.meta.width;
            if (config.style !== 'flow' && !ctx.cat('width')) {
                config.weight = { conv: _ => item, scale: null };
            }
            else {
                let conv = _ => 1;
                if (ctx.cat('width')) {
                    const values = ctx.cat('width').data as number[];
                    conv = r => values[r];
                }
                if (ctx.meta.width.scale === 'none') {
                    config.weight = { conv, unit, scale: 'none' };
                }
                else {
                    config.weight = { conv, scale: ctx.meta.width.scale, max, min }
                }
            }
        }
        else {
            //has width column and is district
            if (ctx.meta.width.customize) {
                config.weight = { conv: ctx.fmt.width.item('item'), scale: null };
            }
            else {
                const width = ctx.meta.width.item;
                config.weight = { conv: _ => width, scale: null };
            }
        }
        /* #endregion */

        /* #region  update bubble.for if null */
        copy(ctx.meta.bubble, config.bubble);
        if (config.bubble.for === null) {
            config.bubble.for = ctx.meta.style.direction !== 'in' ? 'dest' : 'origin';
        }
        if (config.bubble.for === 'origin' || config.bubble.for === 'both') {
            config.bubble.out = ctx.key('Origin');
        }
        if (config.bubble.for === 'dest' || config.bubble.for === 'both') {
            config.bubble.in = ctx.key('Dest');
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
            if (ctx.meta.style.limit < groups.length) {
                groups = groups.slice(0, ctx.meta.style.limit);
                rows = [].concat(...groups);
            }
        }
        else {
            groups = values(groupBy(ctx.rows(), ctx.key(sourceRole)));
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


        override(ctx.original('mapControl'), override(ctx.original('mapElement'), config.map));

        config.injections = Object.assign({}, persist.geocode.value({}));
        copy(coords(ctx, 'Origin', 'OLati', 'OLong', coords(ctx, 'Dest', 'DLati', 'DLong', {})), config.injections);
        copy(persist.manual.value({}), config.injections);

        copy(ctx.meta.advance, config.advance);
        config.groups = groups;
        return config;
    }

    private _inited = false;
    private _initing = false;

    public update(options: VisualUpdateOptions) {
        const view = options.dataViews && options.dataViews[0] || {} as powerbi.DataView;
        if (Persist.update(view)) {
            // console.log("Return due to persist update");
            return;
        }
        if (this._initing) {
            return;
        }
        const ctx = this._ctx.update(view);
        if (!this._inited) {
            this._initing = true;
            const mapFmt = new MapFormat();
            override(ctx.original('mapElement'), override(ctx.original('mapControl'), mapFmt));
            app.init(this._target, mapFmt, persist.banner.value() || [], ctl => {
                const [center, zoom] = persist.map.value() || [null, null];
                center && ctl.map.setView({ center, zoom });
                ctl.add({ transform: (c, p, e) => e && persist.map.write([c.map.getCenter(), c.map.getZoom()], 400) });
                this._initing = false;
                const cfg = this._cfg = this.config();
                app.reset(cfg, () => ctx.meta.mapControl.autoFit && app.tryFitView());
            });
            this._inited = true;
        }
        else {
            if (ctx.isResizeVisualUpdateType(options)) {
                return;
            }
            const cfg = this._cfg = this.config(), fmt = ctx.fmt;
            const reset = () => app.reset(cfg, () => ctx.meta.mapControl.autoFit && app.tryFitView());
            if (ctx.dirty()) {
                if (fmt.style.dirty()) {
                    reset();
                }
                if (fmt.advance.dirty()) {
                    if (fmt.advance.dirty('cache') === 'off') {
                        persist.geocode.write({}, 10);
                        persist.manual.write({}, 10);
                    }
                    else if (fmt.advance.dirty('cache') === 'on') {
                        copy(app.$state.geocode, persist.geocode.value({}));
                        persist.geocode.write(persist.geocode.value(), 10);
                        persist.manual.write(persist.manual.value(), 10);
                    }
                    else {
                        if (fmt.advance.dirty('relocate') === 'off') {
                            persist.manual.write(persist.manual.value() || {}, 10);
                        }
                        reset();
                    }
                }
                if (fmt.color.dirty() || fmt.width.dirty()) {
                    app.repaint(cfg, 'flow');
                }
                if (fmt.bubble.dirty()) {
                    app.repaint(cfg, 'bubble');
                }
                if (fmt.valueFormat.dirty()) {
                    app.repaint(cfg, 'banner');
                }
                if (fmt.legend.dirty()) {
                    app.repaint(cfg, 'legend');
                }
                if (fmt.mapControl.dirty() || fmt.mapElement.dirty()) {
                    if (fmt.mapControl.dirty(['type', 'lang', 'pan', 'zoom']) || fmt.mapElement.dirty()) {
                        app.repaint(cfg, 'map');
                    }
                    if (fmt.mapControl.dirty('autoFit') === 'on') {
                        app.tryFitView();
                    }
                }
            }
            else {
                reset();
            }
        }
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
        const oname = options.objectName as keyof Format, ctx = this._ctx, fmt = ctx.fmt, cfg = this._cfg;
        if (ctx.meta.advance.relocate) {
            if (oname !== 'advance') {
                return null;
            }
            return fmt.advance.dumper().metas(['relocate', 'located', 'unlocated']).result;
        }
        switch (oname) {
            case 'advance':
                return fmt.advance.dumper().metas(['cache', 'relocate']).result;
            case 'legend':
                return fmt.legend.dumper()
                    .metas(['show', 'position', 'fontSize'])
                    .labels(fmt.color.binding('item'), 'color_label')
                    .labels(fmt.width.binding('item'), 'width_label', d => d.metas(['width']))
                    .result;
            case 'style':
                return fmt.style.dumper().metas(['style'], cfg)
                    .metas(cfg.style === 'flow', ['direction', 'limit'])
                    .result;
            case 'color':
                const color = fmt.color.dumper().metas(['item']);
                if (!ctx.cat('color')) {
                    return color.result;
                }
                else if (ctx.type('color').numeric) {
                    color.metas('customize', ['min', 'max']);
                }
                else {
                    color.items('item');
                }
                return color.result;
            case 'width':
                const width = fmt.width.dumper();
                if (!ctx.cat('width') && cfg.style !== 'flow') {
                    width.metas(['item']);
                }
                if (cfg.weight.scale === null) {//district
                    width.metas(['item']).items('item');
                }
                else if (cfg.weight.scale === 'none') {
                    width.metas(['scale', 'unit'], cfg.weight);
                }
                else {
                    width.metas(['scale', 'min', 'max'], cfg.weight);
                }
                return width.result;
            case 'valueFormat':
                return fmt.valueFormat.dumper().metas(['sort', 'top'])
                    .add(numberObjects(ctx.meta.valueFormat, oname))
                    .result;
            case 'bubble':
                const bubble = fmt.bubble.dumper().metas(['for'], cfg.bubble);
                if (ctx.meta.bubble.for !== 'none') {
                    bubble.metas(['scale', 'slice'], cfg.bubble);
                    if (!cfg.bubble.slice) {
                        bubble.metas(['bubbleColor']);
                    }
                    bubble.metas(['label']);
                    if (ctx.meta.bubble.label !== 'hide' && ctx.meta.bubble.label !== 'none') {
                        const both = ctx.meta.bubble.for === 'both';
                        bubble.metas(['labelOpacity'])
                            .metas(both || cfg.bubble.for === 'dest', ['labelColor'])
                            .metas(both || cfg.bubble.for === 'origin', ['labelColor'])
                    }
                }
                return bubble.result;
            default:
                return fmt[oname].dumper().default;
        }
    }
}