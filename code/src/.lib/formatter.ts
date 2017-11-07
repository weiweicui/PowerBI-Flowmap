import { Category } from './data';
import { Func, StringMap, partial, values, keys, copy, pick, dict, find } from "type";
import { host, Persist } from "./host";
import { groupBy, obj } from './misc';

type Instance = powerbi.VisualObjectInstance;

export interface IFormatter<T> {
    bind<R extends string>(role: R, pname: keyof T, toggle: keyof T | boolean);
    meta: T;
    defaults: T;
    dirty(): StringMap<true>;
    dirty(...pnames: (keyof T)[]): boolean;
    persist<P extends keyof T>(meta: P, value: T[P]): void;
    property<K extends keyof T>(pname: K, deft?: T[K]): Func<number | string, T[K]>;
    flip(pname: keyof T): 'on' | 'off' | false;
}

interface Binding<T> {
    default?: T,
    special?: StringMap<T>,
    active?: boolean,
    role: string,
    toggle: string | boolean
}

export class Formatter<T> implements IFormatter<T> {
    public oname      : string;
    private _default  : T;
    private _meta     = {} as T;
    private _cater    : Func<string, Category>;
    private _dirty    = {} as StringMap<true>;
    private _binds    = {} as StringMap<Binding<any>>;
    
    private _persist  = null as Persist<StringMap<string>>;
    constructor(oname: string, deft: T) {
        this.oname    = oname;
        this._default = deft;
        copy(deft, this._meta);
        this._binds   = {};
    }

    public flip(pname: keyof T): 'on' | 'off' | false {
        if (this.dirty(pname)) {
            return this._meta[pname] ? 'on' : 'off';
        }
        else {
            return false;
        }
    }

    public bind(role: string, pname: keyof T, toggle: keyof T | boolean) {
        if (!this._persist) {
            //the key 'persist' is hardcoded, capabilities.json mush have it as well
            this._persist = new Persist<StringMap<string>>(this.oname, 'persist');
        }
        if (!this._binds[pname]) {
            this._binds[pname] = { role, toggle } as any;
        }
        else if (this._binds[pname].role !== role) {
            this._binds[pname].role = role;
            this._binds[pname].toggle = toggle;
        }
        if (typeof toggle === 'boolean') {
            this._binds[pname].active = toggle as boolean;
        }
    }

    public init(view: powerbi.DataView) {
        if (this._persist) {
            let dict = this._persist.read(view, {});
            for (let pname in dict) {
                if (pname in this._binds) {
                    this._binds[pname].special = JSON.parse(dict[pname]);
                    console.log(this._binds[pname].special, 'special for', this.oname, pname);
                }
            }
        }
        if (view && view.metadata && view.metadata.objects) {
            let obj = view.metadata.objects[this.oname] || {};
            for (let key in obj) {
                if (key in this._meta) {
                    this._meta[key] = obj[key];
                }
            }
        }
    }

    public persist<P extends keyof T>(meta: P, value: T[P]): void {
        let props = {} as any;
        props[meta] = value;
        host.persist(this.oname, props);
    }

    private _active(toggle: string | boolean): boolean {
        if (typeof toggle === 'boolean') {
            return toggle;
        }
        else {
            return this._meta[toggle] as boolean;
        }
    }
   
    public dirty(): StringMap<true>;
    public dirty(...pnames: (keyof T)[]): boolean;
    public dirty(...pnames: (keyof T)[]): StringMap<true> | boolean {
        if (!pnames || pnames.length === 0) {
            return this._dirty;
        }
        else if (!this._dirty) {
            return false;
        }
        else {
            return pnames.some(p => p in this._dirty);
        }
    }

    public get meta() {
        return this._meta;
    }
    
    public get defaults() {
        return this._default;
    }

