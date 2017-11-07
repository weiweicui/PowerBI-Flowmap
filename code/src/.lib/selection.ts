
import { Grand } from './data';
import { sum } from "../../lava/array";
import { host } from "./host";
import { StringMap, keys, Func, dict } from "type";

interface IData {
    ids(rows: number[]): powerbi.visuals.ISelectionId[];
}

export class Selection {
    static shrink(sid: powerbi.visuals.ISelectionId, ref: string, value: any): powerbi.visuals.ISelectionId {
        return helper.shrink(sid, ref, value);
    }

    public get highlighted(): boolean {
        return !!this._highlighted;
    }

    private _highlight = null as Func<StringMap<true>, void>;
    
    public highlight(callback: Func<StringMap<true>, void>) {
        this._highlight = callback;
    }

    constructor(data: IData) {
        this._data = data;
    }

    clear() {
        this._seleFlags = null;
    }

    private _manager: powerbi.extensibility.ISelectionManager;
    private _data: IData;
    private _highlighted = false;
    private _highCount = null as number;
    private _seleFlags = null as StringMap<true>;
    private _highFlags = null as StringMap<true>;
    
    flags(): StringMap<true> {
        return this._highFlags || this._seleFlags;
    }

    private _dirty = false;

    get dirty() {
        return this._dirty;
    }

    reset(highlights: powerbi.PrimitiveValue[], sameData: boolean, sameFormat: boolean) {
        this._dirty = false;
        if (sameFormat && this._seleFlags) {
            if (highlights) {
                let map = {} as StringMap<true>, cnt = 0;
                for (var i = 0; i < highlights.length; i++) {
                    if (highlights[i] !== null) {
                        map[i] = true;
                        cnt++;
                    }
                }
                this._highFlags = map;
                this._highCount = cnt;
                this._seleFlags = null;
                this._dirty = true;
                return;
            }
            else {
                this._manager && this._manager.clear();
            }
            this._seleFlags = null;
            this._highFlags = null;
            this._highCount = null;
            this._dirty = true;
            return;
        }
        if (highlights) {
            let map = {} as StringMap<true>, cnt = 0;
            for (var i = 0; i < highlights.length; i++) {
                if (highlights[i] !== null) {
                    map[i] = true;
                    cnt++;
                }
            }
            if (cnt !== this._highCount) {
                this._dirty = true;
            }
            else if (!this._highFlags) {
                this._dirty = true;
            }
            else if (keys(this._highFlags).some(k => !(k in map))) {
                this._dirty = true;
            }
            this._highFlags = map;
            this._highCount = cnt;
            return;
        }
        else {
            if (this._highFlags) {
                this._seleFlags = null;
                this._highFlags = null;
                this._highCount = null;
                this._manager && this._manager.clear();
                this._dirty = true;
                return;
            }
        }
    }

    private _clicked = false;
    click(rows: number[], target?: powerbi.visuals.ISelectionId) {
        this._clicked = true;
        this._dirty = true;
        if (!this._manager) {
            this._manager = host.selectionManager();
        }

        this._highCount = this._highFlags = null;

        if (rows === null) {
            this._seleFlags = null;
            this._manager.clear();
            return;
        }
        var multi = (event as MouseEvent).ctrlKey;
        this._seleFlags = this._seleFlags || {};
        if (multi) {
            for (var r of rows) {
                if (r in this._seleFlags) {
                    delete this._seleFlags[r];
                }
                else {
                    this._seleFlags[r] = true;
                }
            }
        }
        else {
            if (keys(this._seleFlags).length === rows.length && rows.every(r => r in this._seleFlags)) {
                this._seleFlags = {};
            }
            else {
                this._seleFlags = dict(rows, r => r, r => true) as any;
            }
        }
        if (keys(this._seleFlags).length === 0) {
            this._seleFlags = null;
            this._manager.clear();
        }
        else {
            if (target) {
                this._manager.select(target, multi);
            }
            else {
                var ids = this._data.ids(keys(this._seleFlags).map(v => +v));
                this._manager.select(ids, false);
            }
        }
        //propogate to all data
        this._highlight && this._highlight(this._seleFlags);
    }
}

module helper {

    interface Equation {
        left?: Equation,
        right?: Equation,
        ref?: string
    }

    function find(equ: Equation, ref: string): Equation {
        if (!equ) {
            return null;
        }
        if (equ.right && equ.right.ref === ref) {
            return equ;
        }
        if (equ.left && equ.left.ref === ref) {
            return equ;
        }
        return find(equ.right, ref) || find(equ.left, ref);
    }

    function keyof(key: string, ref: string, value: string): string {
        var child = findJSON(JSON.parse(key), ref);
        if (child) {
            return JSON.stringify(child);
        }
        else {
            return ref + "<--lava-->" + value;
        }
    }

    class CatSelectionID implements powerbi.visuals.ISelectionId {
        private _key: string;
        private _sel: powerbi.data.Selector;
        
        equals(other: powerbi.visuals.ISelectionId) {
            return other.getKey() === this._key;
        }
        includes(other: powerbi.visuals.ISelectionId, ignoreHighlight?: boolean): boolean {
            return false;
        }
        getKey() {
            return this._key;
        }
        getSelector(): powerbi.data.Selector {
            return this._sel;
        }
        getSelectorsByColumn() {
            return null;
        }
        hasIdentity() {
            return true;
        }

        constructor(selector: powerbi.data.Selector, key:string) {
            this._sel = selector;
            this._key = key;
        }
    }
    
    export function shrink(sid: powerbi.visuals.ISelectionId, ref: string, value: any): powerbi.visuals.ISelectionId {
        var id = sid.getSelector().data[0] as powerbi.DataViewScopeIdentity;
        var key = keyof(id.key, ref, value);
        var selector = {
            data: [{
                kind: 1,
                expr: find(id.expr, ref),
                key: key
            } as any],
            id: key
        } as powerbi.data.Selector;
        return new CatSelectionID(selector, key);
    }

    function findJSON(obj: any, ref: string): any {
        if (typeof obj === 'string') {
            return null;
        }
        for (var k in obj) {
            var c = obj[k];
            if (c && c.l && c.l.col && c.l.col.r === ref) {
                return obj;
            }
            var result = findJSON(c, ref);
            if (result) {
                return result;
            }
        }
        return null;
    }
}