import * as deepmerge from 'deepmerge';
import powerbi from 'powerbi-visuals-api';
import { StringMap, Func, partial, keys } from '../lava/type';
import { Persist } from './Persist';
import { Category } from './Category';
import { Context } from './Context';
import * as deepequal from 'fast-deep-equal';
import * as clone from 'clone';
type Instance = powerbi.VisualObjectInstance;

interface Binding<O, R extends string> {
    role: R,
    toggle: keyof O | boolean
}

type Mark<T, V = true> = { [P in keyof T]?: V; }

export type Fmt<T> = T extends { solid: { color: string } } ? string : T;

export class Format<R extends string, O> {
    persist<P extends keyof O>(meta: P, value: O[P]): void {
        this.ctx.persist(this.oname, meta, value);
    }

    public property<P extends keyof O>(pname: P, auto?: Fmt<O[P]> | Func<string, Fmt<O[P]>>): Func<string | number, Fmt<O[P]>> {
        const defaultValue = this.value(pname);
        if (pname in this._binds) {
            const { toggle, role } = this._binds[pname];
            const cat = this.ctx.cat(role);
            if (!cat) {
                return _ => defaultValue;
            }

            const key = cat.key;
            const autoFunc = (v: string | number) => {
                if (auto === undefined) {
                    return defaultValue;
                }
                if (auto && typeof auto === 'function') {
                    const id = typeof v === 'number' ? key(v) : v;
                    return (auto as Func<string, Fmt<O[P]>>)(id);
                }
                else {
                    return auto as Fmt<O[P]>;
                }
            }
            const special = this.special(pname);
            const func = (v: string | number) => {
                const id = typeof v === 'number' ? key(v) : v;
                if (id === undefined || id === null) {
                    return defaultValue;
                }
                else if (id in special) {
                    if (special[id] && typeof special[id] === 'object' && 'solid' in special[id]) {
                        return special[id]['solid']['color'];
                    }
                    else {
                        return special[id];
                    }
                }
                else {
                    return autoFunc(id);
                }
            };
            if (typeof toggle === 'boolean') {
                if (!toggle || (!keys(special).length && !auto)) {
                    return v => defaultValue;
                }
                else {
                    return func;
                }
            }
            else if (!this.value(toggle) || (!keys(special).length && !auto)) {
                return _ => defaultValue;
            }
            else {
                return func;
            }
        }
        else {
            return _ => defaultValue;
        }
    }

    public readonly oname: string;
    private _default: O;
    private _meta = null as Partial<O>;
    private _binds = {} as Mark<O, Binding<O, R>>;
    private _persist = null as Persist<StringMap<any>>;

    private _dirty = null as Mark<O>;

    public readonly ctx = null as Context<R, any>;
    constructor(oname: string, deft: O, ctx: Context<R, any>) {
        this.oname = oname;
        this._default = deft;
        this.ctx = ctx;
    }

    public binding<P extends keyof O>(pname: P): Readonly<Binding<O, R>> {
        return this._binds[pname];
    }

    private _diff(a: any, b: any): boolean {
        if (typeof a === 'object' && a && a.solid && b && b.solid) {
            return a.solid.color !== b.solid.color;
        }
        else {
            return a !== b;
        }
    }

    public value<P extends keyof O>(pname: P): Fmt<O[P]> {
        const raw = this._meta && pname in this._meta ? this._meta[pname] : this._default[pname];
        if (raw && typeof raw === 'object' && 'solid' in raw) {
            return raw['solid']['color'];
        }
        return raw as Fmt<O[P]>;
    }

    public special<P extends keyof O>(pname: P): StringMap<O[P]> {
        const values = this._persist && this._persist.value();
        return (values && values[pname as string]) || {};
    }
    // public special(pname: keyof O): StringMap<any> {
    //     const values = this._persist && this._persist.value();
    //     return (values && values[pname as string]) || {};
    // }

    public partial(pnames?: (keyof O)[]): Partial<O> {
        const all = deepmerge<O>(this._default, this._meta || {});
        return pnames ? partial(all, pnames) : all;
    }

    public instancer(override?: Partial<O>): InstanceBuilder<O> {
        return new InstanceBuilder(this, override);
    }

    //only meta boolean dirty will return 'on'/'off', otherwise return 
    dirty(pnames: (keyof O)[]): boolean;
    dirty(pname: keyof O): 'on' | 'off' | false;
    dirty(): boolean;
    public dirty(arr?: (keyof O)[] | keyof O): 'on' | 'off' | boolean {
        if (arr === undefined) {
            return Object.keys(this._dirty).length !== 0;
        }
        if (typeof arr === 'string') {
            if (this._binds[arr]) {
                return this._dirty[arr] ? true : false;
            }
            else if (this._dirty[arr]) {
                const value = this.value(arr) as any;
                return value === true ? 'on' : (value === false ? 'off' : true);
            }
            else {
                return false;
            }
        }
        else {
            for (const pname of arr as (keyof O)[]) {
                if (this.dirty(pname)) {
                    return true;
                }
            }
            return false;
        }
    }

    public objectInstances(): Instance[] {
        return [{
            objectName: this.oname,
            properties: this.partial(),
            selector: null
        }];
    }

    public bind(role: R, pname: keyof O, toggle: keyof O | boolean) {
        if (!this._persist) {
            //the key 'persist' is hardcoded, capabilities.json mush have it as well
            this._persist = new Persist<StringMap<any>>(this.oname, 'persist');
        }
        if (!this._binds[pname]) {
            this._binds[pname] = { role, toggle } as Binding<O, R>;
        }
        else {
            this._binds[pname].role = role;
            this._binds[pname].toggle = toggle;
        }
    }

