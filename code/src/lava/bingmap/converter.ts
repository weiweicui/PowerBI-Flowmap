import { defaultZoom } from './controller';
import { ISize, IPoint, Func, StringMap, clamp } from '../type';

export interface ILocation {
    latitude : number;
    longitude: number;
    type?: string;
    name?: string;
    address?: string;
}

export interface IArea {
    points: IPoint[];
    anchor: ILocation;
    margin: { south: number, north: number, east: number, west: number };
    offsets: number[];
    scale(zoom: number): number;
}

export interface IPoints {
    points: IPoint[],
    anchor: ILocation,
    margin: { south: number, north: number, east: number, west: number };
    offsets: StringMap<number>;
}

export interface IBound {
    anchor: ILocation;
    margin: { south: number, north: number, east: number, west: number };
    offsets?: number[];
}

export function bound(data: ILocation[]): IBound {
    let anch = anchor(data);
    if (!anch) {
        return null;
    }
    let { longitude: alon, latitude: alat, positive } = anch;    
    let west = 0, east = 0, south = 0, north = 0, dcnt = 0;
    let offsets = [];
    for (let i = 0; i < data.length; i++) {
        let d = data[i];
        if (!d) {
            continue;
        }
        dcnt++;
        let long = d.longitude, lati = d.latitude;
        if (lati > alat) {
            north = Math.max(north, lati - alat);
        }
        else {
            south = Math.max(south, alat - lati);
        }
        if (positive) {
            if (long > alon) {
                east = Math.max(east, long - alon);
            }
            else {
                if (alon - long > long + 360 - alon) {
                    //shifted
                    east = Math.max(long + 360 - alon, east);
                    offsets[i] = 1;
                }
                else {
                    west = Math.max(alon - long, west);
                }
            }
        }
        else {//negative
            if (long < alon) {
                west = Math.max(alon - long, west);
            }
            else {
                if (alon - (long - 360) < long - alon) {
                    //shifted
                    west = Math.max(alon - (long - 360), west);
                    offsets[i] = -1;
                }
                else {
                    east = Math.max(long - alon, east);
                }
            }
        }
    }
    if (dcnt <= 1) {
        east = west = south = north = 0.1;
    }
    return {
        anchor: { longitude: alon, latitude: alat },
        margin: { east, west, south, north },
        offsets
    }
}

export function fitOptions(bounds: IBound[], view: ISize): Microsoft.Maps.IViewOptions {
    bounds = (bounds || []).filter(a => !!a);
    if (bounds.length === 0) {
        return {
            zoom: defaultZoom(view.width, view.height),
            center: new Microsoft.Maps.Location(0, 0)
        };
    }
    let n = Math.max(...bounds.map(a => a.anchor.latitude + a.margin.north));
    let s = Math.min(...bounds.map(a => a.anchor.latitude - a.margin.south));
    let w = Math.min(...bounds.map(a => a.anchor.longitude - a.margin.west));
    let e = Math.max(...bounds.map(a => a.anchor.longitude + a.margin.east));
    s = clamp(s, -88, 88);
    n = clamp(n, -88, 88);
    let rect = Microsoft.Maps.LocationRect.fromCorners(
        new Microsoft.Maps.Location(n, w),
        new Microsoft.Maps.Location(s, e)
    );
    let height = Math.abs(helper.lat2y(n, 20) - helper.lat2y(s, 20));
    let width = helper.lon2x(rect.width - 180, 20);
    for (var level = 20; level > 1; level--) {
        if (width < view.width && height < view.height) {
            break;
        }
        width /= 2;
        height /= 2;
  }
  return { zoom: level, center: rect.center };
}

export function anchorPixel(m: Microsoft.Maps.Map, bound: IBound): IPoint {
    let level = m.getZoom(), { anchor, margin } = bound;
    let loc = new Microsoft.Maps.Location(anchor.latitude, anchor.longitude);
    let pix = m.tryLocationToPixel(loc) as IPoint;
    let east = helper.lon2x(margin.east - 180, level);
    let west = helper.lon2x(margin.west - 180, level);
    let width = m.getWidth();
    let left = pix.x + width / 2 - west;
    let size = helper.mapSize(level);
    let half = east / 2 + west / 2;
    if (left < 0) {
        if (width - left - size > half) {
            pix.x += size;
            return pix;
        }
        return pix;
    }
    if (left > width - half) {
        if (left + half - size > 0) {
            pix.x -= size;
            return pix;
        }
        if (left > width) {
            pix.x -= size;
            return pix;
        }
        return pix;
    }
    return pix;
}

