/// <reference path="../.api/v1.6.0/PowerBI-visuals.d.ts" />
import { Formatter, Instances, IFormatter } from './formatter';
import { StringMap, keys, Func, values, dateLabel, sequence } from "type";
import { Persist, host } from "./host";

type PColumn        = powerbi.DataViewCategoricalColumn;
type IVisualTipItem = powerbi.extensibility.VisualTooltipDataItem;
type ISelectionId   = powerbi.visuals.ISelectionId;

function index(columns: PColumn[]): StringMap<PColumn> {
    var result = {} as StringMap<PColumn>;
    if (!columns) {
        return result;
    }
    else {
        for (var col of columns) {
            for (var role of keys(col.source.roles)) {
                result[role] = col;
            }
        }
        return result;
    }
}

export class Category {
    public readonly column: powerbi.DataViewCategoryColumn;
    private _rids = {} as StringMap<ISelectionId>;
    private _flag = null as powerbi.PrimitiveValue[];
    constructor(column: PColumn, flag: powerbi.PrimitiveValue[]) {
        this.column = column;
        this._flag = flag;
        if (column) {
            var values = column.values;
            this.key = r => values[r] + "";
        }
        else {
            this.key = r => "";
        }
    }
    
    public id(row: number): ISelectionId {
        var result = this._rids[row];
        if (!result) {
            result = this._rids[row] = host.id(this.column, row);
        }
        return result;
    }

    private _distincts = null as number[];
    public distincts(): number[] {
        if (this._distincts) {
            return this._distincts;
        }
        if (!this.column) {
            return this._distincts = [];
        }
        var cache = {} as StringMap<boolean>;
        var values = this.column.values;
        var result = [] as number[];
        for (var row = 0, len = values.length; row < len; row++) {
            var key = this.key(row);
            if (this._flag && this._flag[row] === null) {
                continue;
            }
            if (key in cache) {
                continue;
            }
            else {
                cache[key] = true;
                result.push(row);
            }
        }
        return this._distincts = result;
    }

    public key: (r: number) => string;

    public labels(rows: number[]): string[] {
        var values = this.column.values;
        var result = rows.map(r => values[r]);
        if (!this.column.source.type.dateTime) {
            return result as any;
        }
        var labelof = dateLabel(result as Date[]);
        return result.map(d => {
            return d instanceof Date ? labelof(d) : d as string;
        });
    }
}

export class Grand<R extends string, F> {
    public tooltipRole = 'tooltip';
    public fmt: {[P in keyof F]: IFormatter<F[P]> };
    get highlighted(): boolean {
        return !!this._highlights;
    }
    
    public sorter(role: R): (r1: number, r2: number) => number {
        if (!this.exist(role)) {
            return () => 0;
        }
        var column = this.column(role), values = column.values;
        var build = normal => {
            return (a, b) => {
                var va = values[a], vb = values[b];
                if (va === null || va === undefined) {
                    return -1;
                }
                if (vb === null || vb === undefined) {
                    return 1;
                }
                return normal(va, vb);
            }
        }
        if (column.source.type.numeric) {
            return build((a, b) => a - b);
        }
        if (column.source.type.dateTime) {
            return build((a, b) => a.getTime() - b.getTime());
        }
        else {
            return build((a, b) => (a + '').localeCompare(b + ''));
        }
    }

    protected _highlights = null as powerbi.PrimitiveValue[];    
    protected _FORMAT   : F;
    protected _colMap   : StringMap<PColumn> = {};
    protected _valMap   : StringMap<PColumn> = {};    
    protected _formatter: StringMap<Formatter<any>>;
    protected _view     : powerbi.DataView;
    protected _catMap   : StringMap<Category>;
    protected _dftColumn: PColumn;
    protected _tipCols  : powerbi.PrimitiveValue[][];
    protected _tipNames : string[];
    
    public column(role: R, view?: powerbi.DataView): PColumn {
        if (view) {
            var data = view.categorical || {};
            return index(data.categories)[role] || index(data.values)[role];
        }
        else {
            return this._colMap[role] || this._valMap[role];
        }
    }

    private _onlyHighlights = false;
    constructor(format: F, onlyHighlights: boolean) {
        this._FORMAT = format;
        this._formatter = {};
        this._catMap = {};
        this._valMap = {};
        for (var oname in format) {
            this._formatter[oname] = new Formatter(oname, format[oname]) as any;
        }
        this.fmt = this._formatter as any;
        this._onlyHighlights = onlyHighlights;
    }
    
    public initMetas(view: powerbi.DataView) {
        if (!view || !view.metadata || !view.metadata.objects) {
            return;
        }
        for (var oname in view.metadata.objects) {
            if (!this._formatter[oname]) {
                continue;
            }
            var obj = view.metadata.objects[oname];
            for (var pname in obj) {
                this._formatter[oname].values[pname] = obj[pname];
            }
        }
    }

    public values<T>(role: R, rows?: number[]): ReadonlyArray<T> {
        var column = this.column(role);
        if (!column) {
            return null;
        }
        var values = column.values;
        if (rows) {
            return rows.map(r => values[r] as any);
        }
        else {
            return this.rows().map(r => values[r]) as any;
        }
    }

