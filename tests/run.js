#!/usr/bin/env node
/**
 * Headless driver for tests/index.html.
 *
 * The suite itself is deliberately dependency-free so it can be opened in a
 * browser with no build step. This runner exists purely so CI can fail a push:
 * it loads the same page in jsdom, lets app.js and tests.js execute against it,
 * then reads the counters the suite exposes and sets the exit code.
 *
 * Usage:  node tests/run.js
 */

const path = require('path');

let JSDOM, ResourceLoader;
try {
    ({ JSDOM, ResourceLoader } = require('jsdom'));
} catch {
    console.error('jsdom is not installed. Run: npm ci   (or npm install)');
    console.error('The browser suite still works without it — open tests/index.html.');
    process.exit(1);
}

const fs = require('fs');
const REPO = path.join(__dirname, '..');
const PAGE = path.join(__dirname, 'index.html');

// The document needs a real http origin, because jsdom refuses localStorage on
// the opaque origin a file:// URL produces — and the triage and theme features
// under test are built on localStorage. But an http origin also makes the
// default loader try to fetch the page's relative scripts over the network.
// This loader closes that gap: it serves same-origin requests from the repo.
class RepoLoader extends ResourceLoader {
    fetch(url, options) {
        if (url.startsWith(ORIGIN)) {
            const rel = decodeURIComponent(url.slice(ORIGIN.length).split('?')[0]);
            const file = path.join(REPO, rel);
            // Refuse anything resolving outside the repo.
            if (!path.resolve(file).startsWith(path.resolve(REPO))) {
                return Promise.reject(new Error('refused path outside repo: ' + rel));
            }
            return fs.promises.readFile(file);
        }
        // Anything else (a CDN, the live API) is not this suite's business.
        return super.fetch(url, options);
    }
}

const ORIGIN = 'http://localhost/';

JSDOM.fromFile(PAGE, {
    runScripts: 'dangerously',   // the page's own scripts are the thing under test
    resources: new RepoLoader(),
    pretendToBeVisual: true,     // provides requestAnimationFrame
    url: ORIGIN + 'tests/index.html',
    beforeParse(window) {
        // jsdom implements no layout, so these DOM methods are absent. The app
        // legitimately calls them; stub them rather than weakening the app.
        window.Element.prototype.scrollIntoView = function () {};
        window.HTMLElement.prototype.focus = window.HTMLElement.prototype.focus || function () {};
    },
})
    .then((dom) => new Promise((resolve) => {
        // Scripts load asynchronously; wait for the suite to publish its results.
        const deadline = Date.now() + 20_000;
        const poll = () => {
            const results = dom.window.__NKS_TEST_RESULTS__;
            if (results) return resolve({ dom, results });
            if (Date.now() > deadline) return resolve({ dom, results: null });
            setTimeout(poll, 50);
        };
        poll();
    }))
    .then(({ dom, results }) => {
        if (!results) {
            console.error('Test suite did not finish — no __NKS_TEST_RESULTS__ was published.');
            console.error('Check tests/index.html loads ../js/app.js and tests.js correctly.');
            process.exit(1);
        }

        const doc = dom.window.document;
        const failures = [...doc.querySelectorAll('.case.bad')].map((el) => el.textContent);
        const reasons = [...doc.querySelectorAll('.why')].map((el) => el.textContent);

        failures.forEach((name, i) => {
            console.error(`FAIL  ${name}`);
            if (reasons[i]) console.error(`      ${reasons[i].split('\n')[0]}`);
        });

        const { passed, failed } = results;
        console.log(failed === 0 ? `\nAll ${passed} tests passed` : `\n${failed} failed, ${passed} passed`);

        // A suite that runs but asserts nothing is a broken suite, not a pass.
        if (passed === 0) {
            console.error('No tests ran — treating as failure.');
            process.exit(1);
        }
        process.exit(failed === 0 ? 0 : 1);
    })
    .catch((err) => {
        console.error('Runner crashed:', err && err.stack ? err.stack : err);
        process.exit(1);
    });