//allow to have null or undefined in data
export function anchor(data: ILocation[]): ILocation & { positive: boolean } {
    if (!data || data.length === 0) {
        return null;
    }
    let pcnt = 0, ncnt = 0, psum = 0, nsum = 0, latsum = 0;
    for (let i = 0; i < data.length; i++) {
        let d = data[i];
        if (!d) {
            continue;
        }
        let long = d.longitude, lati = d.latitude;
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
    return {
        longitude: positive ? psum / pcnt : nsum / ncnt,
        latitude: latsum / data.length,
        positive: positive
    }
}

export function area(data: ILocation[], level = 20): IArea {
    let area = bound(data) as any as IArea;
    if (!bound) {
        return null;
    }
    let offsets = area.offsets;
    let { longitude: alon, latitude: alat } = area.anchor;
    let period = helper.lon2x(180, level);
    
    let ax = helper.lon2x(alon, level), ay = helper.lat2y(alat, level);
    let points = [] as IPoint[];
    for (let i = 0; i < data.length; i++) {
        let d = data[i];
        if (!d) {
            points.push(null);
            continue;
        }
        let x = Math.round(helper.lon2x(d.longitude, level) - ax);
        let y = Math.round(helper.lat2y(d.latitude, level) - ay);
        points.push({ x: x + (offsets[i] || 0) * period, y });
    }
    area.points = points;
    area.scale = z => Math.pow(2, z - level);
    return area;
}

export class Converter {
    private _level: number;
    
    constructor(level: number) {
        this._level = level;
    }
    
    public factor(zoom: number): number {
        return Math.pow(2, zoom - this._level);
    }

    public line(data: ILocation[]): IArea {
        let ret = this.points(data), half = helper.lon2x(0, this._level);
        let points = ret.points, prev = null as IPoint;
        for (let p of points) {
            if (!p) continue;
            if (prev === null) {
                prev = p;
            }
            else {
                let delta = prev.x - p.x;
                if (Math.abs(delta) > half) {
                    p.x += (delta > 0 ? 2 : -2) * half;
                }
                prev = p;
            }
        }        
        return ret;
    }

    public points(data: ILocation[]): IArea {
        return area(data, this._level);
    }

    public x(lng: number): number {
        return helper.lon2x(lng, this._level);
    }

    public y(lat: number): number {
        return helper.lat2y(lat, this._level);
    }
}

namespace helper {
    let _mapSizeCache = [0, 0];
    function _map2Screen(v: number, level: number): number {
        var size = mapSize(level);
        return Math.min(v * size + 0.5, size - 1);
    }

    export function mapSize(level: number): number {
        var size = 0;
        if (level === _mapSizeCache[0]) {
            size = _mapSizeCache[1];
        }
        else {
            if (level === 23)
                size = 2147483648;
            else if (Math.floor(level) == level)
                size = 256 << level;
            else
                size = 256 * Math.pow(2, level);
            _mapSizeCache = [level, size];
        }
        return size;
    }

    export function lat2y(lat: number, level: number): number {
        if (lat < -85.05112878) lat = -85.05112878;
        if (lat > 85.05112878) lat = 85.05112878;
        let sin = Math.sin(lat * Math.PI / 180);
        let y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
        return _map2Screen(y, level);
    }

    export function lon2x(lon: number, level: number): number {
        if (lon < -180) lon = -180;
        if (lon > 180) lon = 180;
        return _map2Screen((lon + 180) / 360, level);
    }

    export function loc(pixelX: number, pixelY: number, level: number): ILocation {
        var mapSize = mapSize(level);
        var x = Math.min(pixelX, mapSize - 1) / mapSize - 0.5;
        var y = 0.5 - Math.min(pixelY, mapSize - 1) / mapSize;
        var latitude = 90 - 360 * Math.atan(Math.exp(-y * 2 * Math.PI)) / Math.PI;
        var longitude = 360 * x;
        return { latitude, longitude };
    }
}