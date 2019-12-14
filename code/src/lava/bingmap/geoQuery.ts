import { ILocation } from './converter';
import { Func } from '../type';
import * as geo from './geoService';

export class GeoQuery {
    private _addrs = null as string[];
    constructor(addrs: ReadonlyArray<string>) {
        this._addrs = addrs.slice(0);
    }

    cancel() {
        this._addrs = null;
    }

    count() {
        return this._addrs.length;
    }

    run(each: Func<ILocation, void>): this {
        var callback = (loc: ILocation) => {
            if (this._addrs) {
                each(loc);
            }
            if (this._addrs && this._addrs.length > 0) {
                var addr = this._addrs.shift();
                geo.query(addr, callback);
            }
        };
        for (var i = 0; i < geo.settings.MaxBingRequest; i++) {
            if (this._addrs && this._addrs.length > 0) {
                var addr = this._addrs.shift();
                geo.query(addr, callback);
            }
        }
        return this;
    }
}