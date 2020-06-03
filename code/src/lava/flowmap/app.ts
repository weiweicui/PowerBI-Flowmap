import { Func, StringMap, Action, IRect, dict, keys } from "../type";
import { selex } from "../d3";
import { Controller, MapFormat, GeoQuery, ILocation } from '../bingmap';
import { Config } from "./config";
import { extent } from "d3-array";
import { scaleLinear, interpolateRgb, scaleSqrt, scaleIdentity } from "d3";
import { Legend } from "./legend";
import * as flows from './flow';
import * as pins from './pin';
import * as pies from './pie';
import * as popups from './popup';

export { Config } from './config';

interface Issue {
  unlocate?: string;
  selflink?: string;
  negative?: string;
}

class State {
  public get border(): IRect {
    return { x: 0, y: 0, height: this.mapctl.map.getHeight(), width: this.mapctl.map.getWidth() };
  }
  config = null as Config;
  issues = {} as StringMap<Issue>;
  geocode = {} as StringMap<ILocation>;
  color = null as Func<number, string>;
  width = null as Func<number, number>;
  mapctl = null as Controller;
  loc(addr: string) {
    if (addr in this.config.injections) {
      return this.config.injections[addr];
    }
    if (addr in this.geocode) {
      return this.geocode[addr];
    }
    return null;
  }
  reset(config: Config) {
    this.config = config;
  }
  pixel(addr: string, ref?: Microsoft.Maps.PixelReference) {
    return this.mapctl.pixel(this.loc(addr), ref);
  }
}

export const events = {
  doneGeocoding: null as Func<StringMap<ILocation>, void>,
  flow: flows.events,
  pin: pins.events,
  pie: pies.events,
  popup: popups.events
};

export let $state = new State();

let legend = null as Legend;

export function init(div: HTMLElement, mapFmt: MapFormat, initialPopups: string[], then: Func<Controller, void>) {
  popups.reset(initialPopups);
  const root = selex(div);
  root.append('div').att.id('view').sty.width('100%').sty.height('100%');
  root.append('div').att.id('mark');
  root.append('div').att.id('legend').sty.position('absolute').sty.top('0px').sty.left('0px');
  root.append('div').att.id('warn');
  legend = new Legend(root.select('#legend'));
  const ctl = $state.mapctl = new Controller('#view');
  ctl.restyle(mapFmt, _ => {
    ctl.svg.sty.cursor('default').sty.pointer_events('visiblePainted');
    ctl.add(flows.init(ctl.svg.append('g')));
    ctl.add(pins.init(ctl.svg.append('g')));
    ctl.add(pies.init(ctl.svg.append('g')));
    ctl.add({ resize: _ => legend.resize() });
    ctl.add(popups.init(root.select('#mark')));

    flows.events.hover = rows => {
      if (!rows) {
        pies.hover(null);
      }
      else {
        let srcs = dict(rows, r => $state.config.source(r));
        let tars = dict(rows, r => $state.config.target(r));
        pies.hover(keys(srcs, tars));
      }
    };
    then(ctl);
  });
}

export function tryFitView() {
  const bounds = flows.bounds();
  if (bounds.length) {
    const source = flows.sources();
    let backup = null as ILocation;
    let area = -1;
    for (let i = 0; i < bounds.length; i++) {
      let { margin } = bounds[i];
      let a = margin.south - margin.east;
      a *= margin.north - margin.south;
      if (Math.abs(a) > area) {
        area = Math.abs(a);
        backup = source[i];
      }
    }
    $state.mapctl.fitView(bounds, backup);
  }
}

let geoquery = null as GeoQuery;

function queue(groups: number[][], then: Action) {
  const next = () => {
    if (groups.length === 0) {
      legend.info(null);
      geoquery && geoquery.cancel();
      geoquery = null;
      if (events.doneGeocoding) {
        events.doneGeocoding($state.geocode);
      }
      then && then();
      return;
    }
    const flow = groups.shift(), source = $state.config.source(flow[0]);
    let addrs = [source].concat(flow.map(r => $state.config.target(r)));
    addrs = addrs.filter(d => !$state.loc(d));
    let total = addrs.length, sofar = 0;
    if (addrs.length === 0) {
      addGroup(flow);
      next();
      return;
    }
    sofar = total - addrs.length;
    geoquery = new GeoQuery(addrs);
    const cancel = () => {
      legend.d3('info').sty.cursor('default');
      geoquery && geoquery.cancel();
      geoquery = null;
      legend.info(null);
      addGroup(flow);
      if (events.doneGeocoding) {
        events.doneGeocoding($state.geocode);
      }
      then && then();
    };
    geoquery.run(loc => {
      sofar++;
      if (loc) {
        $state.geocode[loc.address] = loc;
      }
      legend.info(`Geocoding ${sofar}/${total} (click to cancel): ${loc && loc.address}`);
      // console.log(`Geocoding ${sofar}/${total} (click to cancel): ${loc && loc.address}`);
      legend.d3('info').sty.cursor('pointer').on('click', cancel);
      if (sofar === total && geoquery) {
        addGroup(flow);
        next();
        legend.d3('info').sty.cursor('default').on('click', null);
      }
    });
  };
  next();
}


