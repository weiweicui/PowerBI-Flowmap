import { ISize, IPoint, Func, StringMap } from '../type';

export interface ILocation {
    latitude : number;
    longitude: number;
    type?: string;
    name?: string;
    address?: string;
}

export interface IArea {
    points: IPoint[],
    anchor: ILocation,
    margin: { south: number, north: number, east: number, west: number };
    invalids: StringMap<true>;
    offsets: StringMap<number>;
}

export class Converter {
    private _level: number;
    
    constructor(level: number) {
        this._level = level;
    }

    level() {
        return this._level;
    }

    public location(px: number, py: number): ILocation {
        return Converter._location(px, py, this._level);
    }
    
    public factor(zoom: number): number {
        return Math.pow(2, zoom - this._level);
    }

    public point(loc: ILocation): IPoint;
    public point(longitude: number, latitude: number): IPoint;
    public point(a: ILocation | number, b?: number): IPoint {
        if (typeof a === 'number') {
            return { x: Converter._lon2x(a, this._level), y: Converter._lat2y(b, this._level) };
        }
        else {
            return { x: Converter._lon2x(a.longitude, this._level), y: Converter._lat2y(a.latitude, this._level) };
        }
    }

    public points<T>(data: T[], lat?: Func<T, number>, lon?: Func<T, number>): IArea {
        if (data.length === 0) {
            return null;
        }
        lat = lat || (a => a && a['latitude']);
        lon = lon || (a => a && a['longitude']);
        let result = [] as IPoint[], level = this._level;
        let pcnt = 0, ncnt = 0, psum = 0, nsum = 0, latsum = 0;
        let period = Converter._lon2x(180, this._level);
        let invalids = {} as StringMap<true>;
        for (var i = 0, len = data.length; i < len; i++) {
            var d = data[i], long = lon(d), lati = lat(d);
            if (long === null || lati === null) {
                invalids[i] = true;
                continue;
            }
            latsum += lati;
            if (long > 0) {
                pcnt++;
                psum += long;
            }
            else {
                ncnt++;
                nsum += long;
            }
        }
        if (pcnt === 0 && ncnt === 0) {
            return null;
        }
        let positive = psum + nsum > 0;
        let aLati = latsum / data.length;
        let aLong = positive ? psum / pcnt : nsum / ncnt;
        let anchorx = Converter._lon2x(aLong, level), anchory = Converter._lat2y(aLati, level);
        let west = 0, east = 0, south = 0, north = 0;
        let offsets = {} as StringMap<number>;
        for (var i = 0, len = data.length; i < len; i++) {
            if (invalids[i]) {
                result.push(null);
            }
            var d = data[i], long = lon(d), lati = lat(d);
            var x = Math.round(Converter._lon2x(long, level) - anchorx);
            var y = Math.round(Converter._lat2y(lati, level) - anchory);
            if (lati > aLati) {
                north = Math.max(north, lati - aLati);
            }
            else {
                south = Math.max(south, aLati - lati);
            }
            if (positive) {
                if (Math.abs(x + period) > Math.abs(x)) {
                    result.push({ x, y });
                    if (long > aLong) {
                        east = Math.max(east, long - aLong);
                    }
                    else {
                        west = Math.max(west, aLong - long);
                    }
                }
                else {
                    offsets[result.length] = 1;
                    result.push({ x: x + period, y });
                    east = Math.max(east, long + 360 - aLong);
                }
            }
            else {//negative
                if (Math.abs(x - period) > Math.abs(x)) {
                    result.push({ x, y });
                    if (long > aLong) {
                        east = Math.max(east, long - aLong);
                    }
                    else {
                        west = Math.max(west, aLong - long);
                    }
                }
                else {
                    offsets[result.length] = -1;
                    result.push({ x: x - period, y });
                    west = Math.max(west, aLong - long + 360);
                }
            }
        }
        return {
            points: result,
            anchor: { longitude: aLong, latitude: aLati },
            margin: { east, west, south, north },
            invalids: invalids,
            offsets: offsets
        }
    }

    // public points_old<T>(data: T[], lat?: Func<T, number>, lon?: Func<T, number>): IPoints {
    //     lat = lat || (a => a['latitude']);
    //     lon = lon || (a => a['longitude']);
    //     var minlon = Number.POSITIVE_INFINITY, minlat = Number.POSITIVE_INFINITY;
    //     var maxlon = Number.NEGATIVE_INFINITY, maxlat = Number.NEGATIVE_INFINITY;
    //     var pnts = data.map(d => {
    //         if (d === null || d === undefined) {
    //             return null;
    //         }
    //         var lo = lon(d), la = lat(d);
    //         if (lo === null || la === null) {
    //             return null;
    //         }
    //         if (lo < minlon) { minlon = lo; }
    //         if (lo > maxlon) { maxlon = lo; }
    //         if (la < minlat) { minlat = la; }
    //         if (la > maxlat) { maxlat = la; }
    //         return { x: _lon2x(lo, this._level), y: _lat2y(la, this._level) };
    //     }) as IPoints;
    //     pnts.anchor = { longitude: (minlon + maxlon) / 2, latitude: (minlat + maxlat) / 2 };
    //     pnts.corners = {
    //         nw: { latitude: maxlat, longitude: minlon },
    //         se: { latitude: minlat, longitude: maxlon }
    //     };
    //     var { x, y } = this.point(pnts.anchor);
    //     for (var p of pnts) {
    //         if (p) {
    //             p.x = Math.round(p.x - x);
    //             p.y = Math.round(p.y - y);
    //         }
    //     }
    //     var a = [new Microsoft.Maps.Location(1, -172+360), new Microsoft.Maps.Location(-2, 175)];
    //     let rect = Microsoft.Maps.LocationRect.fromLocations(a);
    //     // console.log(rect);
    //     return pnts;
    // }

