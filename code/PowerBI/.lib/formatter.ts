/// <reference path="../.api/v1.6.0/PowerBI-visuals.d.ts" />
import { Category } from './data';
import { Func, StringMap, pick, values, keys, copy } from "type";
import { host } from "./host";

type Instance = powerbi.VisualObjectInstance;

export interface IFormatter<T> {
    bind(role: string, pname: keyof T, toggle: keyof T | boolean);
    values: T;
    defaults: T;
    dirty(...pnames: (keyof T)[]): boolean;
    persist<P extends keyof T>(meta: P, value: T[P]): void;
    reverted: boolean;
    property<P>(pname: keyof T): Func<number | string, P>;
}

interface Binding<T> {
    default?: T,
    special?: StringMap<T>,
    indexes?: StringMap<number>,
    active?: boolean,
    role: string,
    toggle: string | boolean
}

export class Formatter<T> implements IFormatter<T> {
    public oname      : string;
    private _default  : T;
    private _curr     = {} as T;
    private _cater    : Func<string, Category>;
    private _dirty    = {} as StringMap<boolean>;
    private _reverted = false;
    private _binds    = {} as StringMap<Binding<any>>;
    constructor(oname: string, deft: T) {
        this.oname    = oname;
        this._default = deft;
        copy(deft, this._curr);
        this._binds   = {};
    }

    public bind(role: string, pname: keyof T, toggle: keyof T | boolean) {
        if (!this._binds[pname] || this._binds[pname].role !== role) {
            this._binds[pname] = { role, toggle } as any;
        }
        if (typeof toggle === 'boolean') {
            this._binds[pname].active = toggle as boolean;
        }
    }

    public persist<P extends keyof T>(meta: P, value: T[P]): void {
        var props = {} as any;
        props[meta] = value;
        host.persist(this.oname, props);
    }

    private _active(toggle: string | boolean): boolean {
        if (typeof toggle === 'boolean') {
            return toggle;
        }
        else {
            return this._curr[toggle] as boolean;
        }
    }
   
    public get reverted(): boolean {
        return this._reverted;
    }

    public dirty(...pnames: (keyof T)[]): boolean {
        if (!pnames || pnames.length === 0) {
            // console.log('dirty marks of ' + this.oname, keys(this._dirty));
            return keys(this._dirty).length > 0;
        }
        else {
            for (var n of pnames) {
                if (n in this._dirty) {
                    return true;
                }
            }
            return false;
        }
    }

    public get values() {
        return this._curr;
    }
    
    public get defaults() {
        return this._default;
    }

    public update(cater: Func<string, Category>, format: Partial<T>, dirtyData = false): boolean {
        this._cater = cater;
        var dirty = {} as StringMap<true>;
        var persistance = {
            merge: [], remove: []
        } as powerbi.VisualObjectInstancesToPersist;
        var revertCnt = 0, emptyCnt = 0;

        for (var v in this._updateMeta(format || {})) {
            dirty[v as any] = true;
        }
        // if (this.oname === 'advance') {
        //     debugger;
        // }
        for (var pname in this._binds) {
            var binding = this._binds[pname];
            var { role, toggle, special } = binding;
            var cat = cater(role);
            var dft = binding.default = this._curr[pname];
            if (!cat || !cat.column) {
                //column is removed
                if (special) {
                    if (values(special).some(v => this._diff(v, dft))) {
                        dirty[pname] = true;
                    }
                    revertCnt++;
                    delete binding.special;
                    delete binding.indexes;
                }
                else {
                    emptyCnt++;
                }
                binding.active = this._active(toggle);
                continue;
            }
            //column still existing
            if (special && binding.active && !this._active(toggle)) {
                //check turn off durty
                if (values(special).some(v => this._diff(v, dft))) {
                    dirty[pname] = true;
                }
            }
            var objectArray = cat.column.objects;
            var row2Props = {} as StringMap<any>;
            if (dirtyData && special) {
                var property = (v: any) => {
                    var ret = {};
                    ret[pname] = v['solid'] ? v['solid']['color'] : v;
                    return ret;
                };
                var mark = copy(special);
                for (var i = 0; i < cat.column.values.length; i++) {
                    var key = cat.key(i);
                    if (key in mark) {
                        row2Props[i] = special[key];
                        persistance.merge.push({
                            objectName: this.oname,
                            properties: property(special[key]),
                            selector: cat.id(i).getSelector()
                        });
                        delete mark[key];
                    }
                    else if (objectArray && i in objectArray) {
                        var obj = objectArray[i][this.oname];
                        if (obj && pname in obj) {
                            persistance.remove.push({
                                objectName: this.oname,
                                properties: property(special[key]),
                                selector: cat.id(i).getSelector()
                            });
                        }
                    }
                }
            }
            else if (objectArray) {
                for (var row in objectArray) {
                    var obj = objectArray[row][this.oname];
                    if (obj && pname in obj) {
                        row2Props[row] = obj[pname];
                    }
                }
            }

            if (keys(row2Props).length === 0) {
                if (special) {
                    if (values(special).some(v => this._diff(v, dft))) {
                        dirty[pname] = true;
                    }
                    revertCnt++;
                }
                else {
                    emptyCnt++;
                }
                delete binding.special;
                delete binding.indexes;

                binding.active = this._active(toggle);
                continue;
            }
            var keyOf = cat.key, propRows = keys(row2Props);
            if (this._active(toggle) && !dirty[pname]) {//check dirty
                if (special) {
                    if (propRows.length !== keys(special).length) {
                        dirty[pname] = true;
                    }
                    else {
                        for (var r of propRows) {
                            if (this._diff(special[keyOf(+r)], row2Props[r])) {
                                dirty[pname] = true;
                                break;
                            }
                        }
                    }
                }
                else if (values(row2Props).some(v => this._diff(v, dft))) {
                    dirty[pname] = true;
                }
            }

            binding.special = {};
            binding.indexes = {};
            for (var r in row2Props) {
                var key = keyOf(+r);
                binding.special[key] = row2Props[r];
                binding.indexes[key] = +r;
            }
            binding.active = this._active(toggle);
        }
        
        this._reverted = false;
        if (format === undefined) {
            var total = keys(this._binds).length;
            if (total === 0) {
                this._reverted = true;
            }
            else if (revertCnt > 0 && emptyCnt + revertCnt === total) {
                // console.log('reverted.............', this.oname);
                this._reverted = true;
            }
        }

        this._dirty = dirty;
        this.persistance = persistance;
        return keys(this._dirty).length > 0;
    }