    //undefined if not existing
    private _collect(cat: Category, pname: string): StringMap<any> {
        const result = {} as StringMap<any>;
        if (!cat || !cat.column) {
            return undefined;
        }
        const columnObjs = cat.column.objects || {};
        for (const row in columnObjs) {
            const obj = columnObjs[row] && columnObjs[row][this.oname];
            if (obj && pname in obj) {
                result[cat.key(+row)] = obj[pname];
            }
        }
        return Object.keys(result).length ? result : undefined;
    }

    private _cached = {} as Readonly<O>;

    public get meta(): Readonly<O> {
        return this._cached;
    }

    public update(format: Partial<O>): void {

        const newFormat = this._cached = deepmerge<O>(this._default, format || {});
        const oldFormat = deepmerge<O>(this._default, this._meta || {});
        this._meta = format;
        const dirty = this._dirty = {} as Mark<O>;
        for (const pname in this._default) {
            if (this._diff(newFormat[pname], oldFormat[pname])) {
                dirty[pname] = true;
            }
        }
        let itemChanged = false;
        const persist = clone(this._persist && this._persist.value() || {});
        for (const pname in this._binds) {
            const binding = this._binds[pname];
            const special = this._collect(this.ctx.cat(binding.role), pname);
            persist[pname] = persist[pname] || {};
            if (!special && !format) {
                if (Object.keys(persist[pname]).length) {
                    persist[pname] = {};
                    itemChanged = dirty[pname] = true;
                }
            }
            for (const k in special || {}) {
                if (!deepequal(persist[pname][k], special[k])) {
                    itemChanged = dirty[pname] = true;
                    persist[pname][k] = special[k];
                }
            }
        }
        if (itemChanged) {
            const dump = {} as StringMap<any>;
            for (const pname in this._binds) {
                if (Object.keys(persist[pname]).length) {
                    dump[pname] = persist[pname];
                }
            }
            if (Object.keys(dump).length) {
                this._persist.write(dump, 10);
            }
            else {
                this._persist.write(null, 10);
            }
        }
    }
}

function groupBy(rows: number[], group: Func<number, any>) {
    let result = {} as StringMap<number[]>;
    for (let r of rows) {
        let key = group(r);
        if (key in result) {
            result[key].push(r);
        }
        else {
            result[key] = [r];
        }
    }
    return result;
}

function first<T>(data: T[], p: Func<T, any>, dft?: T): T {
    for (let v of data) {
        if (p(v)) {
            return v;
        }
    }
    return dft;
}

export class InstanceBuilder<T> {
    private _fmt: Format<string, T>;
    private _dump = [] as Instance[];
    private _override = {};
    constructor(fmt: Format<string, T>, override?: Partial<T>) {
        this._override = override || {};
        this._fmt = fmt;
    }

    public metas(fields?: (keyof T)[], override?: Partial<T>): this {
        override = override || this._override;
        let values = this._fmt.partial(fields);
        if (fields) {
            for (let k of fields) {
                if (k in override) {
                    values[k] = override[k];
                }
            }
        }
        this._dump.push({
            objectName: this._fmt.oname,
            properties: values as any,
            selector: null
        });
        return this;
    }

    public add(ins: Instance): this {
        this._dump.push(ins);
        return this;
    }

    public items(pname: keyof T, rows?: number[], group?: Func<number, any>, autofill?: boolean | Func<number, any>): this {
        const binding = this._fmt.binding(pname);
        if (!binding) {
            debugger;//should be a bug
        }
        const special = this._fmt.special(pname);
        const cat = this._fmt.ctx.cat(binding.role);
        rows = cat.distincts(rows);
        const row2Label = cat.row2label(rows), key2rows = groupBy(rows, group || cat.key);
        const dft = this._fmt.value(pname);
        const property = (row: number, name: string) => {
            const key = cat.key(row);
            if (key in special) {
                return { [pname]: special[key] };
            }
            if (autofill) {
                return { [pname]: autofill === true ? name : autofill(row) };
            }
            else {
                return { [pname]: '' };
            }
        };

        for (let key in key2rows) {
            const rows = key2rows[key];
            const hitRow = first(rows, r => cat.key(+r) in special, rows[0]);
            const name = rows.map(r => row2Label[r]).join(',');
            this._dump.push({
                objectName: this._fmt.oname,
                displayName: '• ' + name,
                selector: cat.selector(hitRow),
                properties: property(hitRow, name)
            });
        }
        // if (this._fmt.oname === 'color') {
        //     console.log(JSON.stringify(this._dump));
        // }
        return this;
    }

    public conditionalItems(pname: keyof T, rows?: number[], group?: Func<number, any>): this {
        const binding = this._fmt.binding(pname);
        if (!binding) {
            debugger;//should be a bug
        }
        const { toggle } = binding;

        if (typeof toggle === 'string') {
            this._dump.push({
                objectName: this._fmt.oname,
                selector: null,
                properties: this._fmt.partial([toggle])
            });
            if (!this._fmt.value(toggle)) {
                return this;
            }
        }
        else if (!toggle) {
            return this;
        }
        return this.items(pname, rows, group, i => this._fmt.value(pname));
    }

    public conditionalMetas(toggle: keyof T | boolean, fields: (keyof T)[], override?: Partial<T>): this {
        if (!toggle) {
            return this;
        }
        let pnames = toggle === true ? [] : [toggle];
        if (toggle === true || this._fmt.value(toggle)) {
            pnames = pnames.concat(fields);
        }
        return this.metas(pnames, override);
    }

    public dump(): Instance[] {
        if (this._dump.length === 0) {
            this.metas();
        }
        return this._dump;
    }
}