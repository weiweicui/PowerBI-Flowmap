import { Selection } from './selection';
import { Formatter, Instances, IFormatter } from './formatter';
import { StringMap, keys, Func, values, dateString, sequence, dict, pick } from "type";
import { Persist, host } from "./host";
import { groupBy } from './misc';

type PColumn        = powerbi.DataViewCategoricalColumn;
type IVisualTipItem = powerbi.extensibility.VisualTooltipDataItem;
type ISelectionId   = powerbi.visuals.ISelectionId;

function index2(columns: PColumn[]): StringMap<PColumn[]> {
    let result = {} as StringMap<PColumn[]>;
    if (!columns) {
        return result;
    }
    else {
        for (let col of columns) {
            for (let role of keys(col.source.roles)) {
                if (result[role]) {
                    result[role].push(col);
                }
                else {
                    result[role] = [col];
                }
            }
        }
        return result;
    }    
}

export class Category {
    public readonly column: powerbi.DataViewCategoryColumn;
    public readonly role: string;
    private _rids = {} as StringMap<ISelectionId>;
    private _rows = [] as number[];
    private _distincts = null as number[];
    constructor(column: PColumn, rows: number[], role: string) {
        this.column = column;
        this.role = role;
        this._rows = rows;
        if (column) {
            let values = column.values;
            this.key = r => values[r] + "";
        }
        else {
            this.key = r => "";
        }
    }

    public id(row: number): ISelectionId {
        let id = this._rids[row];
        if (!id) {
            id = this._rids[row] = host.id(this.column, row);
        }
        return id;
    }
    
    public distincts(rows?: number[]): number[] {
        if (this._distincts && !rows) {
            return this._distincts;
        }
        if (!this.column) {
            return this._distincts = [];
        }
        let cache = {} as StringMap<boolean>;
        let unique = [] as number[];
        let candidates = rows || this._rows
        for (let row of candidates) {
            let key = this.key(row);
            if (!(key in cache)) {
                cache[key] = true;
                unique.push(+row);
            }
        }
        if (!rows) {
            this._distincts = unique;
        }
        return unique;
    }

    public key: (r: number) => string;

    public row2label(rows: number[]): StringMap<string> {
        if (!rows || rows.length === 0) {
            return {};
        }
        let values = rows.map(r => this.column.values[r]);
        if (this.column.source.type.dateTime) {
            let conv = dateString(values as Date[]);
            values = values.map(d => d instanceof Date ? conv(d) : d as any);
        }
        let result = {} as StringMap<string>;
        for (let i = 0; i < rows.length; i++) {
            result[rows[i]] = values[i] as string;
        }
        return result;
    }

    public labels(rows: number[]): string[] {
        if (!rows || rows.length === 0) {
            return [];
        }
        let values = rows.map(r => this.column.values[r]);
        if (!this.column.source.type.dateTime) {
            return values as any;
        }
        let conv = dateString(values as Date[]);
        return values.map(d => d instanceof Date ? conv(d) : d as any);
    }
}

class Roles<R extends string> {

    private _cmap  = {} as StringMap<PColumn[]>;
    private _vmap  = {} as StringMap<PColumn[]>;
    private _dirty = {} as StringMap<any>;
    private _mute  = {} as StringMap<any>;

  // public
    // empty means anything
    dirty(...roles: R[]): boolean {
        if (roles.length === 0) {
            roles = keys(this._dirty) as any;
            if (roles.length === 0) {
                return false;
            }
            else {
                return roles.some(r => !(r in this._mute));
            }
        }
        else {
            return roles.some(r => r in this._dirty);
        }
    }

    silence(...roles: R[]): this {
        this._mute = dict(roles);
        return this;
    }

    update(view: powerbi.DataView): this {
        if (!view || !view.categorical) {
            this._dirty = dict(keys(this._cmap, this._vmap));
            this._vmap = this._cmap = {};
        }
        else {
            this._dirty = {} as StringMap<true>;
            let cmap = index2(view.categorical.categories);
            let vmap = index2(view.categorical.values);
            this._compare(this._cmap, cmap);
            this._compare(this._vmap, vmap);
            this._cmap = cmap;
            this._vmap = vmap;
        }
        return this;
    }
    