    private _cachedRows: number[];
    public rows(): ReadonlyArray<number> {
        if (this._cachedRows) {
            return this._cachedRows;
        }
        var result = [] as number[], flags = this._highlights;
        if (flags && this._onlyHighlights) {
            for (var i = 0, len = flags.length; i < len; i++) {
                if (flags[i] !== null) {
                    result.push(i);
                }
            }
        }
        else {
            result = sequence(0, this._dftColumn.values.length);
        }
        this._cachedRows = result;
        return result;
    }

    public tooltip(row: number): IVisualTipItem[] {
        if (!this._tipNames || this._tipNames.length === 0) {
            return null;
        }
        else {
            return this._tipNames.map((name, index) => <IVisualTipItem>{
                displayName: name,
                value: this._tipCols[index][row]
            });
        }
    }

    public key(role: R): Func<number, string> {
        return this.cat(role).key;
    }

    public meta<T>(view: powerbi.DataView, oname: keyof F, pname: string, dft?: T): T {
        if (!view || !view.metadata || !view.metadata.objects || !view.metadata.objects[oname]) {
            return dft;
        }
        return view.metadata.objects[oname][pname] as any || dft;
    }

    public cat(role: R): Category {
        var cat = this._catMap[role];
        if (!cat) {
            //cannot use this._valMap, it will cause selector in format not working
            //when selector not working, the displayName is ignored, and only use
            //the one in json
            //so, put cat column as Grouping in the capabilities.json
            var flags = this._onlyHighlights ? this._highlights : null;
            cat = this._catMap[role] = new Category(this._colMap[role], flags) as any;
        }
        return cat;
    }
    
    private _dirtyFormat   : boolean;
    private _dirtyCount    : boolean;
    private _dirtyRole     : boolean;
    private _dirtyHighlight: boolean;
    private _dirtyTooltip  : boolean;

    private _updateTooltip(view: powerbi.DataView) {
        var cnt = 0, mark = {} as StringMap<boolean>;
        if (this._tipNames) {
            cnt = this._tipNames.length;
            for (var v of this._tipNames) {
                mark[v] = true;
            }
        }
        this._tipCols = [];
        this._tipNames = [];
        this._dirtyTooltip = false;
        if (this.tooltipRole && view && view.categorical && view.categorical.values) {
            for (var col of view.categorical.values) {
                if (col.source.roles[this.tooltipRole]) {
                    this._tipCols.push(col.values);
                    this._tipNames.push(col.source.displayName);
                    if (!(col.source.displayName in mark)) {
                        this._dirtyTooltip = true;
                    }
                    cnt -= 1;
                }
            }
        }
        if (cnt !== 0) {
            this._dirtyTooltip = true;
        }
    }

    private _updateDefaultColumn() {   
        var column = values(this._colMap)[0];
        var len = this._dftColumn && this._dftColumn.values.length;
        this._dirtyCount = len !== (column && column.values.length);
        this._dftColumn = column;
    }

    private _updateColumnMaps(view: powerbi.DataView) {
        if (!view || !view.categorical) {
            var cmap = {} as StringMap<PColumn>;
            var vmap = {} as StringMap<PColumn>;
        }
        else {
            var cmap = index(view.categorical.categories);
            var vmap = index(view.categorical.values);
        }
        var updated = {} as StringMap<boolean>;
        var cmp = (a: StringMap<PColumn>, b: StringMap<PColumn>) => {
            for (var r of keys(a)) {
                if (r === this.tooltipRole) {
                    continue;
                }
                if (r in b && b[r].source.displayName === a[r].source.displayName) {
                    continue;
                }
                updated[r] = true;
            }
        }
        cmp(this._colMap, cmap); cmp(cmap, this._colMap);
        cmp(this._valMap, vmap); cmp(vmap, this._valMap);
        this._colMap = cmap;
        this._valMap = vmap;
        this._updatedRoles = updated;
        this._dirtyRole = keys(updated).length !== 0;
        if (this.tooltipRole in updated && keys(updated).length === 1) {
            this._dirtyRole = false;
        }
    }

    private _updatedRoles = {} as StringMap<boolean>;
    public roleDirty(...roles: R[]): boolean {
        for (var r of roles) {
            if (r in this._updatedRoles) {
                return true;
            }
            if (r === this.tooltipRole && this._dirtyTooltip) {
                return true;
            }
        }
        return false;
    }

    private _updateHighlights() {
        var column = values(this._valMap)[0] as powerbi.DataViewValueColumn;
        var those = column && column.highlights, these = this._highlights;
        this._dirtyHighlight = !!those !== !!these;
        if (!this._dirtyHighlight && those && these) {
            if (those.length === these.length) {
                for (var i = 0, len = those.length; i < len; i++) {
                    if ((those[i] === null) !== (these[i] === null)) {
                        this._dirtyHighlight = true;
                        break;
                    }
                }
            }
            else {
                this._dirtyHighlight = true;
            }
        }
        this._highlights = those;
    }

