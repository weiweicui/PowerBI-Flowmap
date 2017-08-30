import { Func } from 'type';

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

export function build(format: Setting): Func<number, string> {
    var func = n => n + "";
    if (format.notation === 'none') {
        func = n => n + "";
    }
    else if (format.notation === 'exp') {
        var prec = Math.round(+format.precSig);
        if (isNaN(prec) || prec < 1) {
            prec = this.default.precSig;
        }
        var conv = d3.format('.' + prec + 'e');
        func = n => conv(n);
    }
    else if (format.notation === 'per') {
        var flag = format.fix ? '%' : 'p';
        if (format.fix) {
            var prec = Math.round(+format.precFix);
            if (isNaN(prec) || prec < 0) {
                prec = this.default.precFix;
            }
        }
        else {
            var prec = Math.round(+format.precSig);
            if (isNaN(prec) || prec < 1) {
                prec = this.default.precSig;
            }
        }
        var p = format.comma ? ',.' : '.';
        var conv = d3.format(p + prec + flag);
        func = n => conv(n);
    }
    else if (format.notation === 'decSi') {
        var prec = Math.round(+format.precSig);
        if (isNaN(prec) || prec < 1) {
            prec = this.default.precSig;
        }
        var conv = d3.format('.' + prec + 's');
        func = n => conv(n);
    }
    else if (format.notation === 'dec') {
        var unit = format.unit;
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
        var flag = format.fix ? 'f' : 'r';
        if (format.fix) {
            var prec = Math.round(+format.precFix);
            if (isNaN(prec) || prec < 0) {
                prec = this.default.precFix;
            }
        }
        else {
            var prec = Math.round(+format.precSig);
            if (isNaN(prec) || prec < 1) {
                prec = this.default.precSig;
            }
        }
        var p = format.comma ? ',.' : '.';
        var conv = d3.format(p + prec + flag);
        if (unit === 'none') {
            func = n => conv(n);
        }
        else {
            func = n => conv(n / div) + unit;
        }
    }

    var pre = format.prefix.trim();
    var pos = format.postfix.trim();
    return n => {
        var str = func(n);
        if (pre && pre.length > 0) {
            str = pre + ' ' + str;
        }
        if (pos && pos.length > 0) {
            str = str + ' ' + pos;
        }
        return str;
    }
}

export function visualObjects(format: Setting, oname: string): powerbi.VisualObjectInstance[] {
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
    return [{
        objectName: oname,
        properties: props as any,
        selector: null
    }]
}