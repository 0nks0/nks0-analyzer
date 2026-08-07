#!/usr/bin/env node
/**
 * Single-sources the app version.
 *
 * The version appears in three places that must agree:
 *   - APP_VERSION in js/app.js        (shown in the navbar and footer)
 *   - ?v= on the <script> tags        (cache-bust for js/app.js)
 *   - ?v= on the <link> stylesheets   (cache-bust for css/style.css)
 *
 * Keeping them in sync by hand has failed twice: results.html once shipped
 * pinned to v1.3.5 against a v1.4.0 app, and its stylesheet had no ?v= at all,
 * so returning visitors kept a stale cached copy indefinitely.
 *
 * Usage:
 *   node tools/bump-version.js            # verify all sites agree (exit 1 if not)
 *   node tools/bump-version.js 1.4.2      # rewrite every site to 1.4.2
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const APP_JS     = path.join(ROOT, 'js', 'app.js');
const HTML_FILES = ['index.html', 'results.html'].map(f => path.join(ROOT, f));

const VERSION_RE = /^\d+\.\d+\.\d+$/;

function readAppVersion(src) {
    const m = src.match(/const\s+APP_VERSION\s*=\s*'([^']+)'/);
    if (!m) throw new Error('APP_VERSION not found in js/app.js');
    return m[1];
}

/** Every `?v=` on a local css/js asset reference. */
function readAssetVersions(html) {
    const out = [];
    const re = /(?:href|src)="(?:css\/style\.css|js\/app\.js)(\?v=([^"]*))?"/g;
    let m;
    while ((m = re.exec(html)) !== null) out.push(m[2] === undefined ? null : m[2]);
    return out;
}

function rewrite(version) {
    if (!VERSION_RE.test(version)) {
        console.error(`error: "${version}" is not a semver-ish x.y.z version`);
        process.exit(1);
    }

    const appSrc = fs.readFileSync(APP_JS, 'utf8');
    fs.writeFileSync(
        APP_JS,
        appSrc.replace(/(const\s+APP_VERSION\s*=\s*')[^']+(')/, `$1${version}$2`),
        'utf8'
    );
    console.log(`js/app.js       APP_VERSION -> ${version}`);

    for (const file of HTML_FILES) {
        const html = fs.readFileSync(file, 'utf8');
        const next = html.replace(
            /((?:href|src)=")(css\/style\.css|js\/app\.js)(?:\?v=[^"]*)?(")/g,
            `$1$2?v=${version}$3`
        );
        fs.writeFileSync(file, next, 'utf8');
        console.log(`${path.basename(file).padEnd(15)} asset ?v= -> ${version}`);
    }
    console.log(`\nBumped to ${version}.`);
}

function verify() {
    const version = readAppVersion(fs.readFileSync(APP_JS, 'utf8'));
    let ok = true;

    for (const file of HTML_FILES) {
        const found = readAssetVersions(fs.readFileSync(file, 'utf8'));
        const name  = path.basename(file);
        if (!found.length) {
            console.error(`${name}: no local css/js asset references found`);
            ok = false;
            continue;
        }
        found.forEach(v => {
            if (v === null) {
                console.error(`${name}: an asset has no ?v= cache-bust at all`);
                ok = false;
            } else if (v !== version) {
                console.error(`${name}: asset ?v=${v} does not match APP_VERSION ${version}`);
                ok = false;
            }
        });
    }

    if (ok) console.log(`OK — every asset reference matches APP_VERSION ${version}.`);
    process.exit(ok ? 0 : 1);
}

const arg = process.argv[2];
if (arg) rewrite(arg); else verify();