export function reset(cfg: Config, then?: Action) {
  if (geoquery) {
    //cancel last session query
    geoquery.cancel();
    geoquery = null;
  }
  $state.reset(cfg);
  $state.issues = {};
  legend.resize();
  legend.clear();
  rawGroups = [];
  allValids = [];
  flows.clear();
  pins.clear();
  pies.clear();
  popups.clear();
  if (cfg.error) {
    legend.info(cfg.error);
  }
  else {
    queue(cfg.groups, then);
  }
}

export function repaint(cfg: Config, type: 'flow' | 'banner' | 'legend' | 'bubble' | 'map') {
  $state.reset(cfg);
  if (type === 'flow') {
    resetColor();
    resetWidth();
    legend.resize();
    pies.reset(allValids);
    flows.reformat(true, true);
    popups.repaint();
  }
  else if (type === 'legend') {
    legend.resize();
    resetColor();
    resetWidth();
    legend.resize();
  }
  else if (type === 'bubble') {
    pies.reset(allValids);
    popups.repaint();
  }
  else if (type === 'banner') {
    popups.repaint();
  }
  else {
    $state.mapctl.restyle(cfg.map);
  }
}

let rawGroups = [] as number[][];
let allValids = [] as number[];
function addGroup(group: number[]) {
  rawGroups.push(group);
  if ($state.config.advance.relocate) {
    pins.reset(rawGroups);
    return;
  }
  const source = $state.config.source(group[0]);
  if (!$state.loc(source)) {
    $state.issues[group[0]] = { unlocate: source };
    return;
  }
  const groupValid = [] as number[];
  const width = $state.config.weight.conv;
  for (let row of group) {
    const target = $state.config.target(row);
    const issue = {} as Issue;
    if (target === source) {
      ($state.issues[row] = issue).selflink = target;
      allValids.push(row);
    }
    else if (!$state.loc(target)) {
      ($state.issues[row] = issue).unlocate = target;
    }
    else if (+width(row) <= 0) {
      ($state.issues[row] = issue).negative = target;
    }
    else {
      groupValid.push(row);
      allValids.push(row);
    }
  }
  flows.add(groupValid);
  resetColor();
  resetWidth();
  flows.reformat(true, true);
  legend.resize();
  pies.reset(allValids);
  popups.repaint();
}

function resetWidth() {
  const weight = $state.config.weight;
  const domain = flows.reweight(weight.conv), [dmin, dmax] = domain;
  let invert = null as Func<number, number>;
  if ('max' in weight) {
    const { min, max } = weight, range = [min, max];
    if (weight.scale === 'log') {
      let exp = 0.5, pow = scaleSqrt().domain([0, dmax]).range([0, max]);
      while (pow(dmin) > +min && exp < 1.1) {
        pow.exponent(exp += 0.1);
      }
      if (pow(dmin) > min) {
        $state.width = pow;
        invert = pow.invert.bind(pow);
      }
      else {
        const lin = scaleLinear().domain([pow(dmin), max]).range(range);
        $state.width = w => lin(pow(w));
        invert = r => pow.invert(lin.invert(r));
      }
    }
    else {
      const lin = scaleLinear().domain([0, dmax]).range([0, max]);
      if (lin(dmin) < min) {
        lin.domain(domain).range(range);
      }
      $state.width = lin;
      invert = lin.invert.bind(lin);
    }
    legend.rewidth({ invert, scale: $state.width, dmax });
  }
  else if ('unit' in weight) {
    debugger;
    if (weight.unit === null) {
      weight.unit = dmin === dmax ? 3 / dmin : 25 / dmax;
    }
    const lin = scaleLinear().domain(domain).range(domain.map(d => d * weight.unit));
    $state.width = lin;
    invert = lin.invert.bind(lin);
    legend.rewidth({ invert, scale: lin, dmax });
  }
  else if (weight.scale === null) {
    $state.width = scaleIdentity();
    invert = scaleIdentity();
    legend.rewidth({ distinct: $state.config.legend.widthLabels });
  }
}

function resetColor() {
  if ($state.config.legend.colorLabels) {
    legend.recolor({ distinct: $state.config.legend.colorLabels });
  }
  if ($state.config.color.max) {
    //smooth, so color function has to be row=>number
    const value = $state.config.color;
    const domain = extent(allValids, r => value(r) as number);
    const range = [value.min, value.max];
    const scale = scaleLinear<string>().domain(domain).range(range)
      .interpolate(interpolateRgb).clamp(true);
    $state.color = r => scale(value(r) as number);
    if (!$state.config.legend.colorLabels) {
      legend.recolor({ domain, range });
    }
  }
  else {
    $state.color = $state.config.color as Func<number, string>;
  }
}