import { Grand } from './data';
import { sum } from "../../lava/array";
import { host } from "./host";
import { StringMap, keys, Func, dict } from "type";

export interface Highlightable {
    highlight(rows?: StringMap<any>): boolean;
}

export interface IData {
    ids(rows: number[]): powerbi.visuals.ISelectionId[];
    highlightables(): Highlightable[];
}

export class Selection {
    static shrink(sid: powerbi.visuals.ISelectionId, ref: string, value: any): powerbi.visuals.ISelectionId {
        return helper.shrink(sid, ref, value);
    }

    private _manager: powerbi.extensibility.ISelectionManager;
    private _data: IData;
    constructor(data: IData) {
        this._data = data;
    }    

    clear() {
        this._selected = null;
    }

    private _selected = null as StringMap<true>;
    private _hlighted = null as StringMap<true>;
    
    flags(): StringMap<true> {
        return this._hlighted || this._selected;
    }

    reset(highlights: any[], differentData: boolean) {
        if (!this._manager) {
            this._manager = host.selectionManager();
        }
        if (highlights) {
            var map = {} as StringMap<true>;
            for (var i = 0; i < highlights.length; i++){
                if (highlights[i] !== null) {
                    map[i] = true;
                }
            }
            this._hlighted = map;
            this._selected = null;
        }
        else {
            this._hlighted = null;
            if (differentData) {
                this._manager.clear();
                this._selected = null;
            }
        }
        if (this._selected && !keys(this._selected).length) {
            this._selected = null;
        }
    }

    click(rows: number[], target?: powerbi.visuals.ISelectionId) {
        if (!this._manager) {
            this._manager = host.selectionManager();
        }

         if (rows === null) {
            this._selected = null;
            this._manager.clear();
            return;
        }
        var multi = (event as MouseEvent).ctrlKey;
        this._selected = this._selected || {};
        if (multi) {
            for (var r of rows) {
                if (r in this._selected) {
                    delete this._selected[r];
                }
                else {
                    this._selected[r] = true;
                }
            }
        }
        else {
            if (keys(this._selected).length === rows.length && rows.every(r => r in this._selected)) {
                this._selected = {};
            }
            else {
                this._selected = dict(rows, r => r, r => true) as any;
            }
        }
        if (keys(this._selected).length === 0) {
            this._selected = null;
            this._manager.clear();
        }
        else {
            if (target) {
                this._manager.select(target, multi);
            }
            else {
                var ids = this._data.ids(keys(this._selected).map(v => +v));
                this._manager.select(ids, false);
            }
        }
        //propogate to all data
        for (var v of this._data.highlightables()) {
            v.highlight(this._selected);
        }
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
