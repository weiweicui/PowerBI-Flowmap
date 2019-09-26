import { Func } from '../type';

//hardcode 7 global variables to handle jsonp
declare var __geocode_jsonp0;
declare var __geocode_jsonp1;
declare var __geocode_jsonp2;
declare var __geocode_jsonp3;
declare var __geocode_jsonp4;
declare var __geocode_jsonp5;
declare var __geocode_jsonp6;

export namespace jsonp {
    let head: HTMLHeadElement;
    let ids = [0, 1, 2, 3, 4, 5, 6];
    let queue = [] as { url: string, then: Func<any, void> }[];
    function load(url, errorHandler, id, then: Func<any, void>) {
        let script = document.createElement('script'), isLoaded = false;
        script.src = url;
        script.async = true;
 
        if (typeof errorHandler === 'function') {
            script.onerror = e => then(null);
        }
        script.onload = () => {
            if (isLoaded) {
                return;
            }
            isLoaded = true;
            if (queue.length > 0) {
                var q = queue.shift();
                setup(id, q.url, q.then);
            }
            else {
                ids.push(id);
            }
            script.onload = null;
            script && script.parentNode && script.parentNode.removeChild(script);
        };
        head = head || document.getElementsByTagName('head')[0];
        head.appendChild(script);
    }

    function setup(id, url, then) {
        if (id === 0) { __geocode_jsonp0 = then; }
        else if (id === 1) { __geocode_jsonp1 = then; }
        else if (id === 2) { __geocode_jsonp2 = then; }
        else if (id === 3) { __geocode_jsonp3 = then; }
        else if (id === 4) { __geocode_jsonp4 = then; }
        else if (id === 5) { __geocode_jsonp5 = then; }
        else if (id === 6) { __geocode_jsonp6 = then; }
        load(url + '&jsonp=__geocode_jsonp' + id, null, id, then);
    }

    export function get(url, then): void {
        if (ids.length === 0) {
            queue.push({
                url: url,
                then: function (data) { then(data); }
            });
        }
        else {
            setup(ids.shift(), url, function (data) { then(data); });
        }
    }
}