    public static fit(areas: IArea[], view: ISize): { zoom: number, center: Microsoft.Maps.Location } {
        var north = Math.max(...areas.map(a => a.anchor.latitude + a.margin.north));
        var south = Math.min(...areas.map(a => a.anchor.latitude - a.margin.south));
        var west = Math.min(...areas.map(a => a.anchor.longitude - a.margin.west));
        var east = Math.max(...areas.map(a => a.anchor.longitude + a.margin.east));
        // console.log(north, south, west, east);
        let rect = Microsoft.Maps.LocationRect.fromCorners(
            new Microsoft.Maps.Location(north, west),
            new Microsoft.Maps.Location(south, east)
        );
        // console.log(rect);
        let height = Math.abs(Converter._lat2y(north, 20) - Converter._lat2y(south, 20));
        let width = Converter._lon2x(rect.width - 180, 20);
        // console.log(height, width, _lon2x(180, this._level));
        for (var level = 20; level > 1; level--) {
            if (width < view.width && height < view.height) {
                break;
            }
            width /= 2;
            height /= 2;
        }
        return { zoom: level, center: rect.center };
    }

    // public fit_old(locs: ILocation[], view: ISize): { zoom: number, center: ILocation } {
    //     let rect = Microsoft.Maps.LocationRect.fromLocations(locs as any);
    //     let { x: west, y: north } = point(rect.getNorthwest(), this._level);
    //     let { x: east, y: south } = point(rect.getSoutheast(), this._level);
    //     var width = east - west, height = south - north;
    //     for (var level = this._level; level > 1; level--) {
    //         if (width < view.width && height < view.height) {
    //             break;
    //         }
    //         width /= 2;
    //         height /= 2;
    //     }
    //     return {
    //         zoom: level,
    //         center: location(east / 2 + west / 2, north / 2 + south / 2, this._level)
    //     };
    // }

    // public area(locs: ILocation[]): { size: ISize, anchor: ILocation } {
    //     let rect = Microsoft.Maps.LocationRect.fromLocations(locs as any);
    //     let { x: w, y: n } = point(rect.getNorthwest(), this._level);
    //     let { x: e, y: s } = point(rect.getSoutheast(), this._level);
    //     return {
    //         size: { width: e - w, height: s - n },
    //         anchor: location(e / 2 + w / 2, n / 2 + s / 2, this._level)
    //     };
    // }

    public x(lng: number): number {
        return Converter._lon2x(lng, this._level);
    }

    public y(lat: number): number {
        return Converter._lat2y(lat, this._level);
    }


    private static _mapSizeCache = [0, 0];
    private static _map2Screen(v: number, level: number): number {
        var size = this._mapSize(level);
        return Math.min(v * size + 0.5, size - 1);
    }

    private static _mapSize(level: number): number {
        var size = 0;
        if (level === this._mapSizeCache[0]) {
            size = this._mapSizeCache[1];
        }
        else {
            if (level === 23)
                size = 2147483648;
            else if (Math.floor(level) == level)
                size = 256 << level;
            else
                size = 256 * Math.pow(2, level);
            this._mapSizeCache = [level, size];
        }
        return size;
    }

    private static _lat2y(lat: number, level: number): number {
        if (lat < -85.05112878) lat = -85.05112878;
        if (lat > 85.05112878) lat = 85.05112878;
        let sin = Math.sin(lat * Math.PI / 180);
        let y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
        return this._map2Screen(y, level);
    }

    private static _lon2x(lon: number, level: number): number {
        if (lon < -180) lon = -180;
        if (lon > 180) lon = 180;
        return this._map2Screen((lon + 180) / 360, level);
    }

    private static _location(pixelX: number, pixelY: number, level: number): ILocation {
        var mapSize = this._mapSize(level);
        var x = Math.min(pixelX, mapSize - 1) / mapSize - 0.5;
        var y = 0.5 - Math.min(pixelY, mapSize - 1) / mapSize;
        var latitude = 90 - 360 * Math.atan(Math.exp(-y * 2 * Math.PI)) / Math.PI;
        var longitude = 360 * x;
        return { latitude, longitude };
    }
}