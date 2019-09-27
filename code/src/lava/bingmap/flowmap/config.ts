import { StringMap } from "../../type";
import { ILocation } from "../converter";
import { Setting } from "../../../pbi/numberFormat";
import { Format } from "../../../flowmap/format";
import { MapFormat } from "../controller";

type Func<T = string> = (i: number) => T;
export class Config {
    error = null as string;
    advance = new Format().advance as Omit<Format['advance'], 'cache'>;
    style = null as Format['style']['style'];
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

    bubble = new Format().bubble as Format['bubble'] & { in?: Func, out?: Func };
    
    injections = {} as StringMap<ILocation>;

    numberSorter = { sort: 'des' as 'asc' | 'des', top: 10 }
    numberFormat = new Setting();
}
