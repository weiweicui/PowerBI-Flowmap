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

    private static _all = [] as Persist<any>[];
    public static dirty(view: powerbi.DataView): boolean {
        //cannot use _all.some(...), we have to updated every one of them
        var dirty = false;
        // console.log(Persist._all.map(a => a.oname));
        for (var v of Persist._all) {
            if (v._updated(view)) {
                dirty = true;
            }
        }
        return dirty;
    }

    constructor(public oname: string, public pname: string) {
        Persist._all.push(this);
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
                // console.log('persist dirty', oname, pname);
                this.stamp = slice;
                return true;
            }
        }
        else if (this.stamp) {
            console.log('#########' + this.oname + ' => ' + this.pname + '############## cannot persist, forget to add it to capabilities.json??');
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
        // console.log('................................................persist...run');
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

    public value(v: T): this;
    public value(): T;

    value(v?: T): any {
        if (v === undefined) {
            return this._value;
        }
        else {
            this._value = v;
            return this;
        }
    }

    private _value = null as T;

    // public push(delay: number) {        
    //     let value = this._value;
    //     // console.log(value, 'persit pushing', this.oname, this.pname);
    //     let oname = this.oname, pname = this.pname;
    //     if (this.handler) {
    //         clearTimeout(this.handler);
    //     }
    //     this.handler = window.setTimeout(() => {
    //         var properties = {};
    //         var stamp = new Date().getTime();
    //         properties[pname] = stamp + JSON.stringify(value);

    //         if (value === null) {
    //             host.visualhost.persistProperties({
    //                 remove: [{
    //                     objectName: oname,
    //                     properties: { pname: null },
    //                     selector: null
    //                 }]
    //             });
    //         }
    //         else {
    //             host.visualhost.persistProperties({
    //                 merge: [{
    //                     objectName: oname,
    //                     properties: properties,
    //                     selector: null
    //                 }]
    //             });
    //         }
    //         this.handler = null;
    //         // console.log(properties[pname]);
    //         // console.log('persist written................', this.oname, this.pname);
    //         // console.log('persist write... ', this.oname, this.pname, 'new', stamp, 'old', this.stamp, 'value', value);
    //     }, delay);
    // }

    public write(value: T, delay: number) {
        this._value = value;
        // console.log(value, 'persit writing', this.oname, this.pname);
        let oname = this.oname, pname = this.pname;
        if (this.handler) {
            clearTimeout(this.handler);
        }
        this.handler = window.setTimeout(() => {
            var properties = {};
            var stamp = new Date().getTime();
            properties[pname] = stamp + JSON.stringify(value);

            if (value === null) {
                host.visualhost.persistProperties({
                    remove: [{
                        objectName: oname,
                        properties: { pname: null },
                        selector: null
                    }]
                });
            }
            else {
                host.visualhost.persistProperties({
                    merge: [{
                        objectName: oname,
                        properties: properties,
                        selector: null
                    }]
                });    
            }
            this.handler = null;
            // console.log('persist written##################', this.oname, this.pname);
            // console.log('persist write... ', this.oname, this.pname, 'new', stamp, 'old', this.stamp, 'value', value);
        }, delay);
    }
}