    exist(...roles: R[]): boolean {
        return roles.every(r => r in this._cmap || r in this._vmap);
    }

    column(r?: R): PColumn {
        if (r === undefined) {
            return values(this._cmap)[0][0];
        }
        else {
            return (this.columns(r) || [])[0];
        }
    }


    columns(r: R): PColumn[] {
        return this._cmap[r] || this._vmap[r];
    }

    sorter(role: R): (r1: number, r2: number) => number {
        if (!this.exist(role)) {
            return () => 0;
        }
        let cmps = this.columns(role).map(c => this._sorter(c));
        if (cmps.length === 1) {
            return cmps[0];
        }
        else {
            return (r1, r2) => {
                for (let cmp of cmps) {
                    let ret = cmp(r1, r2);
                    if (ret !== 0) {
                        return ret;
                    }
                }
                return 0;
            }
        }
    }
    
  // private
    private _sorter(column: PColumn): (r1: number, r2: number) => number {
        let values = column.values;
        let build = comp => {
            return (a, b) => {
                let va = values[a], vb = values[b];
                if (va === null || va === undefined) {
                    return -1;
                }
                if (vb === null || vb === undefined) {
                    return 1;
                }
                return comp(va, vb);
            }
        }
        if (column.source.type.numeric) {
            return build((a, b) => a - b);
        }
        else if (column.source.type.dateTime) {
            return build((a, b) => a.getTime() - b.getTime());
        }
        else {
            return build((a, b) => (a + '').localeCompare(b + ''));
        }
    }

    private _compare(a: StringMap<PColumn[]>, b: StringMap<PColumn[]>): void {
        for (let v of keys(a, b)) {
            if (v in a && v in b) {
                let aray = a[v], bray = b[v];
                if (aray.length !== bray.length) {
                    this._dirty[v] = true;
                    continue;
                }
                let mark = dict(aray, v => v.source.displayName);
                if (bray.some(v => !(v.source.displayName in mark))) {
                    this._dirty[v] = true;
                    continue;
                }
            }
            else {
                this._dirty[v] = true;
            }
        }
    }

}

class Items {
    private _grand;
    constructor(grand: Grand<any, any>) {
        this._grand = grand;
    }
    private _dirty = {} as { count?: true, highlight?: true };
    public dirty(...types: ('count' | 'highlight')[]): boolean {
        if (types.length === 0) {
            return keys(this._dirty).length > 0;
        }
        else {
            return types.some(n => n in this._dirty);
        }
    }
    private _count = null;
    public get count(): number {
        return this._count;
    }
    private _highlights = null as powerbi.PrimitiveValue[];
    public get highlights(): powerbi.PrimitiveValue[] {
        return this._highlights;
    }

    private _cachedRows: number[];
    public rows(): number[] {
        if (this._cachedRows) {
            return this._cachedRows;
        }
        let result = [] as number[], flags = this._highlights;
        // if (flags) {
        //     for (let i = 0; i < flags.length; i++) {
        //         if (flags[i] !== null) {
        //             result.push(i);
        //         }
        //     }
        // }
        // else {
        result = sequence(0, this._count);
        // }
        this._cachedRows = result;
        return result;
    }

    update(view: powerbi.DataView) {
        this._dirty = {};
        this._cachedRows = null;
        let count = 0, highlights = null as powerbi.PrimitiveValue[];
        if (view && view.categorical) {
            let { categories, values } = view.categorical;
            if (categories && categories[0]) {
                count = categories[0].values.length;
            }
            if (values && values[0]) {
                highlights = (values[0] as powerbi.DataViewValueColumn).highlights;
                count = values[0].values.length;
            }
        }
        if (count !== this._count) {
            this._dirty.count = true;
            this._count = count;
            this._dirty.highlight = true;
            this._highlights = highlights;
            return;
        }
        //counts are the same
        if (this._highlights && highlights) {
            for (let i = 0; i < count; i++) {
                let a = this._highlights[i] === null;
                let b = highlights[i] === null;
                if (a !== b) {
                    this._dirty.highlight = true;
                    break;
                }
            }
        }
        if (!this._highlights !== !highlights) {
            this._dirty.highlight = true;
        }
        this._highlights = highlights;
        return;
    }
}

