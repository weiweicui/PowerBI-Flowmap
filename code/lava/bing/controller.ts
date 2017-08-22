/// <reference path="../../node_modules/bingmaps/scripts/MicrosoftMaps/Microsoft.Maps.All.d.ts" />
/// <reference path="../d3/ext.d.ts" />
import { ILocation, IArea, Converter } from 'bing';
import { keys, IPoint } from '../type';
type Map = Microsoft.Maps.Map;
type Action<T> = (i: T) => void;

export function append(map: Map, tag: string): d3.Any {
    return d3.select(map.getRootElement()).append(tag)
        .style('pointer-events', 'none')    
        .att.tabIndex(-1)
        .sty.position('absolute')
        .sty.visibility('inherit')
        .sty.user_select('none');
}

interface IMapFormat {
    type   : 'aerial' | 'road',
    lang   : string,
    pan    : boolean,
    zoom   : boolean,
    scale  : boolean,
    cright : boolean,
    forest : boolean,
    label  : boolean,
    road   : "color" | "gray" | 'gray_label' | "hidden",
    icon   : boolean,
    area   : boolean,
    city   : boolean
}

export function defaultZoom(width: number, height: number): number {
    var min = Math.min(width, height);
    for (var level = 1; level < 20; level++) {
        if (256 * Math.pow(2, level) > min) {
            break;
        }
    }
    return level;
}


export function pixel(map: Microsoft.Maps.Map, loc: ILocation, ref?: Microsoft.Maps.PixelReference) {
    var coord = new Microsoft.Maps.Location(loc.latitude, loc.longitude);
    return map.tryLocationToPixel(coord, ref) as IPoint;
}

export class MapFormat implements IMapFormat {
    type = 'road' as 'aerial' | 'road';
    lang = 'default';
    pan = true;
    zoom = true;
    scale = true;
    cright = false;
    city = false;
    road = "gray" as "color" | "gray" | 'gray_label' | "hidden";
    label = true;
    forest = true;
    icon = false;
    area = false;
    
    public static build(...fmts: any[]): MapFormat {
        var ret = new MapFormat();
        for (var f of fmts) {
            if (f) {
                for (var key in ret) {
                    if (key in f) {
                        ret[key] = f[key];
                    }
                }
            }
        }
        return ret;
    }
}


export function coordinate(map: Microsoft.Maps.Map, pixel: IPoint) {
    var pnt = new Microsoft.Maps.Point(pixel.x, pixel.y);
    return map.tryPixelToLocation(pnt) as ILocation;
}

export var capability = {
    "mapControl": {
        "displayName": "Map control",
        "properties": {
            "type": {
                "displayName": "Type", "type": {
                    "enumeration": [
                        { "displayName": "Aerial", "value": "aerial" },
                        { "displayName": "Road", "value": "road" }
                    ]
                }
            },
            "lang": {
                "displayName": "Language",
                "description": "The language used in the map",
                "type": {
                    "enumeration": [
                        { "displayName": "Default", "value": "default" },
                        { "displayName": "Chinese", "value": "zh-HK" },
                        { "displayName": "Czech", "value": "cs-CZ" },
                        { "displayName": "Danish", "value": "da-DK" },
                        { "displayName": "Dutch", "value": "nl-NL" },
                        { "displayName": "English", "value": "en-US" },
                        { "displayName": "Finnish", "value": "fi-FI" },
                        { "displayName": "French", "value": "fr-FR" },
                        { "displayName": "German", "value": "de-DE" },
                        { "displayName": "Italian", "value": "it-IT" },
                        { "displayName": "Japanese", "value": "ja-JP" },
                        { "displayName": "Korean", "value": "Ko-KR" },
                        { "displayName": "Norwegian(Bokmal)", "value": "nb-NO" },
                        { "displayName": "Polish", "value": "pl-PL" },
                        { "displayName": "Portuguese", "value": "pt-BR" },
                        { "displayName": "Russian", "value": "ru-RU" },
                        { "displayName": "Spanish", "value": "es-ES" },
                        { "displayName": "Swedish", "value": "sv-SE" }
                    ]
                }
            },
            "pan": { "displayName": "Pan", "type": { "bool": true } },
            "zoom": { "displayName": "Zoom", "type": { "bool": true } },
            "scale": { "displayName": "Scale bar", "type": { "bool": true } },
            "cright": { "displayName": "Copyright", "type": { "bool": true } }
        }
    },
    "mapElement": {
        "displayName": "Map element",
        "properties": {
            "forest": { "displayName": "Forest", "type": { "bool": true } },
            "road": {
                "displayName": "Road", "type": {
                    "enumeration": [
                        { "displayName": "Default", "value": "color" },
                        { "displayName": "Gray w/ label", "value": "gray_label" },
                        { "displayName": "Gray w/o label", "value": "gray" },
                        { "displayName": "Hidden", "value": "hidden" }
                    ]
                }
            },
            "label": { "displayName": "Label", "type": { "bool": true } },
            "city": { "displayName": "City", "type": { "bool": true } },
            "icon": { "displayName": "Icon", "type": { "bool": true } },
            "area": { "displayName": "Area", "type": { "bool": true } }
        }
    }
}

