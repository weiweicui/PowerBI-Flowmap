import { StringMap, Func } from '../type';
import { ext } from "array";

export type Key = number | string;

export type IPathPoint = number[] & { key?: Key };

export interface IPoint {
    x: number;
    y: number;
    key?: Key;
}

export interface ILayout {
    /**
     * Get a new set of paths, including the subtree rooted at the given path segment
     *  and its way back to the root.
     */
    flow(path: IPath): IPath[];

    /**
     * Give a set of leaves, and get the set of subtrees covering all of them
     */        
    subroots(tars: Key[]): IPath[];

    /**
     * Get all paths, rescale them if needed
     */
    paths(width?: (w: number) => number): IPath[];

    /**
     * Build a new set of path, using the given scale or the previous one
     */    
    build(width?: (w: number) => number): IPath[];

    /**
     * Visit all points inside the layout, including the leaves and intermediate nodes
     */
    visit(v: (p: IPoint) => void): this;
}

export interface IPath {
    /**
     * Get the string describing the path segment, using the given transform or the previous one.
     */
    d(tran?: (input: IPathPoint, output: number[]) => void): string;

    /**
     * Get the width of this path, decided by the layout scale.
     */
    width(scale?: Func<number, number>): number;

    /**
     * identify the same path
     */
    id: string;

    /**
     * weights
     */
    leafs: StringMap<number>;
}

export function layout(source: IPoint, targets: IPoint[], weights?: number[]): ILayout {
    if (weights) {
        var tree = new SpiralTree(source, targets, i => weights[i]);
    }
    else {
        var tree = new SpiralTree(source, targets, i => 1);
    }
    return new FlowLayout(new PathBuilder(tree));
}