export class Grand<R extends string, F> {
    public fmt: {[P in keyof F]: IFormatter<F[P]> };
    public roles: Roles<R>;
    public items: Items;
    public selection: Selection;

    private _catRoles = [] as R[];
    private _required = [] as StringMap<string>[];
    require(roles: R[], names: string[]) {
        let map = {} as any;
        for (let i = 0; i < roles.length; i++) {
            map[roles[i]] = names[i];
        }
        this._required.push(map);
    }

    public delta(): F {
        let result = {} as F;
        for (let k in this.fmt) {
            result[k] = {} as any;
            let fmt = this.fmt[k];
            let dirty = fmt.dirty();
            if (dirty) {
                for (let pname in dirty) {
                    result[k][pname] = fmt.meta[pname];
                }
            }
        }
        return result;
    }

    public isPersistingCache(view: powerbi.DataView) {
        return host.dirtyPersist(view) && !this.issue() && !this.issue(view);
    }

    public sorter(role: R): (r1: number, r2: number) => number {
        return this.roles.sorter(role);
    }

    protected _FORMAT     : F;
    protected _formatter  : StringMap<Formatter<any>>;
    protected _view       : powerbi.DataView;
    protected _cats     : StringMap<Category>;
    
    public column(role: R, view?: powerbi.DataView): PColumn {
        if (view) {
            return new Roles<R>().update(view).column(role);
        }
        else {
            return this.roles.column(role);
        }
    }

    issue(view?: powerbi.DataView): string {
        view = view || this._view;
        if (!view) {
            return 'Data is empty.';
        }
        let cache = new Roles<R>().update(view);
        if (this._required.length > 1) {
            for (let map of this._required) {
                let roles = keys(map) as R[];
                if (cache.exist(...roles)) {
                    return null;
                }
            }
            return 'Some required fields are missing';
        }
        if (this._required.length === 1) {
            let map = this._required[0];
            let roles = keys(map) as R[];
            let tmp = pick(roles, r => map[r], r => !cache.exist(r));
            if (tmp.length === 0) {
                return null;
            }
            else if (tmp.length === 1) {
                return tmp[0] + ' field is missing.';
            }
            else {
                return tmp.join(' and ') + ' fields are missing.';
            }
        }
        return null;
    }

    constructor(format: F, categories: R[]) {
        this._catRoles = categories;
        this._FORMAT    = format;
        this._formatter = {};
        this._cats    = {};
        for (let oname in format) {
            this._formatter[oname] = new Formatter(oname, format[oname]);
        }
        this.fmt = this._formatter as any;
        this.selection = new Selection(this);
        this.roles = new Roles<R>();
        this.items = new Items(this);
    }

    public init(view: powerbi.DataView, ...onames:(keyof F)[]) {
        if (!view || !view.metadata || !view.metadata.objects) {
            return;
        }
        if (!onames || onames.length === 0) {
            onames = keys(this._formatter) as any;
        }
        for (let oname of onames) {
            this._formatter[oname].init(view);
        }
    }
   
    public values<T>(role: R, rows?: number[]): ReadonlyArray<T> {
        let column = this.column(role);
        if (!column) {
            return null;
        }
        let values = column.values;
        return (rows || this.rows()).map(r => values[r] as any);
    }

    public rows(): number[] {
        return this.items.rows();
    }

    public key(...roles: R[]): Func<number, string> {
        if (roles.length === 1) {
            return this.cat(roles[0]).key;
        }
        roles = roles.filter(r => this.exist(r));
        let keys = roles.map(r => this.cat(r).key);
        return r => keys.map(k => k(r)).join('_');
    }

    public meta<T extends keyof F, K extends keyof F[T]>(view: powerbi.DataView, oname: T, pname: K, dft?: F[T][K]): F[T][K] {
        if (!view || !view.metadata || !view.metadata.objects || !view.metadata.objects[oname]) {
            return dft;
        }
        return view.metadata.objects[oname][pname] as any || dft;
    }

