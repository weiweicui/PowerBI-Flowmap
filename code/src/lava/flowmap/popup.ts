import { IListener } from "../bingmap";
import { Banner } from './banner';
import { Pie, all as pies, get as pie } from './pie';
import * as util from "./util";
import { StringMap, keys } from '../type';
import { ISelex, selex } from "../d3";
import { $state } from './app';

let root: ISelex;
let banner: Banner<Pie>;
let selected: StringMap<boolean>;

export const events = {
    onChanged: null as (addrs: string[]) => void
}

export function init(d3: ISelex): IListener {
    root = d3;
    banner = new Banner<Pie>(root)
        .content(p => marker(p))
        .key(p => key(p))
        .anchor(p => {
            const pnt = $state.pixel(p.addr, Microsoft.Maps.PixelReference.control);
            pnt.y += (p.type === 'out' ? -1 : 1) * p.radius();
            return pnt;
        });
    return {
        transform: () => banner.transform(),
        resize: () => banner.transform()
    };
}

export function reset(marks: string[]) {
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

export function repaint() {
    const label = $state.config.bubble.label;
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
            events.onChanged && events.onChanged(keys(selected));
        }
    });

    if (label === 'hide') {
        root.sty.display('none');
    }
    else {
        root.sty.display(null);
    }

    banner.clear();
    let oColor = util.rgb($state.config.bubble.labelColor.solid.color);
    let dColor = util.rgb($state.config.bubble.labelColor.solid.color);
    banner.background(p => p.type === 'out' ? oColor : dColor);
    banner.opacity(+$state.config.bubble.labelOpacity / 100);

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
    if (events.onChanged) {
        let curr = JSON.stringify(keys(selected || {}).sort());
        if (prev !== curr) {
            events.onChanged(keys(selected || {}));
        }
    }
}

function key(p: Pie) {
    return p.type + ' ' + p.addr;
}

function marker(pie: Pie): HTMLElement {
    let both = $state.config.bubble.in && $state.config.bubble.out;
    let title = $state.config.popup.origin, bullet = $state.config.popup.destination;
    if (pie.type !== 'out') {
        [title, bullet] = [bullet, title];
    }
    let header = title(pie.rows[0]);
    if (!!both) {
        header = (pie.type === 'out' ? '(From) ' : '(To) ') + header;
    }
    let div = selex(document.createElement('div')).att.class('info').datum(pie);
    div.append('div').text(header).att.class('header');
    if (!$state.config.popup.description) {
        return div.node<HTMLElement>();
    }
    const top = util.top(pie.rows, $state.config);
    for (let row of top) {
        let prow = div.append('div').att.class('row').datum(row);
        prow.append('div').att.class('cell color').append('svg')
            .append('circle')
            .att.cx(5).att.cy(8).att.r(5)
            .att.fill(r => $state.color(r))
            .att.stroke('white').att.stroke_width(1).att.stroke_opacity(0.8);
        prow.append('div').att.class('class title')
            .text(r => bullet(r));
        prow.append('div').att.class('cell value')
            .text(r => $state.config.popup.description(r));
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