    public update(cater: Func<string, Category>, format: Partial<T>, dirtyData = false): boolean {
        this._cater = cater;
        let dirty = this._dirty = {} as StringMap<true>;
        for (let v in this._updateMeta(format || {})) {
            dirty[v as any] = true;
        }
        for (let pname in this._binds) {
            let binding = this._binds[pname];
            let dft = binding.default = this._meta[pname];
            let { role, toggle, special } = binding;
            let cat = cater(role);
            let setDirtyIfNotDefault = (vals: StringMap<any>) => {
                if (!dirty[pname] && vals) {
                    if (values(vals).some(v => this._diff(v, dft))) {
                        dirty[pname] = true;
                    }
                }
            }
            if (!cat || !cat.column) {
                //reverted or column-removed
                setDirtyIfNotDefault(special);
                delete binding.special;
                binding.active = this._active(toggle);
                continue;
            }
            //column still exists and not reverted to default
            if (binding.active && !this._active(toggle)) {
                //turn off, so update dirty
                setDirtyIfNotDefault(special);
            }

            let objArray = cat.column.objects || {};
            let custom = {} as StringMap<any>;
            let reverted = !dirtyData;//if data is dirty, not reverted
            for (let row in objArray) {
                let obj = objArray[row][this.oname];
                if (obj) {
                    reverted = false;
                    if (pname in obj) {
                        //cannot use obj[pname], because "" is false
                        let key = cat.key(+row);
                        if (!(key in custom)) {
                            custom[key] = obj[pname];
                        }
                    }
                }    
            }
            special = special || {};
            for (let key in custom) {
                if (this._diff(special[key], custom[key])) {
                    this._dirty[pname] = true;
                }
                special[key] = custom[key];
            }
            if (!format && reverted) {
                setDirtyIfNotDefault(special);
                delete binding.special;
            }
            else {
                if (keys(special).length > 0) {
                    binding.special = special;
                }
                else {
                    delete binding.special;
                }
            }
            binding.active = this._active(toggle);
        }//end for each pname

        if (!this._persist) {
            return keys(this._dirty).length > 0;
        }
        let all = this._persist.value() || {}, diff = false;
        for (let pname in this._binds) {
            if (!this._binds[pname].special) {
                delete all[pname];
            }
        }
        for (let pname in this._binds) {
            let special = this._binds[pname].special;
            if (special) {
                let dump = this._json(special);
                if (dump !== all[pname]) {
                    diff = true;
                    all[pname] = dump;                        
                }
            }
        }
        // if (diff) {
        //     console.log(this.oname, JSON.stringify(all), '<<<>>>', JSON.stringify(this._persist.value()));
        // }
        diff && this._persist.write(all, 10);
        let len = keys(this._dirty).length;
        if (len > 0) {
            return true;
        }
        else {
            this._dirty = null;
            return false;
        }
    }

    private _json(dict: StringMap<any>): string {
        let sorted = Object.keys(dict).sort();
        return JSON.stringify(sorted.reduce((r, k) => (r[k] = dict[k], r), {}));
    }
    
    private _diff(a: any, b: any): boolean {
        if (a && a.solid && b && b.solid) {
            return a.solid.color !== b.solid.color;
        }
        else {
            return a !== b;
        }
    }
        
    private _updateMeta(meta: any): Partial<T> {
        let diff = {} as Partial<T>;
        // console.log(this._curr, props);
        for (let key in this._default) {
            let dft = this._default[key] as any;
            if (!(key in meta)) {
                if (this._diff(dft, this._meta[key])) {
                    diff[key] = dft;
                }
                this._meta[key] = dft;
            }
            else {
                let v = meta[key];
                if (this._diff(this._meta[key], v)) {
                    diff[key] = v;
                }
                this._meta[key] = v;
            }
        }
        // if (keys(diff).length > 0) {
        //     console.log('dirty found:', this.oname, keys(diff));
        // }
        return diff;
    }

    public resetDefault(props: Partial<T>): void {
        for (let v in props) {
            this._default[v] = props[v];
        }
    }

    public cat(role: string): Category {
        return this._cater(role);
    }

    public property<P>(pname: string, deft?: P): (rowOrKey: number | string) => P {
        let { default: dft, special, role, active } = this._binds[pname];
        dft = deft === undefined ? dft : deft;
        if (!active) {
            return v => dft as any;
        }
        if (special && keys(special).length) {
            let keyof = this.cat(role).key;
            return v => {
                let key = typeof v === 'number' ? keyof(v) : v;
                if (key === null)
                    return dft as any;
                else {
                    let val = special[key];
                    return val === undefined ? dft : val;
                }
            }
        }
        else {
            return v => dft as any;
        }
    }

