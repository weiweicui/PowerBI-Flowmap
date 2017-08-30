var build = require('d3-builder');
var fs = require('fs');
// build('selection/index').pipe(fs.createWriteStream('./PowerBI/.lib/d3/selection.js'));
build('selection/index', 'scale/index').pipe(fs.createWriteStream('./PowerBI/.lib/d3/selection.scale.js'));
// build('behavior/drag').pipe(fs.createWriteStream('./PowerBI/.lib/d3/drag.js'));
// build('selection/index', 'format/index').pipe(fs.createWriteStream('./PowerBI/.lib/d3/selection.format.js'));
// build('selection/index', 'format/index', 'behavior/drag').pipe(fs.createWriteStream('./PowerBI/.lib/d3/selection.format.drag.js'));