    public persistance: powerbi.VisualObjectInstancesToPersist;

    private _diff(a: any, b: any): boolean {
        if (a && a.solid && b && b.solid) {
            return a.solid.color !== b.solid.color;
        }
        else {
            return a !== b;
        }
    }
    
    private _custom(cat: Category, oname: string, pname: string): StringMap<any> {
        var arr = cat.column.objects, ret = {} as StringMap<any>;
        for (var row in arr) {
            var obj = arr[row][oname];
            if (obj && pname in obj) {
                ret[+row] = obj[pname];
            }
        }
        return ret;
    }
        
    private _updateMeta(props: any): Partial<T> {
        var diff = {} as Partial<T>;
        var curr = {} as T;
        // console.log(this._curr, props);
        for (var key in this._default) {
            var dft = this._default[key] as any;
            if (!(key in props)) {
                curr[key] = dft;
                if (this._diff(dft, this._curr[key])) {
                    diff[key] = dft;
                }
            }
            else {
                var v = props[key];
                curr[key] = v;
                if (this._diff(this._curr[key], v)) {
                    diff[key] = v;
                }
            }
        }
        // if (keys(diff).length > 0) {
        //     console.log('dirty found:', this.oname, keys(diff));
        // }
        this._curr = curr;
        return diff;
    }

    public resetDefault(props: Partial<T>): void {
        for (var v in props) {
            this._default[v] = props[v];
        }
    }

    public cat(role: string): Category {
        return this._cater(role);
    }

    public property<P>(pname: string): (rowOrKey: number | string) => P {
        var { default: dft, special, role, active } = this._binds[pname];
        if (!active) {
            return v => dft as any;
        }
        if (special && keys(special).length) {
            var keyof = this.cat(role).key;
            return v => {
                var key = typeof v === 'number' ? keyof(v) : v;
                if (key === null)
                    return dft as any;
                else {
                    var val = special[key];
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
    constructor(fmt: Formatter<T>) {
        this._fmt = fmt;
    }

    public conditionalMeta(toggle: keyof T | boolean, fields: (keyof T)[], manual?: Partial<T>) {
        var values = {} as Partial<T>;
        var properties = () => {
            for (var k of fields) {
                values[k] = manual ? (manual[k] || this._fmt.values[k]) : this._fmt.values[k];
            }
        };
        if (typeof toggle === 'boolean') {
            toggle && properties();
        }
        else {
            values[toggle] = this._fmt.values[toggle];
            this._fmt.values[toggle] && properties();
        }
        this._dump.push({
            objectName: this._fmt.oname,
            properties: values as any,
            selector: null
        });
        return this;
    }
    public meta(fields?: (keyof T)[], override?: Partial<T>): this {
        var values = this._fmt.values;
        if (fields) {
            values = pick(values, fields) as any;
            if (override) {
                for (var k in values) {
                    if (k in override) {
                        values[k] = override[k];
                    }
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

    public items(pname: keyof T, rows?: number[], placeholder?: Func<number, any>): this {
        var binding = this._fmt.binding(pname);
        if (!binding) {
            return this;
        }
        var { role, toggle, default: dft, special } = binding;
        var cat = this._fmt.cat(role), keyof = cat.key;
        if (!cat || !cat.column) {
            return this;
        }
        if (typeof toggle === 'string') {
            this._dump.push({
                objectName: this._fmt.oname,
                selector: null,
                properties: pick(this._fmt.values as any, [toggle])
            });
            if (!this._fmt.values[toggle]) {
                return this;
            }
        }
        else if (!toggle) {
            return this;
        }
        rows = rows || cat.distincts();
        var labels = cat.labels(rows);

        var property = (row: number) => {
            var p = {} as any;
            var key = keyof(row);
            if (special && key in special) {
                p[pname] = special[key];
            }
            else {
                p[pname] = placeholder ? placeholder(row) : dft;
            }
            return p;
        };
        for (var i = 0; i < rows.length; i++){
            this._dump.push({
                objectName: this._fmt.oname,
                displayName: "• " + labels[i],
                selector: host.id(cat.column, rows[i]).getSelector(),
                properties: property(rows[i])
            });
        }
        return this;
    }

    public dump(): Instance[] {
        if (this._dump.length === 0) {
            this.meta();
        }
        return this._dump;
    }
}
