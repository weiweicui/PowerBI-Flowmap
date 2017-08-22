import { Format } from './format';
import { IPath, IPathPoint } from './renderer';
import { Persist } from "host";
import { ILocation } from "bing";
import { StringMap, keys, Func} from "type";
import { $con } from './visual';
import { Flow } from "./structure";


export var persist = {
    centerzoom: new Persist<[Microsoft.Maps.Location, number]>('advance', 'perMap'),
    geocoding: new Persist<StringMap<ILocation>>('advance', 'perGeocoding'),
    manual: new Persist<StringMap<ILocation>>('advance', 'perManual'),
}

export var msgs = {
    relocate: 'Drag/Drop to manually change geo-locations. Turn off "Relocate" when done.'
}

export module util {
    export function buildFlows(): Flow[] {
        if ($con.fmt.advance.values.direction !== 'in') {
            var groups = $con.group('Color', 'Origin');
        }
        else {
            var groups = $con.group('Color', 'Dest');
        }
        return groups.map(rows => new Flow(rows));
    }

    export function pathTooltip(arg: any): powerbi.extensibility.VisualTooltipDataItem[] {
        var path = arg.data as IPath, leafs = path.leafs;
        var rows = keys(leafs);
        var { sort, top } = $con.fmt.valueFormat.values;
        if (sort === 'des') {
            rows.sort((a, b) => leafs[b] - leafs[a]);
        }
        else {
            rows.sort((a, b) => leafs[a] - leafs[b]);
        }
        var more = rows.length - (+top);
        if (more > 0) {
            rows = rows.slice(0, +top);
        }
        var tips = [] as powerbi.extensibility.VisualTooltipDataItem[];
        var header = $con.sourceTip(+rows[0]);
        for (var row of rows) {
            tips.push({
                header: header,
                displayName: $con.targetTip(+row),
                value: $con.weightTip(+row)
            })
        }
        if (more > 0) {
            tips.push({
                header: header,
                displayName: "...",
                value: `(${more} more)`
            })
        }
        return tips;
    }

    export function pathClick(p: IPath) {
        $con.selection.click(keys(p.leafs).map(r => +r));
    }

    export function pathConverter(level: number) {
        var zoom = $con.layer.map.getZoom();
        if (zoom === level) {
            return null;
        }
        let factor = $con.$20map.factor(zoom);
        return (input: IPathPoint, output: number[]) => {
            output[0] = input[0] * factor;
            output[1] = input[1] * factor;
        };
    }
}

export namespace d3util {

    let e10 = Math.sqrt(50);
    let e5 = Math.sqrt(10);
    let e2 = Math.sqrt(2);

    function marks(start, stop, count) {
        var step = tickStep(start, stop, count);
        return range(
            Math.ceil(start / step) * step,
            Math.floor(stop / step) * step + step / 2, // inclusive
            step
        );
    }

    function tickStep(start, end, count) {
        let step0 = Math.abs(end - start) / Math.max(0, count),
            step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)),
            error = step0 / step1;
        if (error >= e10) step1 *= 10;
        else if (error >= e5) step1 *= 5;
        else if (error >= e2) step1 *= 2;
        return end < start ? -step1 : step1;
    }

    function range(start, stop, step) {
        var i = -1,
            n = Math.max(0, Math.ceil((stop - start) / step)) | 0,
            range = new Array(n) as number[];

        while (++i < n) {
            range[i] = start + i * step;
        }
        return range;
    }
    
    export function ticks(format: Format['scale'], domain: number[], height: number, cap:number): number[] {
        if (format.scale === 'log')
            return log10(format, domain, height, cap);
        else
            return linear(format, domain, height, cap);
    }

    function log10(format: Format['scale'], domain: number[], height: number, cap:number): number[] {
        var [dmin, dmax] = domain;
        var width = scale(format, domain, cap);
        for (var start = 1; start / 10 >= dmin; start /= 10) { }
        for (; start * 10 < dmin; start *= 10) { }
        for (var end = 1; end < dmax; end *= 10) { }
        while (width(end) > height) {end /= 10;}
        while (width(end) < 4) { end *= 10; }
        while (start > end) { start /= 10;}
        while (start < end && width(start) < 1) { start *= 10; }        
        while (end / start < 11) {
            end *= 10;
            if (width(end) > height) {
                return [];
            }
        }
        var result = [start, null, end] as number[];
        while (end > start) {
            end = Math.round(end / 10);
            start = Math.round(start * 10);
        }
        if (start === result[0] || start === result[2]) {
            return [];
        }
        else {
            result[1] = start;
            return result;
        }
    }

    export function scale(format: Format['scale'], domain: number[], wmax: number): Func<number, number> {
        var [dmin, dmax] = domain, wmin = format.min;
        if (format.scale === 'log') {
            var maxLog = Math.log(dmax);
            var minLog = Math.log(dmin);
            if (dmin === dmax) {
                minLog -= Math.abs(minLog) / 2;
                maxLog += Math.abs(maxLog) / 2;
            }
            var scale = w => {
                let s = (Math.log(w) - minLog) / (maxLog - minLog);
                return Math.max(s * wmax, wmin);
            };
        }
        else {
            if (dmin === dmax) {
                dmin -= Math.abs(dmin) / 2;
                dmax += Math.abs(dmax) / 2;
            }
            var scale = w => {
                return Math.max(w / dmax * wmax, wmin);
            };
        }
    
        return scale;
    }

    function linear(scale: Format['scale'], domain: number[], height: number, wmax: number): number[] {
        let [dmin, dmax] = domain, wmin = scale.min;
        if (dmin === dmax) {
            dmin -= Math.abs(dmin) / 2;
            dmax += Math.abs(dmax) / 2;
        }
        let value = w => (w - wmin) / (wmax - wmin) * (dmax - dmin) + dmin;
        let min = Math.max(value(1), 0), max = Math.min(dmax, value(height));
        if (min >= max) {
            return [];
        }
        for (var cnt = 2; cnt < 10; cnt++) {
            var array = marks(min, max, cnt);
            var step = Math.floor((array.length - 1) / 2);
            if (step < 1) {
                continue;
            }
            var result = [] as number[];
            var maxResult = [] as number[], maxLength = -1;
            while (step > 0) {
                for (var i = 0; i < 3; i++) {
                    if (array[array.length - 1 - i * step] >= 0) {
                        result.push(array.length - 1 - i * step);
                    }
                }
                if (result.length === 3) {
                    break;
                }
                if (result.length < 3 && step > 1) {
                    if (result.length > maxLength) {
                        maxLength = result.length;
                        maxResult = result;
                    }
                    step -= 1;
                    result = [];
                }
            }
            if (step === 0) {
                result = maxResult;
            }
            result = result.reverse();
            if (min === 0) {
                var bias = result[0];
                result = result.map(r => r - bias);
            }
            result = result.map(i => array[i]);
            return result;
        }
        return [];
    }
}