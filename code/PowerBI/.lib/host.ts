/// <reference path="../.api/v1.6.0/PowerBI-visuals.d.ts" />


export module host {

    export var visualhost: powerbi.extensibility.visual.IVisualHost;    

    export function init(v: powerbi.extensibility.visual.IVisualHost) {
        visualhost = v;
    }

    export function selectionManager() {
        return visualhost.createSelectionManager();
    }

    export function id(cat: powerbi.DataViewCategoryColumn, row: number) {
        return visualhost.createSelectionIdBuilder().withCategory(cat, +row).createSelectionId();
    }

    export function persist(oname: string, properties: any) {
        visualhost.persistProperties({
            merge: [{
                objectName: oname,
                properties: properties,
                selector: null
            }]
        });
    }

    export function dirtyPersist(view: powerbi.DataView) {
        return Persist.dirty(view);
    }
}

export class Persist<T> {

    private static _metas = [] as Persist<any>[];
    public static dirty(view: powerbi.DataView): boolean {
        var dirty = false;
        for (var v of Persist._metas) {
            if (v._updated(view)) {
                dirty = true;
            }
        }
        return dirty;
    }

    constructor(public oname: string, public pname: string) {
        Persist._metas.push(this);
    }

    private handler = undefined as number;
    private stamp = undefined as string;
    private _updated(view: powerbi.DataView): boolean {
        let oname = this.oname, pname = this.pname;
        let objects = (view && view.metadata && view.metadata.objects);
        if (objects && objects[oname] && objects[oname][pname]) {
            var text = objects[oname][pname] as string;
            var slice = text.slice(0, 13);
            // console.log('persist check...', slice !== this.stamp ? 'UPDATED' : 'UNCHANGED', oname, pname, 'new', slice, 'old', this.stamp, 'data', text);
            if (slice !== this.stamp) {
                this.stamp = slice;
                return true;
            }
        }
        return false;
    }

    public read(view: powerbi.DataView, deft?: any): T {
        let oname = this.oname, pname = this.pname;
        let objects = (view && view.metadata && view.metadata.objects);
        if (objects && objects[oname] && objects[oname][pname]) {
            var text = objects[oname][pname] as string;
            this.stamp = text.slice(0, 13);
            var obj = text.slice(13);
            return JSON.parse(obj) as T;
        }
        return deft || null;
    }    
    public run(props: powerbi.VisualObjectInstancesToPersist, delay: number) {
        let oname = this.oname, pname = this.pname;
        if (this.handler) {
            clearTimeout(this.handler);
        }
        this.handler = window.setTimeout(() => {
            var properties = {};
            var stamp = new Date().getTime();
            properties[pname] = stamp + ' running persist';
            props.merge.push({
                objectName: oname,
                properties: properties,
                selector: null
            });
            host.visualhost.persistProperties(props);
            this.handler = null;
            // console.log('persist run...', this.oname, this.pname, 'new', stamp, 'old', this.stamp);
        }, delay);
    }

    public write(value: T, delay: number) {
        let oname = this.oname, pname = this.pname;
        if (this.handler) {
            clearTimeout(this.handler);
        }
        this.handler = window.setTimeout(() => {
            var properties = {};
            var stamp = new Date().getTime();
            properties[pname] = stamp + JSON.stringify(value);
            host.visualhost.persistProperties({
                merge: [{
                    objectName: oname,
                    properties: properties,
                    selector: null
                }]
            });
            this.handler = null;
            // console.log('persist write... ', this.oname, this.pname, 'new', stamp, 'old', this.stamp, 'value', value);
        }, delay);
    }
}