//private algoritms
    var config = {
        // This number is used to control the degree of the source. The bigger this value is,
        // the bigger the degree, which means less clutter around the source. The default
        // value is 2, meaning four directions to the root.
        maxPsudoRootCount: 3,

        // For tree edges (a,b) and (b, c), we put two points in them (a, a', b) and (b, c', c).
        // then we draw (a', b, c') as a quadratic curve. So the locations of a' and c' are
        // decided by this value, i.e., length(a', b) = length(a, b) * defaultCurveFraction. 
        // Of course, then length(a', b) is caped by maxCurveSegmentLengthOnScreen. The default
        // value is 0.45.
        defaultCurveFraction: 0.45,

        // This vlaue is the retricting angle between two tree branches. The default is PI/10.        
        alpha: Math.PI / 10,

        // This value is the threshold to check if two points are two close or not. The default
        // value is 1.
        overlapThreshold: 1,

        // Whether branching point is shifted based on weights
        useWeightedJointPoint: true,
        
        // How many iterations called to smooth edges
        sideLeafSmoothIterations: 2
    };

    class FlowPath implements IPath {
        public id       : string;
        public pathWidth: number;
        public lineStart: IPathPoint = [];
        public lineEnd  : IPathPoint = [];
        public curveCtl : IPathPoint = [];
        public curveEnd : IPathPoint = [];
        public weights  : number[];
        public offset   : number[] = [0, 0, 0, 0];// = [unit_dx, unit_dy, length, sign]
        public leafs    : StringMap<number>;
        public conv     = null as (input: IPathPoint, output: number[]) => void;
    
        // public d(conv?: (input: IPathPoint, output: number[]) => void): string {
        //     var result = [] as any[], tmp = [0, 0];
        //     var offx = this.offset[0] * this.offset[2] * this.offset[3];
        //     var offy = this.offset[1] * this.offset[2] * this.offset[3];
        //     this.conv = conv = (conv || this.conv);
        //     conv = conv || (input => { tmp = input; });
        //     conv(this.lineStart, tmp);
        //     result.push("M", tmp[0], tmp[1]);
        //     conv(this.lineEnd, tmp);
        //     result.push("L", tmp[0], tmp[1]);
        //     if (this.curveCtl.length > 0) {
        //         conv(this.curveCtl, tmp);
        //         result.push("Q", tmp[0] + offx, tmp[1] + offy);
        //         conv(this.curveEnd, tmp);
        //         result.push(tmp[0] + offx, tmp[1] + offy);
        //     }
        //     return result.join(' ');
        // }

        public d(conv?: (input: IPathPoint, output: number[]) => void): string {
            var result = [] as any[], tmp = [0, 0];
            var offx = this.offset[0] * this.offset[2] * this.offset[3];
            var offy = this.offset[1] * this.offset[2] * this.offset[3];
            this.conv = conv = (conv || this.conv);
            conv = conv || (input => { tmp = input; });
            conv(this.lineStart, tmp);
            result.push("M", tmp[0], tmp[1]);
            conv(this.lineEnd, tmp);
            if (this.curveCtl.length <= 0) {
                result.push("L", tmp[0], tmp[1]);
            }
            else {
                result.push("C", tmp[0], tmp[1]);
                conv(this.curveCtl, tmp);
                result.push(tmp[0] + offx, tmp[1] + offy);
                conv(this.curveEnd, tmp);
                result.push(tmp[0] + offx, tmp[1] + offy);
            }
            return result.join(' ');
        }
        
        public width(scale?: Func<number, number>): number {
            if (scale) {
                this.pathWidth = scale(this.weights[1]);
                this.offset[2] = scale(this.weights[0]) / 2 - this.pathWidth / 2;
            }
            return this.pathWidth;
        }
    }

    class ChainPath implements IPath {
        index: number;
        flowpath: FlowPath;
        flowchain: FlowPath[];
        main: FlowPath;
        offset: number[];
        conv: (input: IPathPoint, output: number[]) => void;
        constructor(chain: FlowPath[], index: number, main: FlowPath, prev: FlowPath | ChainPath) {
            this.offset = [].concat(chain[index].offset);
            this.flowchain = chain;
            this.index = index;
            this.main = main;
            this.id = main.id + "_up_" + index;
            this.leafs = main.leafs;
            this.prev = prev;
        }
        prev: FlowPath | ChainPath;
        d(conv?: (input: IPathPoint, output: number[]) => void): string {
            var poff = this.prev.offset;
            var lofx = poff[0] * poff[2] * poff[3];
            var lofy = poff[1] * poff[2] * poff[3];        
            var offx = this.offset[0] * this.offset[2] * this.offset[3];
            var offy = this.offset[1] * this.offset[2] * this.offset[3];
            var result = [] as any[], tmp = [0, 0];
            this.conv = conv = (conv || this.conv);
            conv = conv || (input => { tmp = input; });
            var curr = this.flowchain[this.index];
            conv(curr.lineStart, tmp);
            result.push("M", tmp[0] + lofx, tmp[1] + lofy);
            conv(curr.lineEnd, tmp);
            result.push("L", tmp[0] + lofx, tmp[1] + lofy);
            if (curr.curveCtl.length > 0) {
                conv(curr.curveCtl, tmp);
                result.push("Q", tmp[0] + offx, tmp[1] + offy);
                conv(curr.curveEnd, tmp);
                result.push(tmp[0] + offx, tmp[1] + offy);
            }
            return result.join(' ');
        }

        width(scale?: Func<number, number>): number {
            if (scale) {
                var shift = this.main.offset[2] * this.main.offset[3];
                for (var i = 0; i <= this.index; i++) {
                    var p = this.flowchain[i];
                    shift += p.offset[2] * p.offset[3];
                }
                this.offset[2] = Math.abs(shift);
                this.offset[3] = shift > 0 ? 1 : -1;

            }
            return this.main.width();
        }

        readonly id: string;

        leafs: StringMap<number>;
    }

    class FlowLayout implements ILayout {
        private _paths  : FlowPath[] = [];
        private _builder: PathBuilder;
        private _scale  : Func<number, number>;
        private _id2Path: StringMap<FlowPath> = {};
        // private _nodes: NodeKeeper;
        
        constructor(builder: PathBuilder) {
            this._builder = builder;
            // this._nodes = builder.nodes;
            this._paths = builder.build();
            this._id2Path = {};
            for (var p of this._paths) {
                this._id2Path[p.id] = p;
            }
        }

        public subroots(keys: Key[]): IPath[] {
            return this._builder.subroots(keys).map(nid => this._id2Path[nid]);
        }

        public flow(path: FlowPath): IPath[] {
            return this._ancestors(path).concat(path)
                .concat(this._builder.offspring(path.id).map(nid => this._id2Path[nid]));
        }

        public targets(path: FlowPath): StringMap<number> {
            return path.leafs;
        }

        public paths(scale?: Func<number, number>): IPath[] {
            if (scale) {
                this._scale = scale;
                for (var p of this._paths) {
                    p.width(scale);
                }
            }
            return this._paths;
        }

        private _ancestors(path: FlowPath): IPath[] {
            var pid = path.id;
            var chain = this._builder.ancestors(pid).map(id => this._id2Path[id]);
            var result = [] as ChainPath[];
            for (var i = 0; i < chain.length; i++) {
                result.push(new ChainPath(chain, i, path, i === 0 ? path : result[i - 1]));
            }        
            return result;
        }
        
        public build(scale?: Func<number, number>): IPath[] {
            this._paths = this._builder.build();
            this._id2Path = {};
            for (var p of this._paths) {
                this._id2Path[p.id] = p;
            }
            return this.paths(this._scale = (scale || this._scale));
        }

        public visit(v: Func<IPoint, void>): this {
            this._builder.visit(v);
            return this;
        }
    }

    // Helper class to keep a sorted list of (key, value) pairs.
    class SortedList<T> {
        private _key: number[];
        private _value: T[];

        constructor() {
            this.clear();
        }

        public clear() {
            this._key = [];
            this._value = [];
        }

        public insert(key: any, value: T) {
            var i = this.find(key, false);
            this._key.splice(i, 0, key);
            this._value.splice(i, 0, value);
        }

        public remove(index: number) {
            this._key.splice(index, 1);
            this._value.splice(index, 1);
        }

        public indexOf(key: any): number {
            return this.find(key, true);
        }

        public get length(): number {
            return this._key.length;
        }

        public valueAt(index: number): T {
            return this._value[index];
        }

        private find(key: any, exactMatch: boolean): number {
            var left = 0;
            var right = this._key.length;
            while (left < right) {
                var mid = Math.floor((left + right) / 2);
                if (this._key[mid] == key) {
                    return mid;
                }
                if (this._key[mid] < key) {
                    left = mid + 1;
                }
                else {
                    right = mid;
                }
            }
            if (exactMatch) {
                return -1;
            }
            return left;
        }

    }

    module vector {
        export function unit(e1: IPoint, e2: IPoint): [number, number] {
            let a = e2.x - e1.x, b = e2.y - e1.y;
            let s = Math.sqrt(a * a + b * b);
            return [a / s, b / s];
        }

        export function scale(e1: IPoint, e2: IPoint, scale: number): [number, number] {
            let a = e2.x - e1.x, b = e2.y - e1.y;
            return [a * scale, b * scale];
        }

        export function create(e1: IPoint, e2: IPoint): [number, number] {
            return [e2.x - e1.x, e2.y - e1.y];
        }

        export function length(e1: IPoint, e2: IPoint, len: number): [number, number] {
            let a = e2.x - e1.x, b = e2.y - e1.y;
            let s = Math.sqrt(a * a + b * b);
            return [a / s * len, b / s * len];
        }

        export function norm(vec: [number,number]): number {
            return Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1]);
        }
    }

    module point {
        export function add(p: IPoint, vec: [number, number]): IPoint {
            return { x: p.x + vec[0], y: p.y + vec[1] };
        }
        export function middle(s: IPoint, e: IPoint, frac: number): IPoint {
            return { x: e.x * frac + s.x * (1 - frac), y: e.y * frac + s.y * (1 - frac) };
        }
    }

    module util {

        export function cos(p: IPoint, e1: IPoint, e2: IPoint): number {
            var v1 = vector.unit(p, e1);
            var v2 = vector.unit(p, e2);
            return v1[0] * v2[0] + v1[1] * v2[1];
        }

        function length(x1: number, y1: number, x2: number, y2: number): number {
            return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
        }

        export function distance(e1: IPoint, e2: IPoint, square = false): number {
            let a = e2.x - e1.x, b = e2.y - e1.y;
            if (square) {
                return a * a + b * b;
            }
            else {
                return Math.sqrt(a * a + b * b);
            }            
        }

        export function distanceToLine(p: IPoint, e1: IPoint, e2: IPoint): number {
            let len2 = distance(e1, e2);
            // var len2 = Point.Distance(e1, e2);
            len2 = len2 * len2;
            if (len2 == 0) {
                return distance(e1, p);
            }
            var t = ((p.x - e1.x) * (e2.x - e1.x) + (p.y - e1.y) * (e2.y - e1.y)) / len2;
            if (t < 0) {
                return distance(e1, p);
            }
            if (t > 1) {
                return distance(e2, p);
            }
            return length(p.x, p.y, e1.x + t * (e2.x - e1.x), e1.y + t * (e2.y - e1.y));
        }

        // Test if a test node is in a triangle or not.
        export function inTriangle(test: IPoint, p0: IPoint, p1: IPoint, p2: IPoint): boolean {
            var deno = (p1.y - p2.y) * (p0.x - p2.x) + (p2.x - p1.x) * (p0.y - p2.y);
            var a = ((p1.y - p2.y) * (test.x - p2.x) + (p2.x - p1.x) * (test.y - p2.y)) / deno;
            var b = ((p2.y - p0.y) * (test.x - p2.x) + (p0.x - p2.x) * (test.y - p2.y)) / deno;
            var c = 1 - a - b;
            var result0 = 0 <= a && a <= 1 && 0 <= b && b <= 1 && 0 <= c && c <= 1;
            return result0;
        }

        // Test if the test node is on the right or left side of the line segment of (p1, p2).
        export function sign(p1: IPoint, p2: IPoint, test: IPoint): number {
            var x = (p1.x - test.x) * (p2.y - test.y) - (p2.x - test.x) * (p1.y - test.y);
            if (x > 0) return 1;
            if (x < 0) return -1;
            return 0;
        }

        // Binary search in a sorted array.
        export function binarySearch(array: number[], target: number, isSmallest: boolean): number {
            var left = 0;
            var right = array.length;
            while (left < right) {
                var mid = Math.floor((left + right) / 2);
                if (array[mid] == target) {
                    return mid;
                }

                if (array[mid] < target)
                    left = mid + 1;
                else
                    right = mid;
            }
            return ~left;
        }

        export function extent(sorted: number[], min: number, max: number): [number, number] {
            var start = binarySearch(sorted, min, true);
            start = Math.max(0, (start < 0 ? ~start : start) - 1);
            var mark = sorted[start];
            while (start > 0 && sorted[start - 1] == mark) {
                start--;
            }

            var end = binarySearch(sorted, max, false);
            end = end < 0 ? Math.min(sorted.length - 1, ~end) : end;
            var mark = sorted[end];
            while (end < sorted.length - 1 && mark == sorted[end + 1]) {
                end++;
            }
            return [start, end];
        }
    }

    // Helper class to:
    // 1) do range search between (xmin, xmax) and (ymin, ymax).
    // 2) keep the child-parent relations of nodes in the spiral tree.
    class SmoothResult {
        public root: FlowNode;

        private _sprial    = null as SpiralTree;
        private _nid2pare  = {} as StringMap<FlowNode>;
        private _offspring = [] as FlowNode[];
        private _nid2root  = {} as StringMap<FlowNode>;
        private _nid2Node  = {} as StringMap<FlowNode>;
        private _key2Leaf  = {} as StringMap<FlowNode>;
        
        private _psudoRoots(): StringMap<FlowNode> {
            var roots = {} as StringMap<FlowNode>;
            if (!this._sprial.root) {
                return roots;
            }
            
            roots[this._sprial.root.nid] = this._sprial.root;

            let levelDown = (nodes: FlowNode[]) => {
                var result = [] as FlowNode[];
                var threshold = Math.cos(Math.PI / 2);
                for (var node of nodes) {
                    if (node.type !== NodeTypes.Joint) {
                        continue;
                    }
                    if (node.MChild && node.MChild.MChild && node.MChild.PChild) {
                        var cos = util.cos(node.MChild, node.MChild.MChild, node.MChild.PChild);
                        if (cos < threshold) {
                            result.push(node.MChild);
                        }
                    }
                    if (node.PChild && node.PChild.MChild && node.PChild.PChild) {
                        var cos = util.cos(node.PChild, node.PChild.MChild, node.PChild.PChild);
                        if (cos < threshold) {
                            result.push(node.PChild);
                        }
                    }
                }
                return result;
            }
            let tmp = [this._sprial.root];
            for (var i = 0; i < 10; i++) {
                tmp = levelDown(tmp);
                if (tmp.length === 0) {
                    break;
                }
                for (var n of tmp) {
                    roots[n.nid] = n;
                }
                if (Object.keys(roots).length > config.maxPsudoRootCount) {
                    break;
                }
            }
            return roots;
        }

        //return all nodes, excluding the roots or the given nid, in the bfs fashion
        public offspring(nid?: string): FlowNode[] {
            if (nid === undefined) {
                return this._offspring;
            }
            else {
                var queue = [this._nid2Node[nid]];
                var result = [] as FlowNode[];
                var down = (n: FlowNode) => {
                    if (n) {
                        queue.push(n);
                        result.push(n);
                    }
                };
                while (queue.length > 0) {
                    var node = queue.shift();
                    if (node.type === NodeTypes.Joint) {
                        down(node.PChild);
                        down(node.MChild);
                    }
                }
                return result;
            }
        }

        //return parent, ..., excluding roots        
        public ancestors(nid: string): FlowNode[] {
            var node = this._nid2Node[nid];
            var result = [] as FlowNode[];
            var parent = this.parent(node);
            while (parent) {
                if (this._nid2root[parent.nid]) {
                    break;
                }
                result.push(parent);
                parent = this.parent(parent);
            }
            return result;
        }

        public merge(keys: Key[]): string[] {
            var marks = {} as StringMap<boolean>;
            for (var k of keys) {
                marks[k] = true;
            }
            var nids = keys.map(k => this._key2Leaf[k].nid);
            var result = [] as string[];
            while (nids.length > 0) {
                var nid = nids.shift();
                var parent = this.parent(this.node(nid));
                var leafs = Object.keys(parent.leafs);
                while (leafs.every(l => marks[l])) {
                    nid = parent.nid;
                    parent = this.parent(parent);
                    leafs = Object.keys(parent.leafs);
                }
                result.push(nid);
                for (var key of Object.keys(this.node(nid).leafs)) {
                    delete marks[key];
                }
                nids = Object.keys(marks).map(k => this._key2Leaf[k].nid);
            }
            return result;
        }
        
        public node(nid: string): FlowNode {
            return this._nid2Node[nid];
        }

        constructor(spiral: SpiralTree) {
            this._sprial = spiral;    
            let root = this.root = spiral.root;
            if (!root) {
                return;
            }
            let roots = this._nid2root = this._psudoRoots();

            for (var [child, parent] of this._sprial.edges()) {
                this._nid2pare[child.nid] = (roots[parent.nid] ? root : parent);
            }
            
            var collectLeafInfo = (n: FlowNode) => {
                var info = {} as StringMap<number>;
                if (n.type === NodeTypes.Leaf) {
                    info[n.key] = n.weight;
                    n.leafs = info;
                    this._key2Leaf[n.key] = n;
                    return;
                }
                if (n.PChild) {
                    if (!n.PChild.leafs) {
                        collectLeafInfo(n.PChild);
                    }
                    for (var k of Object.keys(n.PChild.leafs)) {
                        info[k] = n.PChild.leafs[k];
                    }
                }
                if (n.MChild) {
                    if (!n.MChild.leafs) {
                        collectLeafInfo(n.MChild);
                    }
                    for (var k of Object.keys(n.MChild.leafs)) {
                        info[k] = n.MChild.leafs[k];
                    }
                }
                n.leafs = info;
            };
            collectLeafInfo(root);

            var queue = [root];
            this._nid2Node[root.nid] = root;
            var queueDown = (n: FlowNode) => {
                if (n) {
                    queue.push(n);
                    if (!roots[n.nid]) {
                        this._nid2Node[n.nid] = n;
                        this._offspring.push(n);
                    }
                    var p = this.parent(n);
                    if (!roots[n.nid] && p && roots[p.nid]) {                        
                        var s = 0;
                        for (var k of Object.keys(n.leafs)) {
                            s += n.leafs[k];
                        }
                    }
                }
            };

            while (queue.length > 0) {
                var node = queue.shift();
                if (node.type === NodeTypes.Joint) {
                    queueDown(node.PChild);
                    queueDown(node.MChild);
                }
            }
        }

        public leaf(key: Key): FlowNode {
            return this._key2Leaf[key];
        }
        
        public parent(node: FlowNode): FlowNode {
            if (node === this._sprial.root || node === null) {
                return null;
            }
            else {
                return this._nid2pare[node.nid];
            }
        }
    }

    class EdgeSmoother {
        private _spiral: SpiralTree = null;

        constructor(tree: SpiralTree) {
            this._spiral = tree;
        }

        // Main function to call to smooth the tree edges
        public run(): SmoothResult {
            if (this._spiral.root) {
                this._adjustInnerAuxNode();
                for (var i = 0; i < config.sideLeafSmoothIterations; i++) {
                    this._adjustSideLeaf();
                }
                this._adjustEndLeaf();
            }
            return new SmoothResult(this._spiral);
        }

        //private
        // Adjust the internal nodes whose one child is leaf and the other is non-leaf.
        private _adjustSideLeaf() {
            for (var node of this._spiral.offspring()) {
                if (node.type !== NodeTypes.Joint) {
                    continue;
                }
                //both children have to be exist
                if (node.MChild === null || node.PChild === null) {
                    continue;
                }
                //one child has to be a leaf
                if (node.MChild.type == NodeTypes.Joint) {
                    if (node.PChild.type == NodeTypes.Joint) {
                        continue;
                    }                    
                }
                var child: FlowNode = null;
                if (node.MChild.type == NodeTypes.Joint) {
                    child = node.MChild;
                }
                else if (node.PChild.type == NodeTypes.Joint) {
                    child = node.PChild;
                }

                if (child) {
                    this._adjustPath(node.parent, node, child);
                }
                else {
                    //impossible
                }
            };
        }

        // Remove the auxNode if it has only one child.
        private _tryRemoveAuxNode(auxNode: FlowNode, child: FlowNode) {
            if (auxNode.PChild != null && auxNode.MChild != null) {
                //exist when both children exist       
                return;
            }
            var parentNode = auxNode.parent;// this._nodeKeeper.parent(auxNode);
            if (parentNode.MChild == auxNode) {
                parentNode.MChild = child;
            }
            else if (parentNode.PChild == auxNode) {
                parentNode.PChild = child;
            }
            child.parent = parentNode;
            // this._nodeKeeper.updateParent(child, parentNode);
        }

        // Try to adjust the location of node, given its parent and child nodes.
        private _adjustPath(parent: FlowNode, self: FlowNode, child: FlowNode) {
            var closenessThreshold = Math.min(self.length(child), self.length(parent)) / 5;
            var hits = this._tryStraighten(parent, self, child, closenessThreshold);
            if (hits == null) {
                this._tryRemoveAuxNode(self, child);
                return;
            }
            if (hits[0].length == 1 && hits[1].length == 0) {
                //the triangle contains one leaf and has no leaf nodes nearby
                var auxPoint = this._calcNewLocation(self, hits[0][0], closenessThreshold);
                self.update(this._spiral.root, auxPoint);
            }
            if (hits[0].length == 0 && hits[1].length == 1) {
                var hitNode = hits[1][0];
                var auxPoint = this._calcNewLocation(self, hitNode, closenessThreshold);
                let minDist = Math.min(hitNode.distance(auxPoint, parent), hitNode.distance(auxPoint, child));
                // var minDist = Math.min(util.Distance(hitNode, auxPoint, parent), util.Distance(hitNode, auxPoint, child));
                if (minDist < hitNode.distance(parent,child)) {
                    //straight line is better than routed
                    this._tryRemoveAuxNode(self, child);
                }
                else {
                    if (util.sign(parent, child, hitNode) == util.sign(parent, child, self)) {
                        this._tryRemoveAuxNode(self, child);
                    }
                    else if (util.sign(parent, child, auxPoint) == util.sign(parent, child, self)) {
                        self.update(this._spiral.root, auxPoint);
                    }
                    else {
                        //nothing
                    }
                }
            }
        }

        // Find a new point between hitNode and node.
        private _calcNewLocation(node: FlowNode, hitNode: FlowNode, threshold: number): IPoint {
            let vec = vector.create(hitNode,node);
            let length = vector.norm(vec);
            let scale = Math.min(length / 2, threshold) / length;
            return {
                x: hitNode.x + vec[0] * scale,
                y: hitNode.y + vec[1] * scale
            };
        }

        // Adjust inner nodes that only have only one non-leaf child.
        private _adjustInnerAuxNode() {
            var allJointNodes: FlowNode[] = [];
            for (var node of this._spiral.offspring()) {
                if (node.type !== NodeTypes.Joint) {
                    continue;
                }            
                var child: FlowNode = null;
                if (!node.MChild && node.PChild.type == NodeTypes.Joint) {
                    child = node.PChild;
                }
                if (!node.PChild && node.MChild.type == NodeTypes.Joint) {
                    child = node.MChild;
                }
                if (child) {
                    this._adjustPath(node.parent, node, child);
                }
            }
        }

        // Try to move the location of node to make the line (parent->node->child) straight
        private _tryStraighten(parent: FlowNode, node: FlowNode, child: FlowNode, closeness: number): FlowNode[][] {

            var candidates = this._spiral.inRange([parent, node, child]);
            var contained = [];
            for (var t of candidates) {
                if (util.inTriangle(t, parent, node, child)) {
                    contained.push(t);
                }
            }

            var tooClose = [];
            for (var t of candidates) {
                if (contained.indexOf(t) < 0 && t.distance(parent, child) < closeness) {
                    tooClose.push(t);
                }
            }

            if (contained.length === 0 && tooClose.length === 0) {
                let vec = vector.length(parent, child, util.distance(parent, node));
                node.update(this._spiral.root, point.add(parent, vec));
                return null;
            } else {
                return [contained, tooClose];
            }
        }

        // Adjust the leaf nodes, to make sure the angle of (grandpa<-parent->leaf) is big enough
        private _adjustEndLeaf() {
            for (var node of this._spiral.offspring()) {
                if (node.type === NodeTypes.Joint) {
                    continue;
                }
                var parent = node.parent;
                if (parent === this._spiral.root) {
                    continue;
                }

                var grandpa = parent.parent;
                if (parent.MChild == null || parent.PChild == null) {
                    //there is no sibling leaf node, we move the parent node closer to the leaf node
                    let newPoint = point.add(parent, vector.scale(parent, node, 0.5));
                    let safe = true;
                    for (var c of this._spiral.inRange([node, parent, grandpa])) {                        
                        if (util.inTriangle(c, node, parent, newPoint)) {
                            safe = false;
                            break;
                        }
                        else if (util.inTriangle(c, parent, grandpa, newPoint)) {
                            safe = false;
                            break;
                        }
                    }
                    safe && parent.update(this._spiral.root, newPoint);
                    continue;
                }
                let cos = util.cos(parent, node, grandpa);
                if (cos > 0 - Math.cos(config.alpha * 3)) {
                    // the angle of (grandpa<-parent->leaf) is too small
                    if (parent.PChild == node) {
                        //add one more node to make sure
                        //the path of (grandpa->parent->childMinus) does not change
                        var jnode = this._spiral.createJointNode(parent, parent.MChild, null);
                        parent.MChild = jnode;
                        if (jnode.MChild) {
                            jnode.MChild.parent = jnode;
                        }
                        jnode.parent = parent;
                    }
                    else {
                        //add one more node to make sure
                        //the path of (grandpa->parent->childPlus) does not change
                        var jnode = this._spiral.createJointNode(parent, null, parent.PChild);
                        parent.PChild = jnode;
                        if (jnode.PChild) {
                            jnode.PChild.parent = jnode;
                        }
                        jnode.parent = parent;
                    }
                    var newParentPoint = point.add(parent, vector.scale(parent, grandpa, 0.5));
                    parent.update(this._spiral.root, newParentPoint);
                }
            }
        }
    }

    // 1) keeps a list of FlowNode that ordered by Theta
    // 2) keeps the info of joint nodes between neighboring FlowNodes
    class NodeKeeper {
        private _sortedByTheta: SortedList<FlowNode> = null;
        private _jointList: PolarNode[] = null;
        private _tryJoinFunc: (left: FlowNode, right: FlowNode) => PolarNode = null;

        constructor(tryJoinFunc: (left: FlowNode, right: FlowNode) => PolarNode) {
            this._tryJoinFunc = tryJoinFunc;
            this._sortedByTheta = new SortedList<FlowNode>();
            this._jointList = [];
        }

        public length(): number {
            return this._sortedByTheta.length;
        }

        public insert(node: FlowNode) {
            this._sortedByTheta.insert(node.theta, node);
            if (this.length() == 1) {
                this._jointList.push(null);
            }
            else {
                var index = this._sortedByTheta.indexOf(node.theta);
                this._jointList.splice(index, 0, null);
                var prevIndex = index == 0 ? this.length() - 1 : index - 1;
                var nextIndex = index == this.length() - 1 ? 0 : index + 1;
                var prevNode = this._sortedByTheta.valueAt(prevIndex);
                var nextNode = this._sortedByTheta.valueAt(nextIndex);
                //update the joint node info
                this._jointList[prevIndex] = this._tryJoinFunc(prevNode, node);
                this._jointList[index] = this._tryJoinFunc(node, nextNode);
            }
        }

        public remove(node: FlowNode) {
            var index = this._sortedByTheta.indexOf(node.theta);
            this._sortedByTheta.remove(index);

            this._jointList.splice(index, 1);
            if (this._jointList.length == 0) {
                return;
            }
            else if (this._jointList.length == 1) {
                this._jointList[0] = null;
                return;
            }

            var prevIndex = index == 0 ? this.length() - 1 : index - 1;
            var prevNode = this._sortedByTheta.valueAt(prevIndex);
            var currNode = this._sortedByTheta.valueAt(index == this.length() ? 0 : index);
            //update the joint node info
            this._jointList[prevIndex] = this._tryJoinFunc(prevNode, currNode);
        }

        public values(): FlowNode[] {
            var temp: FlowNode[] = [];
            for (var i = 0; i < this._sortedByTheta.length; i++) {
                temp.push(this._sortedByTheta.valueAt(i));
            }
            return temp;
        }

        // Go through every pair of neighboring FlowNodes, and find the one that the joint node
        // has biggest radius
        public getMaxRadiusPair(): PolarNode {
            var index = -1;
            var maxSoFar = Number.NEGATIVE_INFINITY;
            for (var i = 0; i < this._jointList.length; i++) {
                var tmp = this._jointList[i];
                if (tmp != null) {
                    if (tmp.radius > maxSoFar) {
                        index = i;
                        maxSoFar = tmp.radius;
                    }
                }
            }
            if (index < 0) {
                return null;
            }
            return this._jointList[index];
        }

        // Find the neighoring FlowNodes based on Theta
        public searchNeighbours(target: FlowNode): FlowNode[] {
            var length = this.length();
            if (length <= 1) {
                return null;
            }
            var idx = this._sortedByTheta.indexOf(target.theta);
            if (idx < 0) {
                throw "cannot find the theta in the sorted list";
            }
            //considering the angles go in circles
            var smaller = this._sortedByTheta.valueAt(idx == 0 ? length - 1 : idx - 1);
            var bigger = this._sortedByTheta.valueAt(idx == length - 1 ? 0 : idx + 1);
            return [smaller, bigger];
        }

        public clear() {
            this._sortedByTheta.clear();
        }
    }

    // The relation between a child and its parent
    enum Rotate {
        // if the theta of the child is smaller than the parent, the relation is Plus
        Plus = 1,
        // if the theta of the child is bigger than the parent, the relation is Minus
        Minus = -1
    };

    class NodeTypes {
        static Joint = "joint";
        static Leaf = "leaf";
    }

    interface Polar {
        radius: number;
        theta: number;
    }

    interface PolarNode {
        radius: number;
        theta: number;
        PChild: FlowNode;
        MChild: FlowNode;
    }

    class FlowNode implements IPoint {
        public x: number;
        public y: number;
        public key: Key;
        
        public parent: FlowNode;
        public radius: number;
        public theta: number;
        public weight: number;
        public leafs: StringMap<number>;
        public type: string;
        public nid: string;
        public PChild: FlowNode;
        public MChild: FlowNode;

        private static _CNT: number = 1;
        constructor() {
            this.nid = 'flownode_' + FlowNode._CNT++;
        }

        public length(point: IPoint): number {
            return util.distance(this, point);
        }

        public distance(e1: IPoint, e2: IPoint): number {
            return util.distanceToLine(this, e1, e2);
        }

        public update(origin: IPoint, point: IPoint) {
            this.x = point.x;
            this.y = point.y;
            this.radius = util.distance(origin, point);
            // this.radius = Point.Distance(origin, point);
            this.theta = FlowNode._CalcTheta(point.x - origin.x, point.y - origin.y, this.radius);
        }

        public static Create(x: number, y: number, r: number, t: number, w: number, type: string, obj: Key): FlowNode {
            var result = new FlowNode();
            result.x = x;
            result.y = y;
            result.weight = w;
            result.type = type;
            result.radius = r;
            result.theta = t;
            result.key = obj;
            return result;
        }

        public static FromPolar(origin: IPoint, point: Polar, weight: number, type: string): FlowNode {
            var x = point.radius * Math.cos(point.theta) + origin.x;
            var y = point.radius * Math.sin(point.theta) + origin.y;
            return FlowNode.Create(x, y, point.radius, point.theta, weight, type, null);
        }

        public static FromCartesian(origin: IPoint, point: IPoint, weight: number, type: string): FlowNode {
            var radius = util.distance(origin, point);
            var theta = FlowNode._CalcTheta(point.x - origin.x, point.y - origin.y, radius);
            return FlowNode.Create(point.x, point.y, radius, theta, weight, type, point.key);
        }

        private static _CalcTheta(dx: number, dy: number, radius: number) {
            if (radius == 0) {
                return 0;
            }
            var theta = Math.acos(dx / radius);
            if (dy < 0) {
                return 2 * Math.PI - theta;
            }
            else {
                return theta;
            }
        }
    }

    class SpiralTree {

        private static _TWO_PI = Math.PI * 2;
        //used to cache the intermediate result of calculations
        private _nodeKeeper: NodeKeeper = null;
        //used to record all destination Node, must be sorted by radius (from large to small) distance before building tree.
        private _destList: FlowNode[] = null;
        //used to record the source Node
        private _source: IPoint = null;
        //used to ensure that there are no nodes share the same angle Theta
        private _duplicatedAngleChecker: {} = null;

        //the root node of spiral tree, it is literally the source point, but it's converted into a joinNode
        public root: FlowNode = null;

        constructor(src: IPoint, tars: IPoint[], weight?: Func<number, number>) {
            let mark = {} as StringMap<true>;
            mark[src.x + ',' + src.y] = true;
            let smallx = ext(tars, t => t.x)[2] / 100000;
            let smally = ext(tars, t => t.y)[2] / 100000;
            for (let t of tars) {
                let key = t.x + ',' + t.y;
                while (key in mark) {
                    t.x += smallx * Math.random();
                    t.y += smally * Math.random();
                    key = t.x + ',' + t.y;
                }
                mark[key] = true;
            }
            this._nodeKeeper = new NodeKeeper(this._tryJoin);
            this._destList = [];
            this._duplicatedAngleChecker = {};
            this._destList = [];
            this._source = src;
            weight = weight || (w => 1);
            for (var i = 0, len = tars.length; i < len; i++) {
                var node = FlowNode.FromCartesian(src, tars[i], weight(i), NodeTypes.Leaf);
                this._destList.push(node);                
            }
            this._destList.sort((a, b) => { return b.radius - a.radius });
            this._build();
        }
        
        public offspring(): FlowNode[] {
            var result = [] as FlowNode[];
            if (!this.root) {
                return result;
            }            
            var queue = [this.root];
            while (queue.length > 0) {
                var node = queue.shift();
                if (node.type == NodeTypes.Joint) {
                    if (node.PChild) {
                        var child = node.PChild;
                        queue.push(child);
                        result.push(child);
                    }
                    if (node.MChild) {
                        var child = node.MChild;
                        queue.push(child);
                        result.push(child);
                    }
                }
            }
            return result;
        }

        public visit(act: (n: FlowNode) => void): void {
            if (!this.root) {
                return;
            }
            var queue = [this.root];
            act(this.root);
            while (queue.length > 0) {
                var node = queue.shift();
                if (node.type == NodeTypes.Joint) {
                    if (node.PChild) {
                        var child = node.PChild;
                        queue.push(child);
                        act(child);
                    }
                    if (node.MChild) {
                        var child = node.MChild;
                        queue.push(child);
                        act(child);
                    }
                }
            }
        }

        // get all edges (DFS) in this tree like this [[child, parent], [child, parent], ...].        
        public edges(node: FlowNode = null): [FlowNode, FlowNode][] {
            var result: [FlowNode, FlowNode][] = [];
            if (!node) {
                node = this.root;
            }
            if (node && node.type == NodeTypes.Joint) {
                var plus = node.PChild;
                var minus = node.MChild;
                if (plus != null) {
                    result.push([plus, node]);
                    result.push(...this.edges(plus));
                }
                if (minus != null) {
                    result.push([minus, node]);
                    result.push(...this.edges(minus));
                }
            } else {
                //do nothing
            }
            return result;
        }

        public createJointNode(polar: Polar, childMinus: FlowNode, childPlus: FlowNode): FlowNode {
            var weight = childMinus == null ? 0 : childMinus.weight;
            weight += childPlus == null ? 0 : childPlus.weight;
            var leafs = {};
            var ret = FlowNode.FromPolar(this._source, polar, weight, NodeTypes.Joint);
            ret.PChild = childPlus;
            ret.MChild = childMinus;
            return ret;
        }

        // Get all the leaves that fall in the bounding box (expanded by the size of buffer)
        // of passed-in nodes.
        public inRange(nodes: IPoint[]): FlowNode[] {

            var minX = nodes[0].x, maxX = minX;
            var minY = nodes[0].y, maxY = minY;

            for (var node of nodes) {
                if (node.x < minX) minX = node.x;
                if (node.x > maxX) maxX = node.x;
                if (node.y < minY) minY = node.y;
                if (node.y > maxY) maxY = node.y;
            }
            
            var [startX, endX] = util.extent(this._sortedX, minX, maxX);
            var [startY, endY] = util.extent(this._sortedY, minY, maxY);

            //now we test every node that between minX, minY and maxX, maxY
            var result = [] as FlowNode[], temp = {} as StringMap<boolean>;
            for (var i = startX; i <= endX; i++) {
                temp[this._sortedByX[i].key] = true;
            }
            for (var n of nodes) {
                temp[n.key] = false;
            }

            for (var i = startY; i <= endY; i++) {
                if (temp[this._sortedByY[i].key]) {
                    result.push(this._sortedByY[i]);
                }
            }
            return result;
        }
        
        //private
        // main function to build the spiral tree
        private _build(): this {
            //Start the greedy spiral tree algorithm
            this._nodeKeeper.clear();
            this._duplicatedAngleChecker = {};
            var destIndex = 0;
            var jointNode: FlowNode = null;

            //_destinationList keeps the sorted (from far to near) destinations
            while (destIndex < this._destList.length || this._nodeKeeper.length() != 0) {
                if (destIndex >= this._destList.length && jointNode == null) {
                    //break when every destination is processed
                    var node = this._nodeKeeper.values()[0];
                    this.root = this._createAuxCircleJointNode(node, 0, Rotate.Plus);
                    this._nodeKeeper.remove(node);
                    break;//done with the last destination (the closest one)
                }
                //process the most distant destination in the remaining
                var mostDistantLeaf = this._destList[destIndex];
                destIndex++;

                //make sure the Theta in this node is unique globally
                this._ensureNodeThetaUnique(mostDistantLeaf);

                //add to the wave front collection
                this._nodeKeeper.insert(mostDistantLeaf);

                this._replaceWithAuxNodeIfNotJoinable(mostDistantLeaf);

                var nextLargestRadius = destIndex < this._destList.length ? this._destList[destIndex].radius : 0;

                jointNode = this._generateJointNode(nextLargestRadius);

                while (jointNode != null) {
                    this._processJointNode(jointNode);
                    jointNode = this._generateJointNode(nextLargestRadius);
                }
            }
            this.visit(n => {
                if (n && n.MChild) {
                    n.MChild.parent = n;
                }
                if (n && n.PChild) {
                    n.PChild.parent = n;
                }
            });
            
            if (this.root) {
                this._sortedByX = [this.root];
                this._sortedByY = [this.root];
                for (var node of this.offspring()) {
                    if (node.type === NodeTypes.Leaf) {
                        this._sortedByX.push(node);
                        this._sortedByY.push(node);
                    }
                }
                this._sortedByX.sort((a, b) => a.x - b.x);
                this._sortedX = this._sortedByX.map(v => v.x);
                this._sortedByY.sort((a, b) => a.y - b.y);
                this._sortedY = this._sortedByY.map(v => v.y);
            }
            return this;
        }

        private _sortedByX = [] as FlowNode[];
        private _sortedX   = [] as number[];
        private _sortedByY = [] as FlowNode[];
        private _sortedY   = [] as number[];

        private _tryJoin(rightNode: FlowNode, leftNode: FlowNode): PolarNode {
            if (rightNode.radius == 0 || leftNode.radius == 0) {
                //either p1 or p2 is the _source
                var ret = new FlowNode();
                ret.radius = 0;
                ret.theta = 0;
                return ret;
            }

            var tanAlpha = Math.tan(config.alpha);

            var thetaDelta = leftNode.theta - rightNode.theta;
            thetaDelta = SpiralTree._EnsureBetweenZeroAndTwoPi(thetaDelta);
            thetaDelta = thetaDelta / tanAlpha;

            var radiusDelta = Math.log(rightNode.radius / leftNode.radius);

            //tPlus and tMinus are the final tValues of node1 and node2x
            var tPlus = (thetaDelta + radiusDelta) / 2;
            var tMinus = (thetaDelta - radiusDelta) / 2;

            if (SpiralTree._IsValid(tPlus, tMinus, Math.PI / tanAlpha)) {
                var jointTheta = rightNode.theta + tanAlpha * tPlus;
                var jointRadius = rightNode.radius * Math.exp(-tPlus);
                jointTheta = SpiralTree._EnsureBetweenZeroAndTwoPi(jointTheta);
                var ret = new FlowNode();
                ret.theta = jointTheta;
                ret.radius = jointRadius;
                ret.MChild = leftNode;
                ret.PChild = rightNode;
                return ret;
            }
            else {
                return null;
            }
        }

        /// <summary>
        /// search for every two adjacent Nodes and check whether their paths can join together
        /// </summary>
        /// <param name="waveFront">a data set that stores every unhandlered nodes</param>
        /// <param name="minRadius"></param>
        /// <returns>return the most likely joinNode</returns>
        private _generateJointNode(radiusThreshold: number): FlowNode {
            var max = this._nodeKeeper.getMaxRadiusPair();
            if (max == null) {
                return null;
            }
            else {
                if (max.radius < radiusThreshold) {
                    return null;
                }
                var result = this.createJointNode(max, max.MChild, max.PChild);
                if (config.useWeightedJointPoint) {
                    var tmp = this._weightedJointNode(result.PChild, result.MChild, radiusThreshold);
                    if (tmp != null) {
                        return tmp;
                    }
                }
                return result;
            }
        }

        private _weightedJointNode(rightNode: FlowNode, leftNode: FlowNode, radiusThreshold: number): FlowNode {
            if (rightNode.radius == 0 || leftNode.radius == 0) {
                return FlowNode.Create(this._source.x, this._source.y, 0, 0, 0, NodeTypes.Joint, this._source.key);
            }
            var tan2Alpha = Math.tan(config.alpha * 2);
            var thetaDelta = leftNode.theta - rightNode.theta;
            thetaDelta = SpiralTree._EnsureBetweenZeroAndTwoPi(thetaDelta);
            thetaDelta = thetaDelta / tan2Alpha;
            var radiusDelta = Math.log(rightNode.radius / leftNode.radius);

            var polar: Polar = { radius: 0, theta: 0 };

            var tPlus = (thetaDelta + radiusDelta) / 2;
            var tMinus = (thetaDelta - radiusDelta) / 2;

            if (!SpiralTree._IsValid(tPlus, tMinus, Math.PI / tan2Alpha)) {
                return null;
            }

            if (leftNode.type == NodeTypes.Joint && rightNode.type != NodeTypes.Joint) {
                tPlus = thetaDelta;
                tMinus = thetaDelta - radiusDelta;

                polar.radius = rightNode.radius * Math.exp(-tPlus);
                polar.theta = leftNode.theta;
            }
            else if (rightNode.type == NodeTypes.Joint && (leftNode.type != NodeTypes.Joint)) {
                tPlus = thetaDelta + radiusDelta;
                tMinus = thetaDelta;

                polar.radius = rightNode.radius * Math.exp(-tPlus);
                polar.theta = rightNode.theta;
            }
            else if (leftNode.weight > rightNode.weight) {
                tPlus = thetaDelta;
                tMinus = thetaDelta - radiusDelta;

                polar.radius = rightNode.radius * Math.exp(-tPlus);
                polar.theta = leftNode.theta;
            }
            else if (rightNode.weight > leftNode.weight) {
                tPlus = thetaDelta + radiusDelta;
                tMinus = thetaDelta;

                polar.radius = rightNode.radius * Math.exp(-tPlus);
                polar.theta = rightNode.theta;
            }
            else {
                return null;
            }

            if (polar.radius < radiusThreshold) {
                return null;
            }
            return this.createJointNode(polar, leftNode, rightNode);
        }

        /// <summary>
        /// calculate a temporary stein node that is moved from current point
        /// called when there is no proper point to join with current point due to the large difference of radius
        /// the path of current point with larger radius can only go towards source point further without joining other points
        /// </summary>
        /// <param name="node">input Node that doesn't have proper point to join with</param>
        /// <param name="auxRadius">decide the radius of result Node</param>
        /// <param name="sign">decide the direction(angle) the Node moved from input Node.it is used to improve to the chance for new calculated Node to join with other Nodes</param>
        /// <returns></returns>
        private _createAuxCircleJointNode(node: FlowNode, auxRadius: number, sign: Rotate): FlowNode {
            if (auxRadius == 0) {
                //the target radius is the root, return source
                var root = FlowNode.Create(this._source.x, this._source.y, 0, 0, node.weight, NodeTypes.Joint, this._source.key);
                root.PChild = node;
                return root;
            }
            else {
                var auxTi = 0 - Math.log(auxRadius / node.radius);
                var auxTheta = node.theta + Math.tan((<number>sign) * config.alpha) * auxTi;
                auxTheta = SpiralTree._EnsureBetweenZeroAndTwoPi(auxTheta);
                var polar: Polar = { radius: auxRadius, theta: auxTheta };
                if (sign == Rotate.Plus) {
                    return this.createJointNode(polar, null, node);
                }
                else {
                    return this.createJointNode(polar, node, null);
                }
            }
        }

        /// <summary>
        /// insert input node into waveFront set and handle some special cases
        /// there are literally two special cases that needs to be handled
        /// 1.current node can not join with its left node(by comparing their angles)
        /// 2.current node can not join with its right node
        /// </summary>
        /// <param name="currNode">next unhandlered node</param>
        private _replaceWithAuxNodeIfNotJoinable(currNode: FlowNode) {
            var rightAndLeft = this._nodeKeeper.searchNeighbours(currNode);
            if (rightAndLeft == null) {
                return;
            }
            var right = rightAndLeft[0];//has smaller Theta
            var left = rightAndLeft[1]; //has larger Theta
            if (currNode != left && this._tryJoin(currNode, left) == null) {
                //left and current cannot join, so we connect left with an aux node (radius = curr.radius)
                //and replace left with the aux node
                this._replaceWithAuxCircleJointNode(left, currNode.radius, Rotate.Plus);
            }
            else if (currNode != right && this._tryJoin(right, currNode) == null) {
                //right (smaller theta) and currentNode cannot join
                this._replaceWithAuxCircleJointNode(right, currNode.radius, Rotate.Minus);
            }
            else {
                //currentNode is join-able
            }
        }

        private _replaceWithAuxCircleJointNode(toBeReplaced: FlowNode, auxRadius: number, sign: Rotate) {
            var newJointNode = this._createAuxCircleJointNode(toBeReplaced, auxRadius, sign);
            this._nodeKeeper.remove(toBeReplaced);
            this._nodeKeeper.insert(newJointNode);
        }

        /// <summary>
        /// check whether the current joinNode overlaps with any terminal nodes and change the path of joinNode to avoid them
        /// </summary>
        /// <param name="jointNode">input joinNode</param>
        private _processJointNode(jointNode: FlowNode) {
            //pre-step for processing if the steiner node overlaps with the terminals
            if (SpiralTree._TooClose(jointNode.MChild, jointNode.PChild, config.overlapThreshold * 3)) {
                //if plus and minus are too close,  nothing we can do
                this._nodeKeeper.remove(jointNode.PChild);
                this._nodeKeeper.remove(jointNode.MChild);
                this._nodeKeeper.insert(jointNode);
            }
            else if (SpiralTree._TooClose(jointNode, jointNode.PChild, config.overlapThreshold)) {
                //if joint is very close to child-plus
                this._replaceWithAuxCircleJointNode(jointNode.MChild, jointNode.PChild.radius, Rotate.Plus);
            }
            else if (SpiralTree._TooClose(jointNode, jointNode.MChild, config.overlapThreshold)) {
                //if joint is very close to child-minus
                this._replaceWithAuxCircleJointNode(jointNode.PChild, jointNode.MChild.radius, Rotate.Minus);
            }
            else {
                this._nodeKeeper.remove(jointNode.PChild);
                this._nodeKeeper.remove(jointNode.MChild);
                this._nodeKeeper.insert(jointNode);
            }
        }

        private _ensureNodeThetaUnique(node: FlowNode) {
            var smallAngle = 0.000000001;
            var value = 0.0;

            value = this._duplicatedAngleChecker[node.theta];

            if (value != undefined) {
                this._duplicatedAngleChecker[node.theta] += smallAngle;
                node.theta += value;
            }
            else {
                this._duplicatedAngleChecker[node.theta] = smallAngle;
            }
        }

        private static _IsValid(tPlus: number, tMinus: number, maxValue: number): boolean {
            return tPlus * tMinus > 0 && tPlus < maxValue && tMinus < maxValue;
        }

        private static _EnsureBetweenZeroAndTwoPi(theta: number): number {
            while (theta > SpiralTree._TWO_PI) {
                theta -= SpiralTree._TWO_PI;
            }
            while (theta < 0) {
                theta += SpiralTree._TWO_PI;
            }
            return theta;
        }

        private static _TooClose(node1: IPoint, node2: IPoint, threshold: number): boolean {
            return util.distance(node1, node2) <= threshold;
        }
    }

    class PathBuilder {
        private _spiral  = null as SpiralTree;
        private _nodes  = null as SmoothResult;
        private _fracs   = null as StringMap<number>;
        constructor(tree: SpiralTree) {
            this._spiral = tree;
            this._nodes = new EdgeSmoother(this._spiral).run();
            this._fracs  = {};
            for (var self of this._nodes.offspring()) {
                var pare = this._nodes.parent(self);
                var gran = this._nodes.parent(pare);
                if (!pare || !gran) {
                    continue;
                }
                var hits = [] as FlowNode[];
                for (var c of this._spiral.inRange([self, pare, gran])) {
                    if (util.inTriangle(c, self, pare, gran)) {
                        hits.push(c);
                    }
                }

                var frac = config.defaultCurveFraction;
                if (hits.length != 0) {
                    var dist = 0;
                    for (var h of hits) {
                        dist = Math.max(h.distance(self, gran), dist);
                    }
                    var pdistance = pare.distance(self, gran);
                    if (dist < pdistance) {
                        frac = Math.min(frac, 1 - dist / pare.distance(self, gran));
                    }
                }
                //triangle of [self, pare, gran]
                //the desired frac of [para --> self] and [para --> gran]
                this._fracs[self.nid] = frac;
            }
        }

        public offspring(nid?: string): string[] {
            return this._nodes.offspring(nid).map(n => n.nid);
        }

        public subroots(keys: Key[]): string[]{
            return this._nodes.merge(keys);
        }
        
        public ancestors(nid: string): string[] {
            return this._nodes.ancestors(nid).map(n => n.nid);
        }

        public build(): FlowPath[] {
            var vectorOne = {};
            var vectorTwo = {};
            for (var self of this._nodes.offspring()) {
                var frac = this._fracs[self.nid];
                if (!frac) {
                    continue;
                }
                var pare = this._nodes.parent(self);
                var gran = this._nodes.parent(pare);
                //two stops in each edge, to avoid each internal node
                //the second stop ==> curve ==> the first stop
                vectorOne[self.nid] = vector.scale(pare, self, frac);
                vectorTwo[pare.nid] = vector.scale(gran, pare, frac);
            }

            var result = [], offspring = this._nodes.offspring();
            var minusRotate = [0, 1, -1, 0], plusRotate = [0, -1, 1, 0];
            for (var i = 0, len = offspring.length; i < len; i++) {
                var self = offspring[i];
                var pare = this._nodes.parent(self);
                var gran = this._nodes.parent(pare);

                var path = result[i] = new FlowPath();
                path.id      = self.nid;
                path.weights = [pare.weight, self.weight];
                path.leafs   = self.leafs;
                
                if (self.type === NodeTypes.Leaf) {
                    path.lineStart.key = self.key;
                    path.lineStart.push(self.x, self.y);
                }
                else {
                    var vec = vectorTwo[self.nid];
                    path.lineStart.push(self.x - vec[0], self.y - vec[1]);
                }
                
                if (gran) {
                    var selfSeg = vectorOne[self.nid];
                    var pareSeg = vectorTwo[pare.nid];
                    if (self.type === NodeTypes.Leaf) {
                        path.lineEnd.push(self.x, self.y);
                    }
                    else {
                        path.lineEnd.push(pare.x + selfSeg[0], pare.y + selfSeg[1]);
                    }                    
                    path.curveEnd.push(pare.x - pareSeg[0], pare.y - pareSeg[1]);
                    path.curveCtl.push(pare.x, pare.y);

                    var unit = vector.unit(gran, pare);
                    if (isNaN(unit[0]) || isNaN(unit[1])) {
                        unit = [1, 0];
                    }
                    // var rota = (self === pare.childPlus) ? plusRotate : minusRotate;
                    path.offset = [
                        unit[1] * plusRotate[2], unit[0] * plusRotate[1], 0,
                        self === pare.PChild ? 1 : -1
                    ];
                }
                else {
                    path.lineEnd.key = this._spiral.root.key;
                    path.lineEnd.push(this._spiral.root.x, this._spiral.root.y);
                    path.curveEnd = path.curveCtl = [];
                }
            }
            return result;
        }

        public visit(v: Func<IPoint, void>): this {
            if (this._nodes.root) {
                v(this._nodes.root);
            }            
            for (var n of this._nodes.offspring()) {
                v(n);
            }
            return this;
        }
    }