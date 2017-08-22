import { MapFormat } from 'bing';
import { visualObjects as numberFormatObjects } from 'numberFormat';
import { tooltip } from 'tooltip';
import { initCache } from 'bing/geoService';
import { defaultZoom, Controller } from 'bing';
import { host } from "host";
import { persist } from './app';
import { Selection } from "selection";
import { ISize, copy } from "type";
import { Context } from './grand';
import { Legend } from "./legend";
import { FlowLayer } from "./flowlayer";

export var $con = new Context();
export var $fmt = $con.fmt;

export class Visual implements powerbi.extensibility.visual.IVisual {
    
    private _d3: d3.Any;
    private _div: HTMLElement;
    private _loading = false;
    private _options = null as powerbi.extensibility.visual.VisualUpdateOptions;
    private _persistZoomCenter = true;
    
    constructor(options: powerbi.extensibility.visual.VisualConstructorOptions) {
        host.init(options.host);
        tooltip.init(options);
        $con.tooltipRole = 'Tooltip';
        this._div = options.element;
    }
    
    private _root(key: 'legend' | 'view'): d3.Any {
        return this._d3.select('#lava_' + key);
    }
    
    private _arrange(viewport: ISize) {
        let { show, position } = $fmt.legend.values;
        let { width, height } = viewport;
        let legHeight = show ? $con.legend.height() : 0;
        $con.legend.resize(width);
        this._root('legend').att.width(width).att.height(legHeight);
        this._root('view').sty.width('100%').sty.height(height + 'px');        
        $con.control.arrange(this._root('legend'), position === 'top', legHeight, height);
    }
    
    update<T>(options: powerbi.extensibility.visual.VisualUpdateOptions, viewModel?: T): void {
        if (this._loading) {
            this._options = options;
            return;
        }
        var view = options.dataViews[0] || {} as powerbi.DataView;
        var rect = { x: 0, y: 0, width: options.viewport.width, height: options.viewport.height };
        $con.border = () => rect;

        if (!$con.layer) {
            this._options = options;
            this._loading = true;
            $con.initMetas(options.dataViews[0]);
            this._d3 = d3.select(this._div);
            this._d3.selectAll('*').remove();
            var mapdiv = this._d3.append('div').att.id('lava_view').node<HTMLDivElement>();
            this._d3.append('div').att.id('lava_legend')
                .sty.position('absolute').sty.top('0px').sty.left('0px');
            this._d3.append('div').att.id('lava_banner');
            this._d3.append('div').att.id('lava_warn');
            $con.legend = new Legend(this._root('legend'));
            $con.control = new Controller(mapdiv, map => {
                if (this._persistZoomCenter) {
                    persist.centerzoom.write([map.getCenter(), map.getZoom()], 400);
                }
            });

            var fmt = MapFormat.build($fmt.mapControl.values, $fmt.mapElement.values);
            $con.control.restyle(fmt, map => {
                this._loading = false;
                var view = this._options.dataViews[0];
                var [center, zoom] = persist.centerzoom.read(view, []);
                initCache(persist.geocoding.read(view, {}));
                $con.relocate(persist.manual.read(view, {}), true);
                $con.control.layer($con.layer = new FlowLayer());
                this.update(this._options);
                if (center) {
                    map.setView({ center, zoom });
                    $con.control.viewChange();
                }
                this._arrange(this._options.viewport);
            });
            return;
        }

        $con.control.tryResize();
        if (host.dirtyPersist(view) && !$con.invalid() && !$con.invalid(view)) {
            console.log('return by new persist');
            return;
        }
        
        this._persistZoomCenter = options.type !== 4;
        if (options.type === 4 || options.type === 36) {
            this._arrange(options.viewport);
            $con.control.viewChange();
            $con.legend.rescale() && $con.layer.rescale();
            return;
        }
        if (options.type === powerbi.VisualUpdateType.ViewMode) {
            return;
        }
        //////////////////////////////////////////////
        $con.update(view);        
        this._arrange(options.viewport);
        var fmt = MapFormat.build($fmt.mapElement.values, $fmt.mapControl.values);
        $con.control.restyle(fmt, map => this._arrange(options.viewport));

        if ($fmt.advance.dirty('cache')) {
            if (!$fmt.advance.values.cache) {
                persist.geocoding.write({}, 0);
            }
        }
    }

    enumerateObjectInstances(options: powerbi.EnumerateVisualObjectInstancesOptions): powerbi.VisualObjectInstanceEnumeration {
        let oname = options.objectName;
        if ($fmt.advance.values.relocate) {
            if (oname !== 'advance') {
                return [];                
            }
            return $con.instances(oname).meta(['relocate', 'located', 'unlocated']).dump();
        }
        switch (oname) {
            case 'color':
                return $con.legend.colorFormats();
            case 'valueFormat':
                var ret = $con.instances(oname).meta(['sort', 'top']).dump();
                return ret.concat(numberFormatObjects($fmt.valueFormat.values, oname));
            case 'scale':
                var ins = $con.instances(oname).meta(['scale', 'min', 'autoScale']);
                if (!$fmt.scale.values.autoScale) {
                    ins.meta(['factor']);
                }
                return ins.dump();
            case 'legend':
                var ret = $con.instances(oname).meta(['show', 'position', 'fontSize', 'scale']).dump();
                return ret.concat($con.legend.labelFormats());
            case 'advance':
                return $con.instances(oname).meta(['style', 'direction', 'limit', 'cache', 'relocate']).dump();
            default: 
                return $con.instances(oname as any).dump();
        }
    }
}