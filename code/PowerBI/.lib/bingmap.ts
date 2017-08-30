import { Action } from "type";
import { host } from "./host";
import { ILocation } from "bing";

export { Controller, ILayer, append, ILocation } from "bing";

export function load(lang: string, then: Action) {
    let base = "https://ecn.dev.virtualearth.net/mapcontrol/";
    if (lang === 'default') {
        lang = navigator['userLanguage'] || navigator["language"];
    }
    if (lang) {
        loadScript(base + "mapcontrol.ashx?v=7.0&s=1&mkt=" + lang, () => {
            loadScript(base + "v7.0/7.0.20160525132934.57/js/en-us/veapicore.js", then);
        });
    }
    else {
        loadScript(base + "mapcontrol.ashx?v=7.0&s=1", () => {
            loadScript(base + "v7.0/7.0.20160525132934.57/js/en-us/veapicore.js", then);
        });
    }
}
    
export function loadScript(url: string, then: Action): void {
    let head = document.getElementsByTagName('head')[0];
    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    script.onload = then;
    head.appendChild(script);
}

export function defaultZoom(width: number, height: number): number {
    var min = Math.min(width, height);
    for (var level = 1; level < 20; level++) {
        if (256 * Math.pow(2, level) > min) {
            break;
        }
    }
    return level;
}
