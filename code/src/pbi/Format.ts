import * as deepmerge from 'deepmerge';
import powerbi from 'powerbi-visuals-api';
import { StringMap, Func, partial, copy } from '../lava/type';
import { Persist } from './Persist';
import { Category } from './Category';
import { Context } from './Context';
import * as deepequal from 'fast-deep-equal';
import * as clone from 'clone';
type Instance = powerbi.VisualObjectInstance;

export interface Binding<O, R extends string> {
  readonly role: R,
  readonly toggle: keyof O | true,
  readonly autofill?: keyof O,
  readonly pname: keyof O,
  readonly fmt: FormatManager<R, O>
}

type Mark<T, V = true> = { [P in keyof T]?: V; }

export type Config<T> = T extends { solid: { color: string } } ? string : T;

export type FormatInstance = { row: number, value?: any, name: string, key?: string, auto?: any };

export type Value<T> = Func<string | number, Config<T>>;

const __auto = {} as StringMap<any>;
const __deft = {} as StringMap<any>;
const __full = {} as StringMap<any>;

function meta<O>(fmt: FormatManager<any, O>): Readonly<O>;
function meta<O, P extends keyof O>(fmt: FormatManager<any, O>, pname: P): O[P];
function meta<O>(fmt: FormatManager<any, O>, pnames: (keyof O)[]): Partial<O>;
function meta<O>(fmt: FormatManager<any, O>, p?: any): any {
  if (p === undefined || p === null) {
    return copy(__full[fmt.oname]);
  }
  if (typeof p === 'string') {
    return __full[fmt.oname][p];
  }
  else {
    return partial(__full[fmt.oname], p);
  }
}

function metaItem<R extends string, O, P extends keyof O>(fmt: FormatManager<R, O>, pname: P): Func<string | number, O[P]> {
  const dft = meta(fmt, pname);
  if (!fmt.binding(pname)) {
    return () => dft;
  }
  const { toggle, role } = fmt.binding(pname);
  if (!__ctx.cat(role) || (toggle !== true && !meta(fmt, toggle))) {
    return _ => dft;
  }
  const special = fmt.special(pname), key = __ctx.cat(role).key;
  const autofill = __auto[fmt.oname][pname] ? __auto[fmt.oname][pname]() : null;
  return v => {
    const id = typeof v === 'number' ? key(v) : v;
    if (id === undefined || id === null) {
      return dft;
    }
    else if (id in special) {
      return special[id];
    }
    else if (autofill) {
      return autofill(id);
    }
    else {
      return dft;
    }
  }
}

let __ctx = null as Context<any, any>;

export class FormatManager<R extends string, O> {
  persist<P extends keyof O>(meta: P, value: O[P]): void {
    __ctx.persist(this.oname, meta, value);
  }

  public item<P extends keyof O>(pname: P): Func<string | number, Config<O[P]>> {
    const func = metaItem(this, pname);
    return v => this._bare(func(v));
  }

  public readonly oname: string;
  private _default: O;
  private _meta = null as Partial<O>;
  private _binds = {} as Mark<O, Binding<O, R>>;
  private _persist = null as Persist<StringMap<any>>;

  private _dirty = null as Mark<O>;


  constructor(oname: string, deft: O, ctx: Context<R, any>) {
    this.oname = oname;
    this._default = deft;
    __ctx = ctx;
    __auto[oname] = {};
    __deft[oname] = {};
    __full[oname] = {};
  }

  public binding<P extends keyof O>(pname: P): Binding<O, R> {
    return this._binds[pname];
  }

  public config<P extends keyof O>(pname: P): Config<O[P]> {
    return this._bare(this._full[pname]);
  }

  public special<P extends keyof O>(pname: P): Readonly<StringMap<O[P]>> {
    const values = this._persist && this._persist.value();
    return (values && values[pname as string]) || {};
  }

