import powerbi from "powerbi-visuals-api";
import { Roles } from './Roles';
import { Category } from './Category';
import { StringMap, sequence, Func, values, first, groupBy } from '../lava/type';
import { FormatManager, Config, FormatInstance, Binding, FormatDumper } from "./Format";
import { Persist } from "./Persist";


type FmtDict<R extends string, F> = { [P in keyof F]: FormatManager<R, F[P]> }

export type PColumn = powerbi.DataViewCategoricalColumn & { values: powerbi.PrimitiveValue[] };

export class Context<R extends string, F> {
    public readonly roles = new Roles<R>();
    public readonly fmt = {} as FmtDict<R, F>;
    public readonly host: powerbi.extensibility.visual.IVisualHost;

    private _view: powerbi.DataView;

    public palette(key: string): string {
        return this.host.colorPalette.getColor(key).value;
    }

    public isResizeVisualUpdateType(options: powerbi.extensibility.visual.VisualUpdateOptions): boolean {
        return options.type === 4 || options.type === 32 || options.type === 36;
    }

    public persist<O extends keyof F, P extends keyof F[O]>(oname: O, pname: P, v: F[O][P]) {
        this.host.persistProperties({
            merge: [{
                objectName: oname as string,
                properties: { [pname]: v },
                selector: null
            }]
        });
    }

    original<O extends keyof F>(oname: O): F[O];
    original<O extends keyof F, P extends keyof F[O]>(oname: O, pname: P): F[O][P];
    original(oname: string, pname?: string): any {
        const view = this._view;
        if (view && view.metadata && view.metadata.objects) {
            const obj = view.metadata.objects[oname];
            if (pname) {
                return (obj || {})[pname];
            }
            else {
                return obj;
            }
        }
        return undefined;
    }

    public binding<O extends keyof F, P extends keyof F[O]>(oname: O, pname: P): Binding<F[O], R> {
        return this.fmt[oname].binding(pname);
    }

    public dumper<O extends keyof F>(oname: O): FormatDumper<F[O]> {
        return this.fmt[oname].dumper();
    }

    public labels<O>(binding: Binding<O, R>, values: StringMap<any>): FormatInstance[] {
        if (!this.cat(binding.role)) {
            return [];
        }
        const role = binding.role, group = this.item(binding.fmt.oname as any, binding.pname as any) as any;
        const result = [] as FormatInstance[];
        const cat = this.cat(role), rows = cat.distincts(), key = cat.key;
        const labels = cat.row2label(rows), key2rows = groupBy(rows, group);
        for (const k in key2rows) {
            const rows = key2rows[k], row = first(rows, r => key(r) in values);
            if (row !== undefined) {
                result.push({ row, value: values[key(row)], name: rows.map(r => labels[r]).join(','), key: k });
            }
            else {
                result.push({ row: rows[0], name: rows.map(r => labels[r]).join(','), key: k });
            }
        }
        result.forEach(r => r.auto = r.name);
        return result;
    }

    public config<O extends keyof F, P extends keyof F[O]>(oname: O, pname: P): Config<F[O][P]> {
        return this.fmt[oname].config(pname);
    }

    public item<O extends keyof F, P extends keyof F[O]>(oname: O, pname: P) {
        return this.fmt[oname].item(pname);
    }

    public dirty(onames?: (keyof F)[]): boolean {
        if (onames === undefined) {
            for (const k in this.fmt) {
                if (this.fmt[k].dirty()) {
                    return true;
                }
            }
        }
        else {
            for (const k of onames) {
                if (this.fmt[k].dirty()) {
                    return true;
                }
            }
        }
        return false;
    }

    public data<T = powerbi.PrimitiveValue>(r: R): T[] {
        const c = first(this._view.categorical.values, c => c.source.roles[r], null)
            || first(this._view.categorical.categories, c => c.source.roles[r], null);
        return c ? c.values as any : null;
    }

    public nums(r: R): number[] {
        return this.data<number>(r);
    }

    public strs(r: R): string[] {
        return this.data<string>(r);
    }

    columns(role: R, view?: powerbi.DataView): PColumn[] {
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

    constructor(host: powerbi.extensibility.visual.IVisualHost, dft: F) {
        Persist.HOST = host;
        this.host = host;
        this._catCache = {};
        for (const oname in dft) {
            this.fmt[oname] = new FormatManager(oname, dft[oname], this);
        }
    }

    public group(...roles: R[]): number[][] {
        if (roles.every(r => !this.cat(r))) {
            return [this.rows()];
        }
        const keys = [] as Func<number, string>[];
        for (let r of roles) {
            if (this.cat(r)) {
                keys.push(this.cat(r).key);
            }
        }
        const id = keys.length === 1 ? keys[0] : (r: number) => keys.map(k => k(r)).join(' ');;
        let cache = {} as StringMap<number[]>;
        for (let row of this.rows()) {
            const key = id(row);
            let rows = cache[key];
            if (!rows) {
                rows = cache[key] = [];
            }
            rows.push(row);
        }
        return values(cache);
    }

    public rows() {
        if (this._rows !== null) {
            return this._rows;
        }
        if (this._view && this._view.categorical.categories[0]) {
            this._rows = sequence(0, this._view.categorical.categories[0].values.length);
        }
        else {
            this._rows = [];
        }
        return this._rows;
    }

    private _rows: number[];

    private _fmt: { [P in keyof F]: Readonly<F[P]> };
    public get meta(): Readonly<{ [P in keyof F]: Readonly<F[P]> }> {
        return this._fmt;
    }

    public update(view: powerbi.DataView): this {
        this._view = view;
        this._catCache = {};
        this._rows = null;
        //update other things below
        this.roles.update(view);
        const format = (view.metadata.objects || {}) as any as F;
        this._fmt = {} as any;
        for (const oname in this.fmt) {
            this._fmt[oname] = this.fmt[oname].update(format[oname]);
        }
        return this;
    }

    public reader<T = powerbi.PrimitiveValue>(r: R): Func<number, T> {
        let c = first(this._view.categorical.values, c => c.source.roles[r], null)
            || first(this._view.categorical.categories, c => c.source.roles[r], null);
        if (c) {
            return r => (c.values[r] as any as T);
        }
        else {
            return null;
        }
    }

    public key(...roles: R[]): Func<number, string> {
        if (roles.length === 1) {
            if (this.cat(roles[0])) {
                return this.cat(roles[0]).key;
            }
            else {
                return r => "";
            }
        }
        roles = roles.filter(r => this.cat(r));
        const keys = roles.map(r => this.cat(r).key);
        return r => keys.map(k => k(r)).join('_');
    }

    public type(r: R): powerbi.ValueTypeDescriptor {
        if (this.cat(r)) {
            return this.cat(r).column.source.type;
        }
        else {
            return {};
        }
    }

    private _catCache: StringMap<Category>;
    public cat(r: R): Category {
        if (r in this._catCache) {
            return this._catCache[r];
        }
        else {
            const column = this.roles.column(r);
            if (column) {
                return this._catCache[r] = new Category(column, this.host);
            }
            else {
                return this._catCache[r] = null;
            }
        }
    }
}