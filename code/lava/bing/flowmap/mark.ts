import { IListener } from "bing";
import { Banner } from 'banner';
import { Pie, all as pies, get as pie } from './pie';
import { Format } from "./format";
import { $fmt, $cfg, $mapctl, loc } from "./app";
import { util } from "./misc";
import { StringMap, keys, Func } from 'type';
import { Persist } from "host";
import { select } from 'd3-selection';
let root: d3.Any;
let banner: Banner<Pie>;
let selected: StringMap<boolean>;

export function listener(d3: d3.Any): IListener {
    root = d3;
    banner = new Banner<Pie>(root)
        .content(p => marker(p))
        .key(p => key(p))
        .anchor(p => {
            var pnt = $mapctl.pixel(loc(p.addr), Microsoft.Maps.PixelReference.control);
            pnt.y += (p.type === 'out' ? -1 : 1) * p.radius();
            return pnt;
        });
    return {
        transform: () => banner.transform(),
        resize: () => banner.transform()
    };
}

export function init(marks: string[]) {
    selected = {};
    for (let v of marks) {
        selected[v] = true;
    }
}

export function clear() {
    banner.clear();
    //do not set selected to {}, can only be reset explictly
    //since we may need to display them after refreshing
}

export function reset() {
    let label = $fmt.bubble.label;
    if (label === 'manual') {
        pies().sty.cursor('pointer');
    }
    else {
        pies().sty.cursor('default');
    }
    pies().on('click', p => {
        if (label === 'manual') {
            banner.flip(p, p.type === 'out' ? 'top' : 'bottom');
            if (banner.contains(p)) {
                selected[key(p)] = true;
            }
            else {
                delete selected[key(p)];
            }
            $cfg.mark.onChanged && $cfg.mark.onChanged(keys(selected));
        }
    });

    if (label === 'hide') {
        root.sty.display('none');
    }
    else {
        root.sty.display(null);
    }

    banner.clear();
    let oColor = util.rgb($fmt.bubble.originColor.solid.color);
    let dColor = util.rgb($fmt.bubble.destinColor.solid.color);
    banner.background(p => p.type === 'out' ? oColor : dColor);
    banner.opacity(+$fmt.bubble.labelOpacity / 100);

    let prev = JSON.stringify(keys(selected || {}).sort());
    if (label === 'none') {
        selected = {};
    }
    else {
        let add = (p: Pie) => {
            banner.flip(p, p.type === 'out' ? 'top' : 'bottom');
            selected[key(p)] = true;
        }
        if (label === 'all') {
            selected = {};
            pies().each(p => add(p));
        }
        else {
            for (let key of keys(selected).filter(k => pie(k))) {
                add(pie(key));
            }
        }
    }
    if ($cfg.mark.onChanged) {
        let curr = JSON.stringify(keys(selected || {}).sort());    
        if (prev !== curr) {
            $cfg.mark.onChanged(keys(selected || {}));
        }
    }
}

function key(p: Pie) {
    return p.type + ' ' + p.addr;
}

function marker(pie: Pie): HTMLElement {
    let type = $fmt.bubble.for;
    let head = $cfg.label.source, lead = $cfg.label.target;
    if (pie.type !== $fmt.style.direction) {
        [head, lead] = [lead, head];
    }
    let header = head(pie.rows[0]);
    if (type === 'both') {
        header = (pie.type === 'out' ? '(From) ' : '(To) ') + header;
    }
    let div = select(document.createElement('div')).att.class('info').datum(pie);    
    div.append('div').text(header).att.class('header');
    if (!$cfg.label.line) {
        return div.node<HTMLElement>();
    }
    let top = util.top(pie.rows);
    for (let row of top) {
        let prow = div.append('div').att.class('row').datum(row);
        prow.append('div').att.class('cell color').append('svg')
            .append('circle')
            .att.cx(5).att.cy(8).att.r(5)
            .att.fill(r => $cfg.color.conv(r))
            .att.stroke('white').att.stroke_width(1).att.stroke_opacity(0.8);
        prow.append('div').att.class('class title')
            .text(r => lead(r));
        prow.append('div').att.class('cell value')
            .text(r => $cfg.label.line(r));
    }
    if (pie.rows.length > top.length) {
        var prow = div.append('div').att.class('row');
        prow.append('div').att.class('cell color').text('...')
            .sty.text_align('center');
        prow.append('div').att.class('class title');
        prow.append('div').att.class('cell value')
            .text('(' + (pie.rows.length - top.length) + ' more)');
    }
    return div.node<HTMLElement>();
}