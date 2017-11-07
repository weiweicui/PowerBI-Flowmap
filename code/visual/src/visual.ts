declare var app;
module powerbi.extensibility.visual {
    export class Visual implements IVisual {
        private _self: any;
        constructor(options: VisualConstructorOptions) {
            this._self = new app.Visual(options);
        }

        public update(options: VisualUpdateOptions) {
            this._self.update(options);
        }
        public enumerateObjectInstances(options: any): VisualObjectInstance[] {
            return this._self.enumerateObjectInstances(options);
        }
    }
}