declare var __lavaBuildMap;
function parameter(map: Map, fmt: IMapFormat, div: HTMLDivElement): Microsoft.Maps.IMapLoadOptions {
    var para = {
        credentials: 'Your Bing Key',
        showDashboard: false,
        showTermsLink: false,
        showScalebar: fmt.scale,
        showLogo: false,
        customMapStyle: customStyle(fmt),
        disablePanning: !fmt.pan,
        disableZooming: !fmt.zoom,
        mapTypeId: mapType(fmt),
        // liteMode: false
    } as Microsoft.Maps.IMapLoadOptions;

    if (map) {
        para.center = map.getCenter();
        para.zoom = map.getZoom()
    }
    else {
        para.center = new Microsoft.Maps.Location(0, 0);
        para.zoom = defaultZoom(div.offsetWidth, div.offsetHeight);
    }
    return para;    
}

function mapType(v: IMapFormat) {
    if (v.type === 'aerial') {
        return Microsoft.Maps.MapTypeId.aerial;
    }
    else {
        return Microsoft.Maps.MapTypeId.road;
    }
}

function customStyle(v: IMapFormat): Microsoft.Maps.ICustomMapStyle {
    var nothing = { labelVisible: false, visible: false };
    var visible = { visible: true, labelVisible: v.label };
    var result = {
        version: "1.0",
        elements: {
            highSpeedRamp: nothing,
            ramp: nothing,
            unpavedStreet: nothing,
            tollRoad: nothing,
            trail: nothing
        }
    } as Microsoft.Maps.ICustomMapStyle;
    result.elements.mapElement = { labelVisible: v.label };
    result.elements.political = { labelVisible: v.label, visible: true };
    result.elements.district = { labelVisible: v.label, visible: true };
    if (v.road === 'gray' || v.road === 'gray_label') {
        result.elements.transportation = {
            visible: true,
            labelVisible: v.road === 'gray_label',
            fillColor: '#DDDDDD',
            strokeColor: '#AAAAAA',
            labelOutlineColor: '#EEEEEE'
        } as Microsoft.Maps.IMapElementStyle;
        result.elements.street = {
            visible: true,
            labelVisible: v.road === 'gray_label',
            fillColor: "#EEEEEE",
            strokeColor: "#DDDDDD",
            labelOutlineColor: '#DDDDDD'
        } as Microsoft.Maps.IMapElementStyle;
    }
    else if (v.road === 'hidden') {
        result.elements.transportation = nothing;
    }
    result.elements.point = v.icon ? visible : nothing;
    result.elements.vegetation = v.forest ? visible : nothing;
    result.elements.populatedPlace = { labelVisible: v.city, visible: v.icon };
    result.elements.area = v.area ? visible : nothing;
    return result;
}

export interface ILayer {
    reset(map: Microsoft.Maps.Map);
    transform(map: Microsoft.Maps.Map, tzoom:number);
    resize(map: Microsoft.Maps.Map);
}

