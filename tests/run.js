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

let JSDOM;
try {
    ({ JSDOM } = require('jsdom'));
} catch {
    console.error('jsdom is not installed. Run: npm ci   (or npm install)');
    console.error('The browser suite still works without it — open tests/index.html.');
    process.exit(1);
}

const PAGE = path.join(__dirname, 'index.html');

// No `url` override: fromFile gives the document a file:// URL, so the page's
// relative <script src> paths resolve against the repo on disk. Setting an
// http:// url makes jsdom try to fetch them over the network instead.
JSDOM.fromFile(PAGE, {
    runScripts: 'dangerously',   // the page's own scripts are the thing under test
    resources: 'usable',         // so ../js/app.js and tests.js actually load
    pretendToBeVisual: true,     // provides requestAnimationFrame
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
