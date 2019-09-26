import { Func } from '../lava/type';
import { format } from 'd3-format';
import powerbi from 'powerbi-visuals-api';

export var capability = {
    "displayName": "Tooltip Format",
    "description": "Change the format of values shown in tooltips",
    "properties": {
        "notation": {
            "displayName": "Notation",
            "type": {
                "enumeration": [
                    { "displayName": "None", "value": "none" },
                    { "displayName": "Decimal (SI)", "value": "decSi" },
                    { "displayName": "Decimal", "value": "dec" },
                    { "displayName": "Exponent", "value": "exp" },
                    { "displayName": "Percentage", "value": "per" }
                ]
            }
        },
        "unit": {
            "displayName": "Unit",
            "type": {
                "enumeration": [
                    { "displayName": "None", "value": "none" },
                    { "displayName": "Thousands", "value": "K" },
                    { "displayName": "Millions", "value": "M" },
                    { "displayName": "Billions", "value": "bn" },
                    { "displayName": "Trillions", "value": "T" }
                ]
            }
        },
        "precFix": {
            "displayName": "Precision",
            "description": "The number of digits that follow the decimal point",
            "type": { "numeric": true }
        },
        "precSig": {
            "displayName": "Precision",
            "description": "The number of significant digits",
            "type": { "numeric": true }
        },
        "fix": {
            "displayName": "Fixed point",
            "type": { "bool": true }
        },
        "comma": {
            "displayName": "Comma for thousands",
            "type": { "bool": true }
        },
        "prefix": {
            "displayName": "Prefix",
            "type": { "text": true }
        },
        "postfix": {
            "displayName": "Postfix",
            "type": { "text": true }
        }
    }
};

export class Setting {
    label = "" as string;
    notation = 'none' as 'none' | 'decSi' | 'dec' | 'exp' | 'per';
    unit = 'none' as 'none' | 'K' | 'M' | 'bn' | 'T';
    precFix = 3;
    precSig = 4;
    fix = false;
    prefix = "";
    postfix = "";
    comma = true
}

export function build(setting: Setting): Func<number, string> {
    var func = n => n + "";
    if (setting.notation === 'none') {
        func = n => n + "";
    }
    else if (setting.notation === 'exp') {
        var prec = Math.round(+setting.precSig);
        if (isNaN(prec) || prec < 1) {
            prec = this.default.precSig;
        }
        var conv = format('.' + prec + 'e');
        func = n => conv(n);
    }
    else if (setting.notation === 'per') {
        var flag = setting.fix ? '%' : 'p';
        if (setting.fix) {
            var prec = Math.round(+setting.precFix);
            if (isNaN(prec) || prec < 0) {
                prec = this.default.precFix;
            }
        }
        else {
            var prec = Math.round(+setting.precSig);
            if (isNaN(prec) || prec < 1) {
                prec = this.default.precSig;
            }
        }
        var p = setting.comma ? ',.' : '.';
        var conv = format(p + prec + flag);
        func = n => conv(n);
    }
    else if (setting.notation === 'decSi') {
        var prec = Math.round(+setting.precSig);
        if (isNaN(prec) || prec < 1) {
            prec = this.default.precSig;
        }
        var conv = format('.' + prec + 's');
        func = n => conv(n);
    }
    else if (setting.notation === 'dec') {
        var unit = setting.unit;
        var div = 1;
        if (unit === 'K') {
            div = 1000;
        }
        else if (unit === 'M') {
            div = 1000 * 1000;
        }
        else if (unit === 'bn') {
            div = 1000 * 1000 * 1000;
        }
        else if (unit === 'T') {
            div = 1000 * 1000 * 1000 * 1000;
        }
        var flag = setting.fix ? 'f' : 'r';
        if (setting.fix) {
            var prec = Math.round(+setting.precFix);
            if (isNaN(prec) || prec < 0) {
                prec = this.default.precFix;
            }
        }
        else {
            var prec = Math.round(+setting.precSig);
            if (isNaN(prec) || prec < 1) {
                prec = this.default.precSig;
            }
        }
        var p = setting.comma ? ',.' : '.';
        var conv = format(p + prec + flag);
        if (unit === 'none') {
            func = n => conv(n);
        }
        else {
            func = n => conv(n / div) + unit;
        }
    }

    var pre = setting.prefix.trim();
    var pos = setting.postfix.trim();
    return n => {
        if (n === null || n === undefined || isNaN(+n)) {
            return '';
        }
        var str = func(+n);
        if (pre && pre.length > 0) {
            str = pre + ' ' + str;
        }
        if (pos && pos.length > 0) {
            str = str + ' ' + pos;
        }
        return str;
    }
}

export function visualObjects(format: Setting, oname: string): powerbi.VisualObjectInstance {
    var notation = format.notation;
    var props = {} as Setting;
    props.notation = format.notation;
    if (notation === 'exp' || notation === 'decSi') {
        props.precSig = format.precSig;
    }
    else if (notation === 'per') {
        props.fix = format.fix;
        if (format.fix) {
            props.precFix = format.precFix;
        }
        else {
            props.precSig = format.precSig;
        }
        props.comma = format.comma;
    }
    else if (notation === 'dec') {
        props.unit = format.unit;
        props.fix = format.fix;
        if (format.fix) {
            props.precFix = format.precFix;
        }
        else {
            props.precSig = format.precSig;
        }
        props.comma = format.comma;
    }
    props.prefix = format.prefix;
    props.postfix = format.postfix;
    // console.log(props);
    return {
        objectName: oname,
        properties: props as any,
        selector: null
    };
}