function delay<T extends Function>(action: T, empty: () => boolean): T {
    var handler = null as number;
    return function () {
        if (handler) {
            clearInterval(handler);
            handler = null;
        }
        var args = arguments;
        if (empty()) {
            handler = window.setInterval(() => {
                if (empty()) {
                    return;
                }
                action.apply(this, args);
                clearInterval(handler);
                handler = null;
            }, 40);            
        }
        else {
            action.apply(this, args);
        }
    } as any;
}

export class Controller {
    private _div: HTMLDivElement;
    private _map: Map;
    private _fmt: IMapFormat;

    public get format() {
        return this._fmt;
    }

    public pixel(loc: ILocation): IPoint {
        return pixel(this._map, loc);
    }

    private _arrange(legend: d3.Any, topLegend: boolean, legendHeight: number, mapHeight: number) {
        if (topLegend) {
            d3.select(this._div).sty.margin_top(legendHeight + 'px');
            d3.select(this._div).select('.bottomRightOverlay')
                .sty.margin_bottom(legendHeight + 'px');
            legend.sty.margin_top('0px');
        }
        else {
            d3.select(this._div).sty.margin_top(0 - legendHeight + 'px');
            d3.select(this._div).select('.bottomRightOverlay')
                .sty.margin_bottom('0px');
            legend.sty.margin_top(mapHeight - legendHeight + 'px');
        }
    }

    public arrange(legend: d3.Any, topLegend: boolean, legendHeight: number, mapHeight: number) {
        this._formapMargins(legend, topLegend, legendHeight, mapHeight);
    }
    
    private _formapMargins = delay(this._arrange, () => d3.select(this._div).select('.bottomRightOverlay').empty());    
    private _formatCopyright = delay(
        () => d3.select(this._div).select('#CopyrightControl').sty.display(this._fmt.cright ? null : 'none'),
        () => d3.select(this._div).select('#CopyrightControl').empty()
    );
    private _formatScaleBar = delay(
        () => d3.select(this._div).select('#ScaleBarId').sty.display(this._fmt.scale ? null : 'none'),
        () => d3.select(this._div).select('#ScaleBarId').empty()
    );

    private _layer: ILayer;

    public layer(v: ILayer): void {
        if (this._layer) {
            console.log('lava: a layer is already set');
        }            
        this._layer = v;
        if (this._map) {
            this._layer.reset(this._map);
            this._layer.resize(this._map);
        }
    }

    constructor(div: HTMLDivElement, change?:Action<Map>) {
        this._fmt = {} as IMapFormat;
        this._div = div;
        this._changed = change;
        __lavaBuildMap = () => {
            // console.log('begin lava build map');
            var n = window['InstrumentationBase'];
            n.prototype.flush = function () {
                if (n._timerToken) {
                    window.clearTimeout(n._timerToken), n._timerToken = 0;
                }
                if (n.logList.length) {
                    this.clear();
                }
            };
            this._remap();
            this._then && this._then(this._map);
            this._then = null;
            // console.log('done lava build map');
        }
    }
    
    private _remap(): Map {
        var para = parameter(this._map, this._fmt, this._div);
        d3.select(this._div).select('div').remove();
        var map = new Microsoft.Maps.Map(this._div, para);
        if (this._map) {
            var old = this._map;
            Microsoft.Maps.Events.removeHandler(this._changeHandler);
            Microsoft.Maps.Events.removeHandler(this._endHandler);
            setTimeout(function () { old.dispose(); }, 1000);
        }
        this._map = map;
        this._changeHandler = Microsoft.Maps.Events.addHandler(map, 'viewchange', () => {
            this.viewChange();
        });
        this._endHandler = Microsoft.Maps.Events.addHandler(map, 'viewchangeend', () => {
            this.viewChange();
        });
        if (this._layer) {
            this._layer.reset(this._map);
            this._layer.resize(this._map);
        }
        this._formatCopyright();
        return map;
    }