    public exist(...roles: R[]): boolean {
        for (var r of roles) {
            if (!this.column(r)) {
                return false;
            }
        }
        return true;
    }

    protected _exist(view: powerbi.DataView, ...roles: R[]) {
        if (!view || !view.categorical) {
            var cmap = {} as StringMap<PColumn>;
            var vmap = {} as StringMap<PColumn>;
        }
        else {
            var cmap = index(view.categorical.categories);
            var vmap = index(view.categorical.values);
        }
        return roles.every(r => (r in cmap) || (r in vmap));
    }
    
    public updateFormat(view: powerbi.DataView): void {
        this._dirtyFormat = false;
        var oldCats = this._catMap;
        this._catMap = {};

        view = view || {} as any;
        var categorical = view.categorical || {};
        var format = (view.metadata && view.metadata.objects) || {};
        var cmap = categorical ? index(categorical.categories) : {};
        var flag = null;
        if (categorical && categorical.values && categorical.values[0]) {
            flag = view.categorical.values[0].highlights;
        }
        var cater = (r: R) => {
            if (!this._catMap[r]) {
                this._catMap[r] = new Category(cmap[r], flag) as any;
            }
            return this._catMap[r];
        };
        var newlength = 0, oldlength = 0;
        if (categorical && categorical.categories && categorical.categories[0]) {
            newlength = categorical.categories[0].values.length;
        }
        if (this._dftColumn) {
            oldlength = this._dftColumn.values.length;
        }
        var dataDirty = newlength !== oldlength;//we think the data is dirty/filtered
        for (var oname in this._FORMAT) {
            if (this._formatter[oname].update(cater, format[oname], dataDirty)) {
                this._dirtyFormat = true;
            }
        }
        if (dataDirty) {
            var pers = { merge: [], remove: [] };
            for (var oname in this._FORMAT) {
                var per = this._formatter[oname].persistance;
                pers.merge.push(...per.merge);
                pers.remove.push(...per.remove);
            }
            if (pers.merge.length || pers.remove.length) {
                this._formatPersist.run(pers, 1);
            }
        }
    }

    private _formatPersist = new Persist<string>('advance', 'perData');

    public updateData(view: powerbi.DataView): void {
        this._cachedRows = null;
        this._updateColumnMaps(view);
        this._updateTooltip(view);
        this._updateDefaultColumn();
        this._updateHighlights();
        
        if (!this._view) {
            this._dirtyFormat = true;
            this._dirtyRole  = true;
            this._dirtyCount = true;
        }
        // console.log(this._view, 'format', this._dirtyFormat, 'role', this._dirtyRole, 'row', this._dirtyRow, 'tooltip', this._dirtyTooltip);
        
        this._view = view;
    }

    public update(view: powerbi.DataView): void {
        this.updateFormat(view);
        this.updateData(view);
    }

    
    public dirty(value: 'data' | 'highlight' | 'format' | 'tooltip' | 'count' | 'role'): boolean {
        if (value === 'data') {
            // console.log(this._dirtyHighlight, this._dirtyRole, this._dirtyCount);
            return this._dirtyHighlight || this._dirtyRole || this._dirtyCount;
        }
        if (value === 'format') {
            return this._dirtyFormat;
        }
        else if (value === 'tooltip') {
            return this._dirtyTooltip;
        }
        else if (value === 'count') {
            return this._dirtyCount;
        }
        else {
            return this._dirtyHighlight;
        }
    }

    public instances<K extends keyof F>(oname: K): Instances<F[K]> {
        return new Instances(this._formatter[oname]);
    }

    public property<T extends keyof F, K extends keyof F[T]>(oname: T, pname: K): Func<number | string, F[T][K]> {
        return (this._formatter[oname]).property<T>(pname) as any;
    }

    public ids(rows: number[], role?: R): ISelectionId[] {
        if (role === undefined) {
            return rows.map(r => host.id(this._dftColumn, r));
        }
        else {
            var column = this._colMap[role];
            return column && rows.map(r => host.id(column, r));
        }
    }

    public get highlight(): Func<number, boolean> {
        var flags = this._highlights;
        if (flags) {
            return r => flags[r] !== null;
        }
        else {
            return r => true;
        }
    }

    public value<T>(role: R): Func<number, T> {
        var vals = this.column(role) && this.column(role).values;
        return vals ? r => vals[r] : r => null;
    }

    public group(...roles: R[]): ReadonlyArray<number>[] {
        if (roles.every(r => !this.exist(r))) {
            return [this.rows()];
        }
        let keys = [] as Func<number, string>[];
        for (var r of roles) {
            if (this.exist(r)) {
                keys.push(this.key(r));
            }
        }
        let id = keys[0];
        if (keys.length > 1) {
            id = (r: number) => keys.map(k => k(r)).join(' ');
        }
        let cache = {} as StringMap<number[]>;
        for (let row of this.rows()) {
            let key = id(row);
            let rows = cache[key];
            if (!rows) {
                rows = cache[key] = [];
            }
            rows.push(row);
        }
        return values(cache);
    }
}