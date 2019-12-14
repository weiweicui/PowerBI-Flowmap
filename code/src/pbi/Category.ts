import powerbi from "powerbi-visuals-api";
import { StringMap, dateString, NumberMap } from '../lava/type';

type PColumn = powerbi.DataViewCategoryColumn | powerbi.DataViewValueColumn;

export class Category {
    public readonly column: PColumn;
    private _distincts = null as number[];
    private _host: powerbi.extensibility.visual.IVisualHost;
    constructor(column: PColumn, host: powerbi.extensibility.visual.IVisualHost) {
        this.column = column;
        this._host = host;
        if (column) {
            let values = column.values;
            this.key = r => values[r] + "";
        }
        else {
            this.key = r => "";
        }
    }

    public get type() {
        return this.column.source.type;
    }

    public get data() : powerbi.PrimitiveValue[] {
        return this.column.values;
    }

    public selector(row: number): powerbi.data.Selector {
        return this._host.createSelectionIdBuilder()
            .withCategory(this.column as powerbi.DataViewCategoryColumn, row)
            .createSelectionId()
            .getSelector();
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
        if (rows) {
            for (let row of rows) {
                let key = this.key(row);
                if (!(key in cache)) {
                    cache[key] = true;
                    unique.push(+row);
                }
            }
            return unique;
        }
        else {
            for (let row = 0; row < this.column.values.length; row++) {
                const key = this.key(row);
                if (!(key in cache)) {
                    cache[key] = true;
                    unique.push(row);
                }
            }
            return this._distincts = unique;
        }
    }

    public readonly key: (r: number) => string;

    public row2label(rows: number[]): NumberMap<string> {
        if (!rows || rows.length === 0) {
            return {};
        }
        let values = rows.map(r => this.column.values[r]);
        if (this.column.source.type.dateTime) {
            let conv = dateString(values as Date[]);
            values = values.map(d => d instanceof Date ? conv(d) : d as any);
        }
        let result = {} as NumberMap<string>;
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