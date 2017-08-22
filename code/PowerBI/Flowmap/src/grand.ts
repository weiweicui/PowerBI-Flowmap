import { Format } from './format';
import { build as numberFormat } from 'numberFormat';
import { Grand, Category } from "data";
import { IRect, keys, dict, clamp, Func, StringMap } from "type";
import { inject } from "bing/geoService";
import { Legend } from './legend';
import { ILocation, Converter, GeoQuery, Controller } from "bing";
import { FlowLayer } from "./flowlayer";
import { $con } from './visual';
import { Flow } from "./structure";
import { util, persist } from './app';
import { Selection, Highlightable } from 'selection';

export type Role = 'Origin' | 'Dest' | 'Weight' | 'Color' | 'OLati' | 'OLong' | 'DLati' | 'DLong' | 'OName' | 'DName' | 'Tooltip';

export class Context extends Grand<Role, Format> {

    $20map = new Converter(20);
    layer: FlowLayer;    
    legend: Legend;
    selection: Selection;    
    control: Controller;
    
    constructor() {
        super(new Format(), false);
        this.selection = new Selection(this);
    }

    source: Func<number, string>;
    target: Func<number, string>;
    colour: Func<number, string>;
    weight: Func<number, number>;

    sourceTip: Func<number, string>;
    targetTip: Func<number, string>;
    weightTip: Func<number, string>;

    highlightables(): Highlightable[] {
        return [].concat(this.layer.data()).concat(this.legend).concat(this.layer);
    }
    
    border: () => IRect;

    category: Role;

    public update(view: powerbi.DataView) {
        if (this._geoQuery) {
            this._geoQuery.cancel();
            this._geoQuery = null;
        }
        //bind roles
        if (this._exist(view, 'Color')) {
            this.fmt.color.bind('Color', 'fill', 'customize');
            this.fmt.legend.bind('Color', 'label', 'customize');
        }
        else {
            if (this.meta(view, 'advance', 'direction') !== 'in') {
                this.fmt.color.bind('Origin', 'fill', 'customize');
                this.fmt.legend.bind('Origin', 'label', 'customize');
            }
            else {
                this.fmt.color.bind('Dest', 'fill', 'customize');
                this.fmt.legend.bind('Dest', 'label', 'customize');
            }
        }

        this._init = this.invalid() && !this.invalid(view);
        //super.update
        super.update(view);

        //update getters
        if (this.fmt.advance.values.direction !== 'in') {
            this.source = this.key('Origin');
            this.target = this.key('Dest');
            this.category = 'Origin';
            this.sourceTip = this.value<string>(this.exist('OName') ? 'OName' : 'Origin');
            this.targetTip = this.value<string>(this.exist('DName') ? 'DName' : 'Dest');
        }
        else {
            this.source = this.key('Dest');
            this.target = this.key('Origin');
            this.category = 'Dest';
            this.sourceTip = this.value<string>(this.exist('DName') ? 'DName' : 'Dest');
            this.targetTip = this.value<string>(this.exist('OName') ? 'OName' : 'Origin');
        }
        if (this.exist('Color')) {
            this.colour = this.key('Color');
            this.category = 'Color';
        }
        else {
            this.colour = this.source;
        }
        //weight prop
        var weightof = this.value<number>('Weight');
        this.weight = r => weightof(r);
        var conv = numberFormat(this.fmt.valueFormat.values);
        if (!this._tipCols || this._tipCols.length === 0) {
            this.weightTip = r => conv(this.weight(r));
        }
        else {
            this.weightTip = r => {
                var arr = [] as string[];
                for (var col of this._tipCols) {
                    var val = col[r];
                    if (typeof val === 'number') {
                        arr.push(conv(val));
                    }
                    else {
                        arr.push(val + "");
                    }
                }
                return arr.join(', ');
            }
        }
      
        if (this.invalid()) {
            this.selection.clear();
            this.layer.clear();
            this.legend.clear();
            this.legend.info(this.invalid());
            return;
        }

        this.legend.info(null);
        //locations
        var injections = this._buildInjections();
        if (injections) {
            inject(injections, true);
            inject(this._manual, false);
        }
        
        //update selection flags
        this.selection.reset(this._highlights, this.dirty('data') || !this.dirty('format'));

        if (this.fmt.advance.dirty('relocate')) {
            this.layer.resetPins();
        }

        var reset = !!injections || this.roleDirty('Origin', 'Dest', 'Weight', 'Color');
        reset = reset || this.fmt.advance.dirty('direction', 'style') || this.dirty('count');
        if (reset) {
            this.legend.clear();
            var flows = this._desiredFlows();
            this.layer.clear();
            this._add(flows);
        }
        else if (this.fmt.advance.dirty('limit')) {
            this.legend.clear();
            var flows = this._desiredFlows();
            this.layer.clear(flows);
            this._add(flows.filter(f => !(f.key in this.layer.flows)));
        }
        if (this.dirty('highlight')) {
            for (var d of this.highlightables()) {
                d.highlight(this.selection.flags());
            }
        }
        this.layer.reformat();
        this.legend.reformat();
        if ($con.legend.rescale()) {
            $con.layer.rescale();
        }
        this.control.viewChange();
    }

