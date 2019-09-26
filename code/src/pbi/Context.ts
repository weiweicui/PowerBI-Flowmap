import powerbi from "powerbi-visuals-api";
import { Roles } from './Roles';
import { Category } from './Category';
import { StringMap, sequence, Func, values, first } from '../lava/type';
import { Format } from "./Format";
import { Persist } from "./Persist";


type FmtDict<R extends string, F> = { [P in keyof F]: Format<R, F[P]> }

export type PColumn = powerbi.DataViewCategoricalColumn & { values: powerbi.PrimitiveValue[] };

export class Context<R extends string, F> {
    public readonly roles = new Roles<R>();
    public readonly fmt = {} as FmtDict<R, F>;
    public readonly host: powerbi.extensibility.visual.IVisualHost;
    
    private _view: powerbi.DataView;

    public persist<O extends keyof F, P extends keyof F[O]>(oname: O, pname: P, v: F[O][P]) {
        this.host.persistProperties({
            merge: [{
                objectName: oname as string,
                properties: { [pname]: v },
                selector: null
            }]
        });
    }

    public dirtyFormat(onames?: (keyof F)[]): boolean {
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
            this.fmt[oname] = new Format(oname, dft[oname], this);
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

    public update(view: powerbi.DataView) {
        this._view = view;
        this._catCache = {};
        this._rows = null;
        //update other things below
        this.roles.update(view);
        const format = (view.metadata.objects || {}) as any as F;
        for (const oname in this.fmt) {
            this.fmt[oname].update(format[oname]);
        }
    }

    config<O extends keyof F>(oname: O): F[O];
    config<O extends keyof F>(...oname: O[]): F[O][];
    public config<O extends keyof F>(_: O | O[]): any {
        if (typeof _ === 'string') {
            return this.fmt[_ as keyof F].partial();
        }
        else {
            return (_ as (keyof F)[]).map(o => this.fmt[o].partial());
        }
    }
    
    // public object<P extends keyof F>(oname: P): Partial<F[P]> {
    //     if (this._view && this._view.metadata && this._view.metadata.objects) {
    //         return this._view.metadata.objects[oname as any] as any;
    //     }
    //     return undefined;
    // }

    public value(r: R): Func<number, powerbi.PrimitiveValue> {
        let c = first(this._view.categorical.values, c => c.source.roles[r], null)
            || first(this._view.categorical.categories, c => c.source.roles[r], null);
        if (c) {
            return r => c.values[r];
        }
        else {
            return null;
        }
    }

    public key(...roles: R[]): Func<number, string> {
        if (roles.length === 1) {
            return this.cat(roles[0]).key;
        }
        roles = roles.filter(r => this.cat(r));
        const keys = roles.map(r => this.cat(r).key);
        return r => keys.map(k => k(r)).join('_');
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