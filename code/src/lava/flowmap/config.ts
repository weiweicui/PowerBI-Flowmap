import { StringMap } from "../type";
import { ILocation, MapFormat } from "../bingmap";
import { Setting } from "../../pbi/numberFormat";

type Func<T = string> = (i: number) => T;
export class Config {
    error = null as string;
    advance = {
        relocate: false,
        located: true,
        unlocated: true
    };
    style = null as 'straight' | 'flow' | 'arc';
    source = null as Func;
    target = null as Func;
    groups = null as number[][];
    color = null as Func<number | string> & { min?: string, max?: string };//row=>value || row=>color
    weight = null as
        { conv: Func<number>; min: number; max: number; scale: 'linear' | 'log'; } |
        { conv: Func<number>; unit: number; scale: 'none' } |
        { conv: Func<number>; scale: null }
    popup = {
        description: null as Func,
        origin: null as Func,
        destination: null as Func
    };
    legend = {
        show: false,
        fontSize: 12,
        position: 'top' as 'top' | 'bottom',
        color: true,
        width: true,
        colorLabels: {} as StringMap<string>,
        widthLabels: {} as StringMap<string>
    };

    map = new MapFormat();

    bubble = {
        for: null as 'none' | 'origin' | 'dest' | 'both',//depends
        slice: null as boolean,//depends
        bubbleColor: { solid: { color: '#888888' } },
        scale: 25,
        label: 'none' as 'none' | 'all' | 'manual' | 'hide',
        labelOpacity: 50,
        labelColor: { solid: { color: '#888888' } },
        in: null as Func,
        out: null as Func
    };
    
    injections = {} as StringMap<ILocation>;

    numberSorter = { sort: 'des' as 'asc' | 'des', top: 10 }

    numberFormat = new Setting();
}