    private _endHandler = null as Microsoft.Maps.IHandlerId;
    viewChange(extraChange = true) {
        var width = this._map.getWidth(), height = this._map.getHeight();
        if (extraChange && this._layer && this._changed) {
            this._changed(this._map);
        }
        if (this._width !== width || this._height !== height) {
            this.tryResize();
            if (this._zoom !== zoom) {
                this._tzoom = this._zoom = zoom;
                this._layer && this._layer.transform(this._map, zoom);
            }
        }
        else {
            var zoom = this._map.getZoom();
            if (this._zoom !== zoom) {
                if (this._zoom > zoom) {
                    this._tzoom = Math.floor(zoom);
                }
                else {
                    this._tzoom = Math.ceil(zoom);
                }
                this._layer && this._layer.transform(this._map, this._tzoom);
                this._zoom = zoom;
            }
            else {
                this._layer && this._layer.transform(this._map, this._tzoom);
            }
        }
    }

    private _tzoom: number;
    private _changed: Action<Map>;
    private _zoom: number;
    private _width: number;
    private _height: number;

    public tryResize(): void {
        if (!this._map) {
            return;
        }
        if (this._map.getWidth() !== this._width || this._height !== this._map.getHeight()) {
            this._width = this._map.getWidth();
            this._height = this._map.getHeight();
            this._layer && this._layer.resize(this._map);
        }
    }

    public fitView(areas: IArea[]) {
        var width = this._map.getWidth(), height = this._map.getHeight();
        if (areas.length < 1) {
            var config = {
                zoom: defaultZoom(width, height),
                center: new Microsoft.Maps.Location(0, 0),
                animate: false
            } as Microsoft.Maps.IViewOptions;
        }
        else {
            var config = Converter.fit(areas, { width, height }) as Microsoft.Maps.IViewOptions;
        }
        //even level 1 is not enough, so directly use 
        this._map.setView(config);
        this.viewChange();
    }

    private _changeHandler: Microsoft.Maps.IHandlerId;

    private _then: Action<Map>;
    restyle(fmt: Partial<IMapFormat>, then?: Action<Map>) {
        then = then || (() => { });
        var dirty = {} as Partial<IMapFormat>;
        for (var k in fmt) {
            if (fmt[k] !== this._fmt[k]) {
                dirty[k] = this._fmt[k] = fmt[k];
            }
        }
        if (keys(dirty).length === 0){
            return;
        }
        if ('lang' in dirty || !this._map) {
            d3.select('#mapscript').remove();
            d3.select('head').selectAll('link').filter(function () {
                var src = d3.select(this).attr('href') as string;
                return src && src.indexOf('www.bing.com') > 0;
            }).remove();
            d3.select('head').selectAll('script').filter(function () {
                var src = d3.select(this).attr('src') as string;
                return src && src.indexOf('www.bing.com') > 0;
            }).remove();

            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.id = 'mapscript';
            script.src = "https://www.bing.com/api/maps/mapcontrol?callback=__lavaBuildMap";
            if (dirty.lang !== 'default') {
                script.src += "&setLang=" + dirty.lang;
            }
            script.async = true;
            script.defer = true;
            this._then = then;
            document.body.appendChild(script);
            return;
        }
        var remap = { label: 1, forest: 1, road: 1, city: 1, icon: 1, area: 1};
        for (var k in dirty) {
            if (k in remap) {
                setTimeout(() => then(this._remap()), 0);
                return;
            }
        }
        var options = {} as Microsoft.Maps.IMapOptions;

        if ('pan' in dirty) {
            options.disablePanning = !dirty.pan;
        }
        if ('zoom' in dirty) {
            options.disableZooming = !dirty.zoom;
        }
        if ('type' in dirty) {
            setTimeout(() => this._map.setView({ mapTypeId: mapType(this._fmt) }), 0);
        }
        setTimeout(() => {
            this._formatCopyright();
            this._formatScaleBar();
        }, 0);
        if (Object.keys(options).length) {
            setTimeout(() => this._map.setOptions(options), 0);
        }
        this.viewChange();
        then(null);
        return;
    }
}