    public binding<P>(pname: string): Binding<P> {
        return this._binds[pname] as any;
    }
}

export class Instances<T> {
    private _fmt: Formatter<T>;
    private _dump = [] as Instance[];
    private _override = {};
    constructor(fmt: Formatter<T>, override: T) {
        this._override = override;
        this._fmt = fmt;
    }
    
    private _meta(fields?: (keyof T)[], override?: Partial<T>): this {
        override = override || this._override;
        let values = this._fmt.meta;
        if (fields) {
            values = partial(values, fields) as any;
            for (let k of fields) {
                if (override && k in override) {
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

    public items(pname: keyof T, rows?: number[], group?: Func<number, any>, autofill?: boolean | Func<number, any>): this {
        let binding = this._fmt.binding(pname);
        if (!binding) {
            debugger;//should be a bug
        }
        let { role, toggle, default: dft, special } = binding;
        let cat = this._fmt.cat(role), keyof = cat.key;
        rows = rows ? cat.distincts(rows) : cat.distincts();
        group = group || keyof;
        let row2Label = cat.row2label(rows), key2rows = groupBy(rows, group);
        let property = (row: number, fallback: any) => {
            let ret = {} as any;
            let key = keyof(row);
            if (special && key in special) {
                ret[pname] = special[key];
            }
            else {
                ret[pname] = fallback;
            }
            return ret;
        };
        for (let key in key2rows) {
            let rows = key2rows[key], row = rows[0];
            if (special) {
                row = find(rows, r => keyof(+r) in special) || row;
            }
            let name = rows.map(r => row2Label[r]).join(',');
            this._dump.push({
                objectName: this._fmt.oname,
                displayName: '• ' + name,
                selector: cat.id(row).getSelector(),
                properties: property(row, autofill ? (typeof autofill === 'boolean' ? name : autofill(row)) : dft)
            });
        }
        return this;
    }

    public custom(pname: keyof T, rows?: number[], group?: Func<number, any>): this {
        let binding = this._fmt.binding(pname);
        if (!binding) {
            debugger;//should be a bug
        }
        let { role, toggle, default: dft, special } = binding;

        if (typeof toggle === 'string') {
            this._dump.push({
                objectName: this._fmt.oname,
                selector: null,
                properties: partial(this._fmt.meta as any, [toggle])
            });
            if (!this._fmt.meta[toggle]) {
                return this;
            }
        }
        else if (!toggle) {
            return this;
        }
        return this.items(pname, rows, group);
    }

    public meta(toggle: keyof T | boolean, fields: (keyof T)[], override?: Partial<T>): this;
    public meta(fields: (keyof T)[], override?: Partial<T>): this;
    meta(a: any, b?: any, c?: any) {
        if (typeof a === 'string' || typeof a === 'boolean') {
            let toggle = a, fields = b, override = c || this._override;
            let value = (k: keyof T) => override && k in override ? override[k] : this._fmt.meta[k];
            if (typeof toggle === 'boolean') {
                toggle && this._dump.push({
                    objectName: this._fmt.oname,
                    properties: dict(fields, (f: any) => f, f => value(f)) as any,
                    selector: null
                });
            }
            else {
                if (this._fmt.meta[toggle]) {
                    fields = [toggle].concat(fields);
                }
                else {
                    fields = [toggle];
                }
                this._dump.push({
                    objectName: this._fmt.oname,
                    properties: dict(fields, (f: any) => f, f => value(f)) as any,
                    selector: null
                });
            }
            return this;
        }
        else {
            this._meta(a, b);
        }
        return this;
    }

    public add(field: keyof T, value: powerbi.DataViewPropertyValue): this;
    public add(ins: powerbi.VisualObjectInstance): this;
    add(a: any, b?: any): this {
        if (b === undefined) {
            this._dump.push(a);            
        }
        else {
            let prop = {} as any;
            prop[a] = b;
            this._dump.push({
                objectName: this._fmt.oname,
                properties: prop,
                selector: null
            });
        }
        return this;
    }

    public dump(): Instance[] {
        if (this._dump.length === 0) {
            this._meta();
        }
        return this._dump;
    }
}