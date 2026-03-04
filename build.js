import * as esbuild from 'esbuild';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, readdirSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Collect Cesium static assets at build time ────────────────────────────
const cesiumBuild = join(__dirname, 'node_modules/cesium/Build/Cesium');
const cesiumPkg = JSON.parse(
  readFileSync(join(__dirname, 'node_modules/cesium/package.json'), 'utf8')
);
console.log(`📦 Cesium ${cesiumPkg.version} – inlining static assets...`);

/**
 * Walk a directory and collect files passing the filter.
 * Returns an object: { "relative/path": absolutePath }
 */
function walk(startDir, filter) {
  const out = {};
  function recurse(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = relative(cesiumBuild, full).replace(/\\/g, '/');
      if (statSync(full).isDirectory()) {
        recurse(full);
      } else if (filter(rel)) {
        out[rel] = full;
      }
    }
  }
  const abs = join(cesiumBuild, startDir);
  try { recurse(abs); } catch (_) { /* skip missing dirs */ }
  return out;
}

// Text assets: Workers (JS), JSON data, CSS
const textAssets = {};

// Workers – pre-bundled scripts, store as text so we can create blob Workers
for (const [rel, full] of Object.entries(walk('Workers', r => r.endsWith('.js')))) {
  textAssets[rel] = readFileSync(full, 'utf8');
}
// JSON data – approximateTerrainHeights, IAU2006_XYS, etc.
for (const [rel, full] of Object.entries(walk('Assets', r => r.endsWith('.json')))) {
  textAssets[rel] = readFileSync(full, 'utf8');
}
// Widget CSS & InfoBox CSS
for (const [rel, full] of Object.entries(walk('Widgets', r => r.endsWith('.css')))) {
  textAssets[rel] = readFileSync(full, 'utf8');
}

// Binary assets stored as base64 data URIs
// (Widgets images, SkyBox, LensFlare, moon, maki icons)
const BINARY_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml',
};
const binaryAssets = {};

for (const dir of ['Widgets', 'Assets/Textures']) {
  for (const [rel, full] of Object.entries(walk(dir, r => {
    const ext = r.split('.').pop().toLowerCase();
    return !!BINARY_MIME[ext];
  }))) {
    const ext = rel.split('.').pop().toLowerCase();
    const mime = BINARY_MIME[ext];
    const b64 = readFileSync(full).toString('base64');
    binaryAssets[rel] = `data:${mime};base64,${b64}`;
  }
}

const nWorkers = Object.keys(textAssets).filter(k => k.startsWith('Workers/')).length;
const nJson    = Object.keys(textAssets).filter(k => k.endsWith('.json')).length;
const nCss     = Object.keys(textAssets).filter(k => k.endsWith('.css')).length;
const nBinary  = Object.keys(binaryAssets).length;
console.log(`   workers: ${nWorkers}, JSON: ${nJson}, CSS: ${nCss}, binary: ${nBinary}`);

const textRaw    = JSON.stringify(textAssets);
const binaryJson = JSON.stringify(binaryAssets);
console.log(`   text assets: ${(textRaw.length/1024).toFixed(0)} KB (raw JSON, uncompressed)`);

