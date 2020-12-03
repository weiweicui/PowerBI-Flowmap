import { StringMap, keys, values, toDate } from '../lava/type';
import powerbi from 'powerbi-visuals-api';

type PColumn = powerbi.DataViewCategoryColumn | powerbi.DataViewValueColumn;

function index(columns: PColumn[]): StringMap<PColumn[]> {
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

export class Roles<R extends string> {

    private _cmap = {} as StringMap<PColumn[]>;
    private _vmap = {} as StringMap<PColumn[]>;

    update(view: powerbi.DataView): this {
        if (!view || !view.categorical) {
            this._vmap = this._cmap = {};
        }
        else {
            let cmap = index(view.categorical.categories);
            let vmap = index(view.categorical.values);
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
        const values = column.values;
        const nullCompare = (va: any, vb: any) => {
            if (va === null || va === undefined) {
                return -1;
            }
            if (vb === null || vb === undefined) {
                return 1;
            }
            return undefined;
        };
        const build = customCompare => {
            return (ra: number, rb: number) => {
                const va = values[ra], vb = values[rb];
                return nullCompare(va, vb) || customCompare(va, vb);
            }
        }
        if (column.source.type.numeric) {
            return build((a, b) => a - b);
        }
        else if (column.source.type.dateTime) {
            return build((a, b) => {
                const da = toDate(a), db = toDate(b);
                return nullCompare(da, db) || da.getTime() - db.getTime();
            });
        }
        else {
            return build((a, b) => (a + '').localeCompare(b + ''));
        }
    }
}