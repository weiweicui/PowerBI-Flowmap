import { copy } from '../type';
import { ILocation } from './converter';
import { Func, StringMap, keys } from '../type';
import { jsonp } from './jsonp';


var _injected = {} as StringMap<ILocation>;

export function inject(locs: StringMap<ILocation>, reset = false): void {
    locs = locs || {};
    if (reset) {
        _injected = locs;
        return;
    }
    for (var key of keys(locs)) {
        var loc = locs[key];
        if (loc) {
            _injected[key] = loc;
        }
        else {
            delete _injected[key];
        }
    }
}

export function remove(where: Func<ILocation, boolean>): void {
    for (var key of keys(_injected)) {
        if (where(_injected[key])) {
            delete _injected[key];
        }
    }
}

export function latitude(addr: string): number {
    var loc = query(addr);
    if (loc) {
        return loc.latitude;
    }
    else {
        return null;
    }
}

export function longitude(addr: string): number{
    var loc = query(addr);
    if (loc) {
        return loc.longitude;
    }
    else {
        return null;
    }
}

export function query(addr: string): ILocation;
export function query(addr: string, then: Func<ILocation, void>): void;
export function query(addr: string, then?: Func<ILocation, void>): any {
    if (then) {
        var loc = _injected[addr];
        if (loc) {
            loc.address = addr;
            then(loc);
        }
        else if (addr in _initCache) {
            loc = _initCache[addr];
            loc.address = addr;
            then(loc);
        }
        else {
            geocodeCore(new GeocodeQuery(addr), then);
        }
        return undefined;
    }
    else {
        if (_injected[addr]) {
            return _injected[addr];
        }
        else if (_initCache[addr]) {
            return _initCache[addr];
        }
        var rec = geocodeCache[addr.toLowerCase()];
        if (rec) {
            rec.query.incrementCacheHit();
            return rec.coordinate;
        }
        return null;
    }
}

var _initCache = {} as StringMap<ILocation>;
export function initCache(locs: StringMap<ILocation>) {
    _initCache = copy(locs);
}

export var settings = {
    // Maximum Bing requests at once. The Bing have limit how many request at once you can do per socket.
    MaxBingRequest: 6,

    // Maximum cache size of cached geocode data.
    MaxCacheSize: 3000,

    // Maximum cache overflow of cached geocode data to kick the cache reducing.
    MaxCacheSizeOverflow: 1000,
            
    // Bing Keys and URL
    BingKey: "Your key here",
    BingURL: "https://dev.virtualearth.net/REST/v1/Locations?",
    BingUrlGeodata: "https://platform.bing.com/geo/spatial/v1/public/Geodata?",
};