// The banner logic is written as readable JS with sentinel placeholders for
// the large data blobs, then minified via esbuild.transform (variable
// renaming, whitespace removal, dead-code elimination).  The sentinels are
// substituted AFTER minification so esbuild never has to parse the data.
const bannerSource = `
(function(){
var textAssets = __TEXT_ASSETS__;
var binaryAssets = __BINARY_JSON__;
var BASE = "cesium-bundle:///";
window.CESIUM_BASE_URL = BASE;
window.__workerCSPPatched = true;
function resolve(url) {
  if (url instanceof URL) url = url.href;
  else if (typeof url !== "string") url = String(url);
  return url.startsWith(BASE) ? url.slice(BASE.length) : null;
}
function mimeOf(path) {
  var ext = path.split(".").pop().toLowerCase();
  return { js:"application/javascript", json:"application/json", css:"text/css",
           png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg",
           gif:"image/gif", svg:"image/svg+xml" }[ext] || "application/octet-stream";
}
function dataURLToBlob(dataUrl) {
  var parts = dataUrl.split(",");
  var mime  = (parts[0].match(/:(.*?);/) || [])[1] || "application/octet-stream";
  var bin   = atob(parts[1]);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
var OrigWorker = window.Worker;
window.Worker = function(url, opts) {
  var key = resolve(url);
  if (key !== null && textAssets[key] !== undefined) {
    url  = URL.createObjectURL(new Blob([textAssets[key]], { type: "application/javascript" }));
    opts = Object.assign({}, opts);
    delete opts.type;
  }
  return new OrigWorker(url, opts);
};
window.Worker.prototype = OrigWorker.prototype;
var origFetch = window.fetch;
window.fetch = function(url, opts) {
  var raw = (url && url.url) ? url.url : url;
  var key = raw ? resolve(raw) : null;
  if (key) {
    if (textAssets[key]   !== undefined) return Promise.resolve(new Response(textAssets[key],   { status: 200, headers: { "Content-Type": mimeOf(key) } }));
    if (binaryAssets[key] !== undefined) return Promise.resolve(new Response(dataURLToBlob(binaryAssets[key]), { status: 200 }));
  }
  return origFetch.apply(this, arguments);
};
var origXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url) {
  var key = resolve(typeof url === "string" ? url : (url instanceof URL ? url.href : null));
  if (key && (textAssets[key] !== undefined || binaryAssets[key] !== undefined)) {
    var blob = textAssets[key] !== undefined
      ? new Blob([textAssets[key]], { type: mimeOf(key) })
      : dataURLToBlob(binaryAssets[key]);
    url = URL.createObjectURL(blob);
  }
  return origXHROpen.apply(this, [method, url].concat(Array.prototype.slice.call(arguments, 2)));
};
function resolveAsset(v) {
  var key = resolve(v);
  if (key === null) return null;
  if (textAssets[key] !== undefined) {
    var mime = mimeOf(key);
    var content = (mime === "text/css") ? inlineCSSUrls(textAssets[key], key) : textAssets[key];
    return URL.createObjectURL(new Blob([content], { type: mime }));
  }
  if (binaryAssets[key] !== undefined) return binaryAssets[key];
  return null;
}
// Patch property setters (direct assignment: el.src = url / el.href = url)
function patchProp(Cls, prop) {
  var desc = Object.getOwnPropertyDescriptor(Cls.prototype, prop);
  if (!desc || !desc.set) return;
  var origSet = desc.set;
  Object.defineProperty(Cls.prototype, prop, Object.assign({}, desc, { set: function(v) {
    origSet.call(this, resolveAsset(v) || v);
  }}));
}
patchProp(HTMLLinkElement, "href");
patchProp(HTMLImageElement, "src");
// Patch setAttribute (Knockout/framework bindings use this instead of direct assignment)
var origSetAttr = Element.prototype.setAttribute;
Element.prototype.setAttribute = function(name, value) {
  var lower = name.toLowerCase();
  if ((lower === "src" && this instanceof HTMLImageElement) ||
      (lower === "href" && this instanceof HTMLLinkElement)) {
    var resolved = resolveAsset(value);
    if (resolved) { origSetAttr.call(this, name, resolved); return; }
  }
  origSetAttr.call(this, name, value);
};
// Inline url() references in CSS before creating CSS blobs, so relative image
// paths inside Cesium's widget CSS resolve correctly (avoids blob: base URL issue)
function inlineCSSUrls(css, cssKey) {
  var base = cssKey.substring(0, cssKey.lastIndexOf("/") + 1);
  return css.replace(/url\\((['"]?)([^'")]+)\\1\\)/g, function(m, q, r) {
    if (r.startsWith("data:") || r.startsWith("http") || r.startsWith("//")) return m;
    var k = base + r;
    if (binaryAssets[k]) return "url(" + binaryAssets[k] + ")";
    return m;
  });
}
})();
`;

// Minify the banner logic: renames variables, strips whitespace/comments
const bannerMinified = (await esbuild.transform(bannerSource, {
  minify:   true,
  target:   'es2020',
  charset:  'utf8',
})).code;
console.log(`   banner logic: ${(bannerSource.length/1024).toFixed(1)} KB -> ${(bannerMinified.length/1024).toFixed(1)} KB minified`);

// Substitute sentinels with actual data AFTER minification
const banner = '// Generated bundle - DO NOT EDIT DIRECTLY.\n'
  + bannerMinified
    .replace('__TEXT_ASSETS__', textRaw)
    .replace('__BINARY_JSON__', binaryJson);

// ─── esbuild ────────────────────────────────────────────────────────────────

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints:   ['src/cesiumjs_anywidget/js/index.js'],
  bundle:        true,
  format:        'esm',
  outfile:       'src/cesiumjs_anywidget/index.js',
  platform:      'browser',
  target:        'es2020',
  minify:        true,
  treeShaking:   true,
  legalComments: 'none',
  charset:       'utf8',              // avoid \\uXXXX escaping – smaller output
  drop:          ['console', 'debugger'], // strip all console.* and debugger
  logLevel:      'info',
  banner:        { js: banner },
};

async function build() {
  try {
    if (isWatch) {
      console.log('👀 Watching for changes...');
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
    } else {
      console.log('🔨 Building...');
      await esbuild.build(buildOptions);
      console.log('✅ Build complete!');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