  public dumper(): FormatDumper<O> {
    return new FormatDumper(this);
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
        const value = this.config(arr) as any;
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

  private _bare<T>(v: T): Config<T> {
    if (v && typeof v === 'object' && 'solid' in v) {
      return v['solid']['color'];
    }
    return v as Config<T>;
  }

  private get _auto(): { [key in keyof O]: Func<void, Func<number | string, O[key]>> } { return __auto[this.oname]; }
  private get _deft(): { [key in keyof O]: Func<void, O[key]> } { return __deft[this.oname]; }
  private get _full(): Readonly<O> { return __full[this.oname]; }

  public autofill<P extends keyof O>(pname: P, auto: Func<void, O[P]>): void {
    this._deft[pname] = auto;
  }

  public bind<P extends keyof O>(role: R, pname: P, toggle: keyof O | true, autofill: keyof O, auto: O[P] | Func<string, O[P]>): void;
  public bind<P extends keyof O>(role: R, pname: P, toggle: keyof O | true): void;
  public bind<P extends keyof O>(role: R, pname: P, toggle: keyof O | true, autofill?: keyof O, auto?: O[P] | Func<string, O[P]>): void {
    if (!this._persist) {
      //the key 'persist' is hardcoded, capabilities.json mush have it as well
      this._persist = new Persist<StringMap<any>>(this.oname, 'persist');
    }
    if (autofill) {
      this._auto[pname] = () => {
        let deft = meta(this, pname);
        if (deft === null) {
          deft = this._deft[pname] ? this._deft[pname]() : deft;
        }
        const { role, toggle } = this._binds[pname];
        if (!__ctx.cat(role) || (toggle !== true && !meta(this, toggle))) {
          return v => deft;
        }
        const key = __ctx.cat(role).key;
        if (!meta(this, autofill)) {
          return v => deft;
        }
        else if (typeof auto === 'function') {
          return v => (auto as Func<string, O[P]>)(typeof v === 'number' ? key(v) : v);
        }
        else {
          return v => auto;
        }
      };
      this._binds[pname] = { role, toggle, autofill, pname, fmt: this } as Binding<O, R>;
    }
    else {
      this._binds[pname] = { role, toggle, pname, fmt: this } as Binding<O, R>;
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

  private _patch(format: Partial<O>): O {
    const result = deepmerge<O>(this._default, format || {});
    for (const key in result) {
      if (result[key] === null && key in this._deft) {
        result[key] = this._deft[key]();
      }
    }
    return result;
  }

  public update(format: Partial<O>): Readonly<O> {
    const newFmt = __full[this.oname] = this._patch(format), oldFmt = this._patch(this._meta);
    this._meta = format;
    const dirty = this._dirty = {} as Mark<O>;
    for (const pname in this._default) {
      if (this._bare(newFmt[pname]) !== this._bare(oldFmt[pname])) {
        dirty[pname] = true;
      }
    }
    let itemChanged = false;
    const persist = clone(this._persist && this._persist.value() || {});
    for (const pname in this._binds) {
      const binding = this._binds[pname];
      const special = this._collect(__ctx.cat(binding.role), pname);
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
    return this._full;
  }
}

export class FormatDumper<T> {
  private _fmt: FormatManager<string, T>;
  private _dump = [] as Instance[];
  constructor(fmt: FormatManager<string, T>) {
    this._fmt = fmt;
  }


  public get default() {
    return [{
      objectName: this._fmt.oname,
      properties: __full[this._fmt.oname],
      selector: null
    }];
  }

  public metas(prefer: Partial<T>): this;
  public metas(toggle: keyof T | boolean, fields: (keyof T)[], prefer?: Partial<T>): this;
  public metas(fields: (keyof T)[], prefer?: Partial<T>): this;
  public metas(a: any, b?: any, c?: any): this {
    if (a === undefined || a === null) {//()
      this._metas(undefined, undefined);
    }
    else if (typeof a === 'object' && !Array.isArray(a)) {//prefer: Partial<T>
      this._metas(undefined, a);
    }
    if (typeof a === 'boolean') {//toggle: boolean, fields: (keyof T)[], prefer?: Partial<T>
      a && this._metas(b, c);
    }
    else if (typeof a === 'string') {//toggle: keyof T, fields: (keyof T)[], prefer?: Partial<T>
      this._metas([a as keyof T], c);
      if (meta(this._fmt, a as keyof T)) {
        this._metas(b, c);
      }
    }
    else {//fields: (keyof T)[], prefer?: Partial<T>
      this._metas(a, b);
    }
    return this;
  }

  private _metas(fields: (keyof T)[], prefer: Partial<T>): this {
    prefer = prefer || {};
    const values = meta(this._fmt, fields);
    if (fields) {
      for (let k of fields) {
        if (k in prefer) {
          values[k] = prefer[k];
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

  private _autofill(pname: keyof T, toggle: keyof T, values: FormatInstance[]): this {
    const binding = this._fmt.binding(pname);
    if (!binding) {
      debugger;//should be a bug
    }
    this.metas([toggle]);
    const auto = meta(this._fmt, toggle), cat = __ctx.cat(binding.role);
    for (const i of values) {
      this._dump.push({
        objectName: this._fmt.oname,
        displayName: (i.value !== undefined ? '● ' : '◌ ') + i.name,
        selector: cat.selector(i.row),
        properties: { [pname]: (auto && i.value === undefined) ? i.auto : (i.value || '') }
      });
    }
    debugger;
    return this;
  }

  public labels<O, R extends string>(bind: Binding<O, R>, label: keyof T): this;
  public labels<O, R extends string>(bind: Binding<O, R>, label: keyof T, missing: Func<FormatDumper<T>, void>): this;
  public labels<O, R extends string>(bind: Binding<O, R>, label: keyof T, numeric: true): this;
  public labels<O, R extends string>(bind: Binding<O, R>, label: keyof T, para?: Func<FormatDumper<T>, void> | true): this {
    if (!this._fmt.binding(label)) {
      debugger;
      return this;
    }
    const { autofill, toggle } = this._fmt.binding(label);
    const { role, toggle: customize, pname } = bind, ctx = __ctx;
    if ((customize === true || ctx.config(bind.fmt.oname, customize)) && ctx.cat(role)) {
      //the target category exists and customization enabled
      if (toggle !== true) {
        this.metas([toggle]);//add the switch
      }
      if (toggle === true || this._fmt.config(toggle)) {//when enabled
        if (para === true || (!ctx.type(role).numeric)) {//allow numeric or not numeric
          this._autofill(label, autofill, ctx.labels(bind, this._fmt.special(label)));
        }
      }
    }
    else if (!ctx.cat(role) && para && para !== true) {
      para(this);
    }
    else {
      if (toggle === true) {
        this.metas([label]);
      }
      else {
        this.metas(toggle, [label]);
      }
    }
    return this;
  }

  public specification(pname: keyof T): this {
    this.metas([pname]).items(pname);
    return this;
  }

  public items(test: boolean, pname: keyof T): this;
  public items(pname: keyof T): this;
  items(a: any, b?: any): this {
    let pname = a as keyof T;
    if (b) {
      if (!a) return this;
      pname = b;
    }
    const binding = this._fmt.binding(pname);
    if (!binding) {
      debugger;//should be a bug
    }
    const cat = __ctx.cat(binding.role);
    if (!cat) {
      return this;
    }
    if (binding.toggle !== true) {
      this.metas([binding.toggle]);
    }
    if (binding.toggle !== true && !meta(this._fmt, binding.toggle)) {
      //toggle is off, so no need to itemize
      return this;
    }
    if (binding.autofill) {
      this.metas([binding.autofill]);
    }
    const rows = cat.distincts(), labeler = cat.row2label(rows);
    const item = metaItem(this._fmt, pname), special = this._fmt.special(pname);
    const hit = (r: number) => cat.key(r) in special;
    const instance = (label: string, r: number) => {
      return {
        objectName: this._fmt.oname,
        displayName: (hit(r) ? '● ' : '◌ ') + label,
        selector: cat.selector(r),
        properties: { [pname]: item(r) }
      }
    };
    for (const r of rows) {
      this._dump.push(instance(labeler[r], r));
    }
    return this;
  }

  public get result(): Instance[] {
    return this._dump;
  }
}