//private
    interface IGeocodeQuery {
        query: string;
        longitude?: number;
        latitude?: number;
    }

    interface IGeocodeCache {
        query: GeocodeQuery;
        coordinate: ILocation;
    }

    interface IGeocodeQueueItem {
        query: GeocodeQuery;
        then: (v: ILocation) => void;
    }

    var geocodeCache: { [key: string]: IGeocodeCache; };
    var geocodeQueue: IGeocodeQueueItem[];
    var activeRequests;

    class GeocodeQuery implements IGeocodeQuery {
        public query      : string;
        public key        : string;
        private _cacheHits: number;
        
        constructor(query: string = "") {
            this.query      = query;
            this.key        = this.query.toLowerCase();
            this._cacheHits = 0;
        }

        public incrementCacheHit(): void {
            this._cacheHits++;
        }

        public getCacheHits(): number {
            return this._cacheHits;
        }

        public getBingUrl(): string {
            var url = settings.BingURL + "key=" + settings.BingKey;
            if (isNaN(+this.query)) {
                url += "&q=" + encodeURIComponent(this.query);
            }
            else {
                url += "&postalCode=" + this.query;
            }

            var cultureName = navigator['userLanguage'] || navigator["language"];
            if (cultureName) {
                url += "&c=" + cultureName;
            }
            url += "&maxRes=20";
            return url;
        }
    }

    function findInCache(query: GeocodeQuery): ILocation {
        var pair = geocodeCache[query.key];
        if (pair) {
            pair.query.incrementCacheHit();
            return pair.coordinate;
        }
        return undefined;
    }

    function cacheQuery(query: GeocodeQuery, coordinate: ILocation): void {
        var keys = Object.keys(geocodeCache);
        var cacheSize = keys.length;

        if (Object.keys(geocodeCache).length > (settings.MaxCacheSize + settings.MaxCacheSizeOverflow)) {

            var sorted = keys.sort((a: string, b: string) => {                
                var ca = geocodeCache[a].query.getCacheHits();
                var cb = geocodeCache[b].query.getCacheHits();
                return ca < cb ? -1 : (ca > cb ? 1 : 0);
            });

            for (var i = 0; i < (cacheSize - settings.MaxCacheSize); i++) {
                delete geocodeCache[sorted[i]];
            }
        }

        geocodeCache[query.key] = { query: query, coordinate: coordinate };
    }

    function geocodeCore(geocodeQuery: GeocodeQuery, then: (v: ILocation) => void): void {
        var result = findInCache(geocodeQuery);
        if (result) {
            result.address = geocodeQuery.query;
            then(result);
        } else {
            geocodeQueue.push({ query: geocodeQuery, then: then });
            releaseQuota();
        }
    }

    // export function batch(queries: string[])

    export function getCacheSize(): number {
        return Object.keys(geocodeCache).length;
    }

    function releaseQuota(decrement: number = 0) {
        activeRequests -= decrement;
        while (activeRequests < settings.MaxBingRequest) {
            if (geocodeQueue.length == 0) {
                break;
            }
            activeRequests++;
            makeRequest(geocodeQueue.shift());
        }
    }

    // var debugCache: { [key: string]: ILocation };
    function makeRequest(item: IGeocodeQueueItem) {
        // Check again if we already got the coordinate;
        var result = findInCache(item.query);
        if (result) {
            result.address = item.query.query;
            setTimeout(() => releaseQuota(1));
            item.then(result);
            return;
        }

        // if (!debugCache) {
        //     debugCache = {};
        //     // let coords = debugData.locs;
        //     // let names = debugData.names;
        //     for (let i = 0; i < names.length; i++) {
        //         let key = names[i].toLowerCase();
        //         debugCache[key] = {
        //             latitude: coords[i * 2],
        //             longitude: coords[i * 2 + 1],
        //             type: 'test',
        //             name: item.query.query
        //         };
        //     }
        // }
        // if (debugCache[item.query.key]) {
        //     setTimeout(() => {
        //         completeRequest(item, null, debugCache[item.query.key]);
        //     }, 80);
        //     return;
        // }

        // Unfortunately the Bing service doesn't support CORS, only jsonp. 
        // This issue must be raised and revised.
        // VSTS: 1396088 - Tracking: Ask: Bing geocoding to support CORS
        var url = item.query.getBingUrl();

        jsonp.get(url, data => {            
            if (!data || !data.resourceSets || data.resourceSets.length < 1) {
                completeRequest(item, ERROR_EMPTY, null);
                return;
            }
            var error = null as Error, result=null as ILocation;
            try {
                var resources = data.resourceSets[0].resources;
                if (Array.isArray(resources) && resources.length > 0) {
                    var index = getBestResultIndex(resources, item.query);
                    var pointData = resources[index].point.coordinates;
                    var result = {
                        latitude: +pointData[0],
                        longitude: +pointData[1],
                        type: resources[index].entityType,
                        name: resources[index].name
                    } as ILocation;
                }
                else {
                    error = ERROR_EMPTY;
                }
            }
            catch (e) {
                error = e;
            }
            completeRequest(item, error, result);
        });
    }

    var ERROR_EMPTY = new Error("Geocode result is empty.");
    var dequeueTimeoutId;

    function completeRequest(item: IGeocodeQueueItem, error: Error, coordinate: ILocation = null) {
        dequeueTimeoutId = setTimeout(() => releaseQuota(1), 0);
        if (error) {
            item.then(undefined);
        }
        else {
            cacheQuery(item.query, coordinate);
            coordinate.address = item.query.query;
            item.then(coordinate);
        }
    }

    function getBestResultIndex(resources: any[], query: GeocodeQuery) {
        return 0;
    }

    function reset(): void {
        geocodeCache = {};
        geocodeQueue = [];
        activeRequests = 0;
        clearTimeout(dequeueTimeoutId);
        dequeueTimeoutId = null;
    }

    function captureBingErrors() {
        try {
            var lastError: Function = window.window.onerror || (() => { });    
            window.window.onerror = (msg: Object, url: string, line: number, column?: number, error?: any) => {
                if (url.indexOf(settings.BingURL) != -1 || url.indexOf(settings.BingUrlGeodata) != -1) {
                    return false;
                }
                lastError(msg, url, line, column, error);
            };
        }
        catch(error) {
            console.log(error);
        }
    }

    reset();
    captureBingErrors();