    public cat(role: R): Category {
        let cat = this._cats[role];
        if (!cat) {
            //cannot use this._valMap, it will cause selector in format not working
            //when selector not working, the displayName is ignored, and only use
            //the one in json
            //so, put cat column as Grouping in the capabilities.json
            cat = this._cats[role] = new Category(this.column(role), this.rows(), role);
        }
        return cat;
    }
    
    private _dirtyFormat   : boolean;
    
    columns(role: R, view?:powerbi.DataView): PColumn[] {
        view = view || this._view;
        if (!view || !view.categorical) {
            return null;
        }
        let result = [] as PColumn[];
        for (let col of view.categorical.categories) {
            if (col.source.roles[role]) {
                result.push(col);
            }
        }
        for (let col of view.categorical.values) {
            if (col.source.roles[role]) {
                result.push(col);
            }
        }
        return result;
    }
    
    public exist(...roles: R[]): boolean {
        return this.roles.exist(...roles);
    }

    protected _exist(view: powerbi.DataView, ...roles: R[]) {
        return new Roles<R>().update(view).exist(...roles);
    }
    
    private _updateFormat(view: powerbi.DataView): void {
        this._dirtyFormat = false;
        let cater = (r: R) => this.cat(r);
        let dirty = this.items.dirty('count') || this.roles.dirty();//we think the data is dirty/filtered
        let format = (view && view.metadata && view.metadata.objects) || {};
        for (let oname in this._FORMAT) {
            if (this._formatter[oname].update(cater, format[oname], dirty)) {
                this._dirtyFormat = true;
            }
        }       
    }

    public update(view: powerbi.DataView): void {
        this._cats = {};
        if (!this._view) {
            this._contentDirty = true;
        }
        else {
            this._contentDirty = false;
            let olds = pick(this._catRoles.map(r => this.column(r)), c => c && c.values);
            let news = pick(this._catRoles.map(r => this.column(r, view)), c => c && c.values);
            if (olds.length === news.length) {
                let count = this.items.count;
                let step = Math.floor(Math.max(count / 10, 1));
                let idxs = sequence(0, olds.length);
                for (let i = 0; i < count; i += step) {
                    if (idxs.some(idx => olds[idx][i] !== news[idx][i])) {
                        this._contentDirty = true;
                        break;
                    }
                }
            }
            else {
                this._contentDirty = true;
            }
        }
        this.roles.update(view);
        this.items.update(view);
        this._updateFormat(view);
        //dirty rolw        
        // let sameData = !this.roles.dirty() && !this.items.dirty('count');
        this.selection.reset(this.items.highlights, !this.dirty('data'), !this._dirtyFormat);
        this._view = view;
    }
    private _contentDirty = false;

    public dirty(value: 'data' | 'format' | 'count' | 'role' | 'highlight' | 'content'): boolean {
        if (value === 'content') {
            return this._contentDirty;
        }
        if (value === 'data') {
            return this.roles.dirty() || this.items.dirty() || this._contentDirty;
        }
        else if (value === 'format') {
            return this._dirtyFormat;
        }
        else if (value === 'role') {
            return this.roles.dirty();
        }
        else {
            return this.items.dirty(value);
        }
    }

    public inser<K extends keyof F>(oname: K, override?: F[K]): Instances<F[K]> {
        return new Instances(this._formatter[oname], override);
    }

    public property<T extends keyof F, K extends keyof F[T]>(oname: T, pname: K): Func<number | string, F[T][K]> {
        return this._formatter[oname].property<T>(pname) as any;
    }

    public ids(rows: number[], role?: R): ISelectionId[] {
        let column = this.roles.column(role);
        return rows.map(r => host.id(column, r));
    }

    public value<T>(role: R): Func<number, T> {
        let vals = this.column(role) && this.column(role).values;
        return vals ? r => vals[r] : r => null;
    }

    public group(...roles: R[]): number[][] {
        if (roles.every(r => !this.exist(r))) {
            return [this.rows()];
        }
        let keys = [] as Func<number, string>[];
        for (let r of roles) {
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