    private _desiredFlows(): Flow[] {
        var allFlows = util.buildFlows();
        var selected = allFlows.filter(f => this.layer.contains(f.key));
        var limit = this.fmt.advance.values.limit;
        if (selected.length > limit) {
            selected = selected.slice(0, limit);
        }
        else {
            if (allFlows.length <= limit) {
                selected = allFlows;
            }
            else {
                var mark = dict(selected, f => f.key);
                for (var f of allFlows) {
                    if (!(f.key in mark)) {
                        selected.push(f);
                    }
                    if (selected.length >= limit) {
                        break;
                    }
                }
            }
        }
        return selected;
    }

    private _add(flows: Flow[]) {
        if (this.exist('OLong', 'OLati', 'DLong', 'DLati')) {
            for (var flow of flows) {
                this.layer.add(flow);
            }
        }
        else {
            var next = () => {
                if (flows.length === 0) {
                    if (this.fmt.advance.values.cache) {
                        persist.geocoding.write(this._geoCache, 0);
                    }
                    $con.legend.info(null);
                    return;
                }
                var flow = flows.shift();
                var total = flow.addrs.length, sofar = 0;
                this._geoQuery = new GeoQuery(flow.addrs);
                var valids = {} as StringMap<true>;
                this._geoQuery.run(loc => {
                    sofar++;
                    if (loc) {
                        this._geoCache[loc.address] = loc;
                        valids[loc.address] = true;
                    }
                    $con.legend.info(`Geocoding ${sofar}/${total}`);
                    if (sofar === total) {
                        // console.log('geo done: ' + flow.addrs[0], sofar);
                        this.layer.add(flow);
                        $con.legend.reformat();
                        // $con.legend.add(this.layer.flow(flow.key));
                        next();
                    }
                });
            };
            next();
        }
    }        

    private _geoCache = {} as StringMap<ILocation>;
    private _geoQuery = null as GeoQuery;
    private _manual   = {} as StringMap<ILocation>;
    private _init     = false;

    private _buildInjections(): StringMap<ILocation> {
        var keys = ['O', 'D'], fields = keys.map(k => [k + 'Long', k + 'Lati']) as Role[][];
        if (!this._init && !this.dirty('count') && fields.every(f => !this.roleDirty(...f))) {
            return null;
        }
        var injection = {} as StringMap<ILocation>;
        for (var i = 0; i < keys.length; i++) {
            if (!this.exist(...fields[i])) {
                continue;
            }
            var addrOf = this.key(keys[i] === 'O' ? 'Origin' : 'Dest');
            var longOf = this.value<number>(fields[i][0]);
            var latiOf = this.value<number>(fields[i][1]);
            for (var r of this.rows()) {
                var addr = addrOf(r);
                if (addr in injection || addr in this._manual) {
                    continue;
                }
                var lon = +longOf(r), lat = +latiOf(r);
                if (isNaN(lon) || isNaN(lat)) {
                    continue;
                }
                lon = clamp(lon, -180, 180);
                lat = clamp(lat, -85.05112878, 85.05112878);
                injection[addr] = {
                    longitude: lon,
                    latitude: lat,
                    type: 'injected',
                    name: addr,
                    address: addr
                };
            }
        }        
        return injection;
    }
        
    public relocate(locs: StringMap<ILocation>, silent = false): void {
        if (!locs || !keys(locs).length) {
            return;
        }
        inject(locs);
        for (var k in locs) {
            locs[k].type = 'manual';
            this._manual[k] = locs[k];
        }
        if (silent) {
            return;
        }
        persist.manual.write(this._manual, 0);
        this.layer && this.layer.move(keys(locs));
    }

    public invalid(view?: powerbi.DataView): string {
        view = view || this._view;
        if (!view) {
            return 'Data is empty.';
        }
        let tmp = [] as string[];
        !this._exist(view, 'Origin') && tmp.push('Origin');
        !this._exist(view, 'Dest') && tmp.push('Destination');
        !this._exist(view, 'Weight') && tmp.push('Value');
        if (tmp.length === 0) {
            return null;
        }
        else if (tmp.length === 1) {
            return tmp[0] + ' field is missing.';
        }
        else if (tmp.length === 2) {
            return tmp[0] + ' and ' + tmp[1] + ' fields are missing';
        }
        else {
            return tmp[0] + ', ' + tmp[1] + ', and ' + tmp[2] + ' fields are missing';
        }
    }
}


