import powerbi from "powerbi-visuals-api";

export class Persist<T> {
  public static HOST = null as powerbi.extensibility.visual.IVisualHost;
  private static _all = [] as Persist<any>[];
  public static update(view: powerbi.DataView): boolean {
    //cannot use _all.some(...), we have to updated every one of them
    var dirty = false;
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

  private _handler = undefined as number;
  private _text = undefined as string;
  private _updated(view: powerbi.DataView): boolean {
    const oname = this.oname, pname = this.pname;
    const objects = (view && view.metadata && view.metadata.objects);
    if (objects && objects[oname] && objects[oname][pname]) {
      const text = objects[oname][pname] as string;
      if (text !== this._text) {
        //true is a short cut, and skip the entire update
        const dirty = this._text !== undefined;
        try {
          this._text = text;
          this._value = JSON.parse(text);
          return dirty;
        } catch (e1) {
          if (text.length > 13) {
            //try to use old version of encoding
            try {
              this._text = text.slice(13);
              this._value = JSON.parse(this._text);
            } catch (e2) {
              this._text = null;
              return false;
            }
          }
          else {
            //safe to ignore
            this._text = null;
            return false;
          }
        }
      }
      else {
        return false;
      }
    }
    this._text = null;
    return false;
  }

  public value(deft?: T): T {
    if (this._value === null && deft !== undefined) {
      return this._value = deft;
    }
    return this._value;
  }

  private _value = null as T;

  public write(value: T, delay: number) {
    this._value = value;
    let oname = this.oname, pname = this.pname;
    if (this._handler) {
      clearTimeout(this._handler);
    }
    this._handler = window.setTimeout(() => {
      if (value) {
        // console.log(`merging persist: ${oname}=>${pname}`);
        Persist.HOST.persistProperties({
          merge: [{
            objectName: oname,
            properties: { [pname]: JSON.stringify(value) },
            selector: null
          }]
        });
      }
      else {
        // console.log(`removing persist: ${oname}=>${pname}`);
        Persist.HOST.persistProperties({
          remove: [{
            objectName: oname,
            properties: { [pname]: null },
            selector: null
          }]
        });
      }
      this._handler = null;
    }, delay);
  }
}