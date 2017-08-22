import { Setting } from 'numberFormat';
import { MapFormat } from 'bing';


export type Fill = { solid: { color: string } };

class ValueFormat extends Setting {
    sort = 'des' as 'asc' | 'des';
    top = 10;
}

var mapformat = new MapFormat();
export class Format {
    legend = {
        show: true,
        position: 'top' as 'top' | 'bot',
        scale: true,
        fontSize: 12,
        customize: true,
        label: null as string
    };
    scale = {
        scale: 'linear' as 'linear' | 'log',
        min: 1,
        autoScale: true,
        factor: 10
    };
    color = {
        fill: { solid: { color: '#01B8AA' } } as powerbi.Fill,
        customize: true
    };
    advance = {
        style: "curve" as 'straight' | 'curve' | 'arc',
        direction: 'out' as 'in' | 'out',
        limit: 3,
        cache: true,
        relocate: false,
        located: true,
        unlocated: true
    };
    mapControl = {
        type   : mapformat.type,
        lang   : 'default',
        pan    : true,
        zoom   : true,
        scale  : true,
        cright : false
    };
    mapElement = {
        road  : mapformat.road,
        label : mapformat.label,
        forest: mapformat.forest,
        city  : mapformat.city,
        icon  : mapformat.icon,
        area  : mapformat.area
    };
    valueFormat = new ValueFormat();
    bubble = {
        show: true,
        size: 3,
        label: 'none' as 'none' | 'all' | 'manual' | 'hide',
        labelOpacity: 1
    }
}

function mapType(key: string) {
    var type = {
        aerial: Microsoft.Maps.MapTypeId.aerial,
        road: Microsoft.Maps.MapTypeId.road,
        mercator: Microsoft.Maps.MapTypeId.mercator
    };
    return type[key] || Microsoft.Maps.MapTypeId.road
}