import * as esbuild from 'esbuild';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';

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

// Workers – Cesium 1.120+ workers are ES modules that import shared chunk-*.js
// files. Classic blob Workers cannot use ES module `import`, and raw chunk URLs
// with the cesium-bundle:// scheme would trigger CORS errors.  Solution: bundle
// each named entry-point worker with esbuild (bundle:true, format:'iife') so
// the blob gets a fully self-contained script with no imports.
// chunk-*.js files are only used as build inputs; they are NOT added to textAssets.
const namedWorkerFiles = walk('Workers', r => {
  const name = r.split('/').pop();
  return r.endsWith('.js') && !name.startsWith('chunk-');
});
const chunkWorkerFiles = walk('Workers', r => r.split('/').pop().startsWith('chunk-'));
console.log(`   bundling ${Object.keys(namedWorkerFiles).length} workers (${Object.keys(chunkWorkerFiles).length} chunk deps inlined)...`);
const workerEntries = await Promise.all(
  Object.entries(namedWorkerFiles).map(async ([rel, full]) => {
    const result = await esbuild.build({
      entryPoints: [full],
      bundle:      true,
      format:      'iife',
      write:       false,
      minify:      true,
      logLevel:    'silent',
    });
    return [rel, result.outputFiles[0].text];
  })
);
for (const [rel, code] of workerEntries) {
  textAssets[rel] = code;
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

// Pre-built Cesium.js — already minified by CesiumGS, runs as an IIFE that
// sets window.Cesium. Placed in the banner AFTER the interceptor IIFE so that
// the patched Worker/fetch/XHR are already in place when Cesium initialises.
const cesiumJs = readFileSync(join(cesiumBuild, 'Cesium.js'), 'utf8');
console.log(`   Cesium.js: ${(cesiumJs.length/1024).toFixed(0)} KB`);

// The banner logic is written as readable JS with sentinel placeholders for
// the large data blobs, then minified via esbuild.transform (variable
// renaming, whitespace removal, dead-code elimination).  The sentinels are
// substituted AFTER minification so esbuild never has to parse the data.
const bannerSource = `
(function(){
try {
var textAssets = __TEXT_ASSETS__;
var binaryAssets = __BINARY_JSON__;
var BASE = "cesium-bundle:///";
window.CESIUM_BASE_URL = BASE;
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
// Cesium wraps worker URLs in an import "URL" blob for module workers.
// When the URL is cesium-bundle:///, that import fails with CORS.
// We intercept the Blob constructor: if Cesium creates a single-import shim blob
// pointing at cesium-bundle:///, swap in our inlined (bundled) worker content.
var OrigBlob = window.Blob;
var origCreateObjectURL = URL.createObjectURL.bind(URL);
window.Blob = function(parts, opts) {
  if (opts && opts.type === "application/javascript" && parts && parts.length === 1 && typeof parts[0] === "string") {
    var m = parts[0].match(/^\\s*import\\s+["']([^"']+)["']\\s*;?\\s*$/);
    if (m) {
      var key = resolve(m[1]);
      if (key !== null && textAssets[key] !== undefined) {
        parts = [textAssets[key]];
      }
    }
  }
  return new OrigBlob(parts, opts);
};
window.Blob.prototype = OrigBlob.prototype;
var OrigWorker = window.Worker;
window.Worker = function(url, opts) {
  var key = resolve(url);
  if (key !== null && textAssets[key] !== undefined) {
    url  = origCreateObjectURL(new OrigBlob([textAssets[key]], { type: "application/javascript" }));
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
// Fix a single element whose src/href attribute may contain a cesium-bundle:/// URL.
// Uses the pre-patch origSetAttr to avoid recursion.
function fixEl(el) {
  if (!el || !el.getAttribute) return;
  var s = el.getAttribute("src");
  if (s && s.startsWith(BASE)) { var rs = resolveAsset(s); if (rs) origSetAttr.call(el, "src", rs); }
  var h = el.getAttribute("href");
  if (h && h.startsWith(BASE)) { var rh = resolveAsset(h); if (rh) origSetAttr.call(el, "href", rh); }
}
// Scan a DOM subtree and fix all cesium-bundle:/// src/href attributes.
function fixSubtree(root) {
  if (!root || root.nodeType !== 1) return;
  fixEl(root);
  var sel = '[src^="' + BASE + '"],[href^="' + BASE + '"]';
  var all = root.querySelectorAll ? root.querySelectorAll(sel) : [];
  for (var i = 0; i < all.length; i++) fixEl(all[i]);
}
// Inject our patches into a same-origin iframe window so that elements created
// inside it (e.g. Cesium InfoBox link/img via iframeDoc.createElement) are intercepted.
function injectIntoFrame(win) {
  if (!win || win === window) return;
  try {
    var _oSetAttr = win.Element.prototype.setAttribute;
    // patch fetch
    var _oFetch = win.fetch;
    win.fetch = function(url, opts) {
      var raw = (url && url.url) ? url.url : url;
      var key = resolve(typeof raw === "string" ? raw : (raw instanceof URL ? raw.href : null));
      if (key) {
        if (textAssets[key] !== undefined) return Promise.resolve(new win.Response(textAssets[key], { status: 200, headers: { "Content-Type": mimeOf(key) } }));
        if (binaryAssets[key] !== undefined) return Promise.resolve(new win.Response(dataURLToBlob(binaryAssets[key]), { status: 200 }));
      }
      return (_oFetch || origFetch).apply(this, arguments);
    };
    // patch XHR
    var _oXHROpen = win.XMLHttpRequest.prototype.open;
    win.XMLHttpRequest.prototype.open = function(method, url) {
      var key = resolve(typeof url === "string" ? url : (url instanceof URL ? url.href : null));
      if (key && (textAssets[key] !== undefined || binaryAssets[key] !== undefined)) {
        var blob = textAssets[key] !== undefined ? new OrigBlob([textAssets[key]], { type: mimeOf(key) }) : dataURLToBlob(binaryAssets[key]);
        url = origCreateObjectURL(blob);
      }
      return _oXHROpen.apply(this, [method, url].concat(Array.prototype.slice.call(arguments, 2)));
    };
    // patch setAttribute
    win.Element.prototype.setAttribute = function(name, value) {
      var lower = name.toLowerCase();
      if ((lower === "src" || lower === "href") && typeof value === "string" && value.startsWith(BASE)) {
        var resolved = resolveAsset(value);
        if (resolved) { _oSetAttr.call(this, name, resolved); return; }
      }
      _oSetAttr.call(this, name, value);
    };
    // patch href/src property setters
    function _pp(Cls, prop) {
      var desc = Object.getOwnPropertyDescriptor(Cls.prototype, prop);
      if (!desc || !desc.set) return;
      var oSet = desc.set;
      Object.defineProperty(Cls.prototype, prop, Object.assign({}, desc, { set: function(v) { oSet.call(this, resolveAsset(v) || v); } }));
    }
    _pp(win.HTMLLinkElement, "href");
    _pp(win.HTMLImageElement, "src");
    // Fix any elements already present with bad URLs (e.g. set synchronously before our load listener)
    if (win.document && win.document.documentElement) {
      var badEls = win.document.querySelectorAll('[src^="' + BASE + '"],[href^="' + BASE + '"]');
      for (var i = 0; i < badEls.length; i++) {
        var el = badEls[i], sv = el.getAttribute("src"), hv = el.getAttribute("href");
        if (sv && sv.startsWith(BASE)) { var r = resolveAsset(sv); if (r) _oSetAttr.call(el, "src", r); }
        if (hv && hv.startsWith(BASE)) { var r = resolveAsset(hv); if (r) _oSetAttr.call(el, "href", r); }
      }
      // Also set up a MutationObserver inside the iframe for future mutations
      new win.MutationObserver(function(muts) {
        for (var mi = 0; mi < muts.length; mi++) {
          var addedN = muts[mi].addedNodes;
          for (var ni = 0; ni < addedN.length; ni++) {
            if (addedN[ni].nodeType !== 1) continue;
            var subEl = addedN[ni];
            var subAll = [subEl].concat(subEl.querySelectorAll ? Array.prototype.slice.call(subEl.querySelectorAll('[src^="' + BASE + '"],[href^="' + BASE + '"]')) : []);
            for (var si = 0; si < subAll.length; si++) {
              var e = subAll[si], sv2 = e.getAttribute("src"), hv2 = e.getAttribute("href");
              if (sv2 && sv2.startsWith(BASE)) { var r2 = resolveAsset(sv2); if (r2) _oSetAttr.call(e, "src", r2); }
              if (hv2 && hv2.startsWith(BASE)) { var r2 = resolveAsset(hv2); if (r2) _oSetAttr.call(e, "href", r2); }
            }
          }
        }
      }).observe(win.document.documentElement, { childList: true, subtree: true });
    }
  } catch(e) {}
}
// Main document MutationObserver: catches elements added via innerHTML (bypasses
// property setters) and handles iframes for cross-realm patching.
(function() {
  var target = document.documentElement || document.body || document;
  new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        // Fix inline-HTML elements (e.g. <img src="cesium-bundle:///..."> via innerHTML)
        fixSubtree(node);
        // Inject into same-origin iframes
        var iframes = [];
        if (node.tagName === "IFRAME") iframes.push(node);
        if (node.querySelectorAll) {
          var nested = node.querySelectorAll("iframe");
          for (var k = 0; k < nested.length; k++) iframes.push(nested[k]);
        }
        for (var k = 0; k < iframes.length; k++) {
          (function(fr) {
            if (fr.contentWindow) injectIntoFrame(fr.contentWindow);
            fr.addEventListener("load", function() {
              if (fr.contentWindow) injectIntoFrame(fr.contentWindow);
            });
          })(iframes[k]);
        }
      }
    }
  }).observe(target, { childList: true, subtree: true });
})();
// Inline url() references in CSS before creating CSS blobs.
// Handles both relative paths (with ../ normalization) and cesium-bundle:/// absolute URLs.
function normalizePath(p) {
  var parts = p.split("/"), out = [];
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === "..") { if (out.length) out.pop(); }
    else if (parts[i] !== ".") { out.push(parts[i]); }
  }
  return out.join("/");
}
function inlineCSSUrls(css, cssKey) {
  var base = cssKey.substring(0, cssKey.lastIndexOf("/") + 1);
  return css.replace(/url\\((['"]?)([^'")]+)\\1\\)/g, function(m, q, r) {
    if (r.startsWith("data:") || r.startsWith("http") || r.startsWith("//")) return m;
    var k = r.startsWith(BASE) ? r.slice(BASE.length) : normalizePath(base + r);
    if (binaryAssets[k] !== undefined) return "url(" + binaryAssets[k] + ")";
    if (textAssets[k] !== undefined) return "url(" + origCreateObjectURL(new OrigBlob([textAssets[k]], { type: mimeOf(k) })) + ")";
    return m;
  });
}
} catch(e) { console.error('[cesium-bundle] banner init failed:', e); }
})();
`;

// Minify the banner logic: renames variables, strips whitespace/comments
const bannerMinified = (await esbuild.transform(bannerSource, {
  minify:   true,
  target:   'es2020',
  charset:  'utf8',
})).code;
console.log(`   banner logic: ${(bannerSource.length/1024).toFixed(1)} KB -> ${(bannerMinified.length/1024).toFixed(1)} KB minified`);

// Substitute sentinels with actual data AFTER minification.
// IMPORTANT: use a function as the replacement arg so that special `$` sequences
// in the JSON data (e.g. $& $' $` $1 from minified worker code) are not
// interpreted as replacement patterns by String.prototype.replace.
const banner = '// Generated bundle - DO NOT EDIT DIRECTLY.\n'
  + bannerMinified
    .replace('__TEXT_ASSETS__', () => textRaw)
    .replace('__BINARY_JSON__', () => binaryJson)
  + '\n' + cesiumJs
  + '\nwindow.Cesium=Cesium;';

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

      // Write bundled Cesium widget CSS to index.css so that the Python widget
      // can load it via _css at import time (without requiring a browser environment).
      const cesiumCss = Object.entries(textAssets)
        .filter(([k]) => k.endsWith('.css'))
        .map(([, v]) => v)
        .join('\n');
      const indexCssPath = join(__dirname, 'src/cesiumjs_anywidget/index.css');
      writeFileSync(indexCssPath, cesiumCss, 'utf8');
      console.log(`   wrote index.css (${(cesiumCss.length / 1024).toFixed(0)} KB)`);

      console.log('✅ Build complete!');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
