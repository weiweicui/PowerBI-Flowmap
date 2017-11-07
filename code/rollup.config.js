import node from 'rollup-plugin-node-resolve';
import path from 'path';
import fs from 'fs';
var sleep = require('thread-sleep');

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//settings
var modulename = 'app';
var pbiFolder = './visual';
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

var destFile = path.resolve(pbiFolder, modulename + '.js');
if (!fs.existsSync(destFile)) {
  fs.writeFileSync(destFile, '');
}

var tscJson    = require('./tsconfig.json');
var tscOptions = tscJson.compilerOptions;
var outDir     = tscOptions.outDir;
var basePaths  = tscOptions.paths;

function findOutPath(p) {
  var fname = path.resolve(__dirname, p.replace('.ts', '.js'));
  var rname = path.dirname(fname);
  while (rname !== path.dirname(rname)) {
    var ret = path.resolve(outDir, path.relative(rname, fname));
    if (fs.existsSync(ret)) {
      return ret;
    }
    rname = path.dirname(rname);
  }
  return undefined;
}

var roots = [];
for (var k in basePaths) {
  for (var p of basePaths[k]) {
    roots.push(findOutPath(p.substr(0, p.length - 1)));//remove the last *
  }
}

var tsEntries = tscJson.files.filter(n => n.indexOf('.d.ts') < 0);
var jsEntries = tsEntries.map(function (f) {
  return findOutPath(f.replace('.ts', '.js'));
}).filter(n => n);
///////////////////////////////////////////////////////////////////////////////
// sometimes, .bundle does not exist, so we need to wait and rollup again
if (jsEntries.length !== tsEntries.length) {
  var retryCnt = 0;
  for (var i = 1; i < 10; i++) {
    sleep(1000);
    roots = [];
    for (var k in basePaths) {
      for (var p of basePaths[k]) {
        roots.push(findOutPath(p.substr(0, p.length - 1)));//remove the last *
      }
    }
    if (roots.some(r => r === undefined)) {
      continue;
    }
    jsEntries = tsEntries.map(function (f) {
      return findOutPath(f.replace('.ts', '.js'));
    }).filter(n => n);    
    if (jsEntries.length !== tsEntries.length) {
      continue;
    }
    break;
  }
  if (i === 11) {
    console.log('failed to bundle after ' + retryCnt + ' attemps.');
  }
  else {
    console.log('rebundled after ' + retryCnt + ' attemps.');
  }
}

///////////////////////////////////////////////////////////////////////////////
//just check this part. At least, it should contain the './app.js'
if (require(path.resolve(pbiFolder, 'pbiviz.json')).externalJS.length === 0) {
  console.error(`externalJS is *EMPTY*, should at least has ./${modulename}.js`);
}

///////////////////////////////////////////////////////////////////////////////
//convert the shortcut .[att|sty].xxx(..) to valid .[attr|style]('xxx', ...).
//add 'var app = this.app;' to the end to fix the scope problem caused by rollup.
var append = {
  name: 'append',
  transformBundle: function (code) {
    var result = '';
    code = code.replace(/\.(att|sty)\.([\w_]+)\(/g, function (a, b, c) {
      return (b === 'att' ? '.attr(' : '.style(') + "'" + c.replace('_', '-') + "',";
    }).replace('use strict', '');
    result += code + '\nvar ' + modulename + ' = this.' + modulename + ';\n';
    return result;
  },
  resolveId: function (portee, porter) {
    if (!portee) {
      return undefined;
    }
    for (var i = 0; i < roots.length; i++) {
      if (roots[i] === undefined) {
        continue;
      }
      var file = path.resolve(roots[i], portee + '.js');
      if (fs.existsSync(file)) {
        return file;
      }
      var file = path.resolve(roots[i], portee, 'index.js');
      if (fs.existsSync(file)) {
        return file;
      }
    }
    return undefined;
  }
}

///////////////////////////////////////////////////////////////////////////////
//relay every call to the Visual class in the module
var pbiVisual = path.resolve(pbiFolder, 'src/visual.ts');
if (fs.readFileSync(pbiVisual).toString().indexOf('declare') < 0) {
  console.log('building proxy ./src/visual.ts');
  fs.writeFileSync(pbiVisual, `
declare var ${modulename};
module powerbi.extensibility.visual {
    export class Visual implements IVisual {
        private _self: any;
        constructor(options: VisualConstructorOptions) {
            this._self = new ${modulename}.Visual(options);
        }

        public update(options: VisualUpdateOptions) {
            this._self.update(options);
        }
        public enumerateObjectInstances(options: any): VisualObjectInstance[] {
            return this._self.enumerateObjectInstances(options);
        }
    }
}`);
}

if (jsEntries.length !== 1) {
  console.log('----------------------------------------------');
  console.log('rolup error: need to have exact one entry file');
  console.log('----------------------------------------------');
}

export default {
  entry: jsEntries[0],
  format: "iife",
  moduleName: modulename,
  plugins: [node(), append],
  context: 'window',
  dest: destFile
};