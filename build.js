import * as esbuild from 'esbuild';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read installed Cesium version to build the CDN base URL for static assets.
// When the bundle is served as a blob URL (anywidget), Cesium's buildModuleUrl
// would resolve everything relative to blob:/// which is invalid.  Setting
// window.CESIUM_BASE_URL to a matching CDN URL before any Cesium code runs
// redirects Workers, Assets, Widgets, etc. to the correct location.
const cesiumPkg = JSON.parse(
  readFileSync(join(__dirname, 'node_modules/cesium/package.json'), 'utf8')
);
const cesiumVersion = cesiumPkg.version;
const cesiumBaseUrl = `https://unpkg.com/cesium@${cesiumVersion}/Build/Cesium/`;

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/cesiumjs_anywidget/js/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'src/cesiumjs_anywidget/index.js',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  treeShaking: true,
  legalComments: 'none',
  logLevel: 'info',
  banner: {
    // Set CESIUM_BASE_URL before any module code runs so that Cesium's
    // buildModuleUrl resolves Workers/Assets/Widgets against the CDN
    // instead of the blob: URL used to serve this anywidget bundle.
    js: `// Generated bundle - DO NOT EDIT DIRECTLY. Edit files in src/cesiumjs_anywidget/js/ instead.\nwindow.CESIUM_BASE_URL = '${cesiumBaseUrl}';\n`
  }
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
