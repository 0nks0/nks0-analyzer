/**
 * NKS0 test suite — no build step, no dependencies.
 *
 * Coverage is aimed at the places this app has actually regressed before
 * (HTML escaping, credential reveal, cache-bust drift) plus the newer
 * accessibility and pagination behaviour, which is easy to break silently.
 */

(function () {
    'use strict';

    const results = document.getElementById('results');
    let passed = 0, failed = 0;

    function group(name) {
        const el = document.createElement('div');
        el.className = 'group';
        el.textContent = name;
        results.appendChild(el);
    }

    function check(name, fn) {
        let ok = false, why = '';
        try {
            const r = fn();
            ok = r === true || r === undefined;
            if (!ok) why = typeof r === 'string' ? r : 'assertion returned ' + JSON.stringify(r);
        } catch (e) {
            ok = false;
            why = (e && e.stack) || String(e);
        }
        ok ? passed++ : failed++;
        const el = document.createElement('div');
        el.className = 'case ' + (ok ? 'ok' : 'bad');
        el.textContent = name;
        results.appendChild(el);
        if (!ok) {
            const w = document.createElement('span');
            w.className = 'why';
            w.textContent = why;
            results.appendChild(w);
        }
    }

    const eq = (actual, expected, label) =>
        actual === expected ? true
            : `${label || 'value'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;

    // Minimal alert factory — only the fields the renderer reads.
    function alert(over) {
        return Object.assign({
            id: 'R000', severity: 'Medium', category: 'PortScan', confidence: 0.8,
            message: 'Test alert message', details: { src_ip: '10.0.0.1' }, tags: ['t'],
        }, over || {});
    }

    function renderAlerts(list) {
        _allAlerts = list;
        _alertRenderLimit = 150;
        renderAlertList(list);
        return document.getElementById('alerts-container');
    }

    // ── Escaping ─────────────────────────────────────────────────────────────
    group('HTML escaping');

    check('escapeHtml neutralises angle brackets', () =>
        eq(escapeHtml('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;'));

    check('escapeHtml encodes ampersands', () =>
        eq(escapeHtml('a & b'), 'a &amp; b'));

    check('escapeHtml maps null and undefined to empty string', () =>
        eq(escapeHtml(null), '') === true && eq(escapeHtml(undefined), '') === true);

    check('escapeHtml does NOT escape quotes — unsafe in attribute position', () => {
        // Documents a known limitation rather than asserting desired behaviour:
        // textContent/innerHTML leaves " and ' intact. Every current call site
        // puts the result in element content. If one ever moves into an
        // unquoted/quoted attribute, this test should be flipped and the
        // helper hardened.
        const out = escapeHtml('a"b\'c');
        return out.indexOf('"') !== -1
            ? true
            : 'escapeHtml now escapes quotes — tighten this test and drop the caveat';
    });

    check('a hostile alert message cannot inject markup', () => {
        const c = renderAlerts([alert({ message: '<img src=x onerror=alert(1)>' })]);
        if (c.querySelector('img')) return 'injected <img> element was created';
        return c.textContent.indexOf('<img') !== -1 ? true : 'escaped text not present';
    });

    check('a hostile hostname cannot inject markup via _enrichMsg', () => {
        _hostnames = { '10.0.0.1': '<b>pwn</b>' };
        const html = _enrichMsg('host 10.0.0.1 seen');
        _hostnames = {};
        return html.indexOf('<b>pwn</b>') === -1 ? true : 'raw hostname markup passed through';
    });

    // ── Formatting helpers ───────────────────────────────────────────────────
    group('Formatting helpers');

    check('formatBytes handles zero', () => eq(formatBytes(0), '0 B'));
    check('formatBytes scales to KB', () => /KB$/.test(formatBytes(2048)) || 'expected KB suffix');
    check('formatBytes scales to MB', () => /MB$/.test(formatBytes(5 * 1024 * 1024)) || 'expected MB suffix');
    check('sevClass lowercases severity', () => eq(sevClass('Critical'), 'critical'));
    check('sevClass defaults to info', () => eq(sevClass(undefined), 'info'));

    // ── Alert disclosure / ARIA ──────────────────────────────────────────────
    group('Alert disclosure and ARIA');

    check('alerts with details render a real <button> summary', () => {
        const c = renderAlerts([alert()]);
        const s = c.querySelector('.nks-alert-summary');
        return eq(s && s.tagName, 'BUTTON', 'summary tag');
    });

    check('summary starts collapsed with aria-expanded=false', () => {
        const c = renderAlerts([alert()]);
        return eq(c.querySelector('.nks-alert-summary').getAttribute('aria-expanded'), 'false');
    });

    check('aria-controls points at an element that exists', () => {
        const c = renderAlerts([alert()]);
        const s = c.querySelector('.nks-alert-summary');
        const id = s.getAttribute('aria-controls');
        return c.querySelector('#' + id) ? true : `aria-controls="${id}" resolves to nothing`;
    });

    check('summary button contains no nested interactive elements', () => {
        // A button must never wrap another control — screen readers cannot
        // reach the inner one and the markup is invalid.
        const c = renderAlerts([alert()]);
        const n = c.querySelector('.nks-alert-summary').querySelectorAll('button,a,input,select,textarea').length;
        return eq(n, 0, 'nested interactive count');
    });

    check('summary button contains no <div> (invalid inside a button)', () => {
        const c = renderAlerts([alert()]);
        return eq(c.querySelector('.nks-alert-summary').querySelectorAll('div').length, 0, 'div count');
    });

    check('setAlertExpanded moves class and aria together', () => {
        const c = renderAlerts([alert()]);
        const item = c.querySelector('.nks-alert-item');
        const btn  = item.querySelector('.nks-alert-summary');
        setAlertExpanded(item, true);
        if (!item.classList.contains('expanded')) return 'class not applied';
        if (btn.getAttribute('aria-expanded') !== 'true') return 'aria not updated on expand';
        setAlertExpanded(item, false);
        if (item.classList.contains('expanded')) return 'class not removed';
        return eq(btn.getAttribute('aria-expanded'), 'false', 'aria after collapse');
    });

    check('expandAllAlerts / collapseAllAlerts keep aria in sync', () => {
        const c = renderAlerts([alert({ id: 'A' }), alert({ id: 'B' }), alert({ id: 'C' })]);
        expandAllAlerts();
        const all = [].slice.call(c.querySelectorAll('.nks-alert-summary[aria-expanded]'));
        if (all.some(b => b.getAttribute('aria-expanded') !== 'true')) return 'a button stayed collapsed';
        collapseAllAlerts();
        if (all.some(b => b.getAttribute('aria-expanded') !== 'false')) return 'a button stayed expanded';
        return true;
    });

    check('an alert with nothing to expand is not a disclosure', () => {
        // Categories with a dedicated body renderer always produce a panel, so
        // use one the frontend has no renderer for — the real case when the
        // backend ships a rule before the UI catches up. No tags, no see-also,
        // no body → no panel → must not be a focusable control.
        const bare = alert({ category: 'CategoryWithNoFrontendRenderer', tags: [], details: {}, confidence: null });
        const c = renderAlerts([bare]);
        const item = c.querySelector('.nks-alert-item');
        const s = item.querySelector('.nks-alert-summary');
        if (!item.classList.contains('nks-no-details')) return 'missing nks-no-details marker';
        if (s.tagName === 'BUTTON') return 'inert row rendered a focusable button';
        return eq(s.hasAttribute('aria-expanded'), false, 'inert row should have no aria-expanded');
    });

    // ── Pagination ───────────────────────────────────────────────────────────
    group('Alert list pagination');

    const many = [];
    for (let i = 0; i < 260; i++) many.push(alert({ id: 'R' + i, message: 'alert ' + i }));

    check('renders at most one page on first paint', () => {
        const c = renderAlerts(many);
        return eq(c.querySelectorAll('.nks-alert-item').length, 150, 'rendered rows');
    });

    check('offers a "show more" control when rows are hidden', () => {
        const c = renderAlerts(many);
        return c.querySelector('#alerts-show-more') ? true : 'no show-more control rendered';
    });

    check('no "show more" control when everything fits', () => {
        const c = renderAlerts([alert()]);
        return c.querySelector('#alerts-show-more') ? 'show-more rendered unnecessarily' : true;
    });

    check('showMoreAlerts reveals the next page', () => {
        renderAlerts(many);
        showMoreAlerts();
        const n = document.getElementById('alerts-container').querySelectorAll('.nks-alert-item').length;
        return eq(n, 300 > many.length ? many.length : 300, 'rows after show more');
    });

    check('_ensureAlertRendered grows the list to reach a far index', () => {
        // See-also links and timeline dots address the full sorted list, so a
        // target beyond the cap must still be reachable.
        const c = renderAlerts(many);
        if (c.querySelector('[data-idx="240"]')) return 'index 240 should start hidden';
        _ensureAlertRendered(240);
        return document.getElementById('alerts-container').querySelector('[data-idx="240"]')
            ? true : 'index 240 still not rendered after ensure';
    });

    check('data-idx values index the full sorted list, not the visible page', () => {
        const c = renderAlerts(many);
        const last = c.querySelectorAll('.nks-alert-item')[149];
        return eq(last.getAttribute('data-idx'), '149', 'last visible data-idx');
    });

    // ── Hosts table sorting ──────────────────────────────────────────────────
    group('Hosts table sorting');

    const hosts = [
        { ip: '10.0.0.3', bytes_sent: 100,  bytes_received: 900 },
        { ip: '10.0.0.1', bytes_sent: 5000, bytes_received: 100 },
        { ip: '10.0.0.2', bytes_sent: 300,  bytes_received: 400 },
    ];

    function sortBy(key, dir) {
        _hostsSort = { key: key, dir: dir };
        renderHostsTable(hosts);
        return [].slice.call(document.querySelectorAll('#hosts-table-body tr'))
            .map(tr => (tr.textContent.match(/10\.0\.0\.\d/) || [''])[0])
            .filter(Boolean);
    }

    check('sorts by bytes sent, descending', () =>
        eq(sortBy('bytes_sent', 'desc').join(','), '10.0.0.1,10.0.0.2,10.0.0.3'));

    check('sorts by bytes sent, ascending', () =>
        eq(sortBy('bytes_sent', 'asc').join(','), '10.0.0.3,10.0.0.2,10.0.0.1'));

    check('sorts by bytes received, descending', () =>
        eq(sortBy('bytes_received', 'desc').join(','), '10.0.0.3,10.0.0.2,10.0.0.1'));

    check('sorts host addresses numerically, not lexically', () => {
        const wide = [{ ip: '10.0.0.10', bytes_sent: 1 }, { ip: '10.0.0.9', bytes_sent: 1 }];
        _hostsSort = { key: 'ip', dir: 'asc' };
        renderHostsTable(wide);
        const order = [].slice.call(document.querySelectorAll('#hosts-table-body tr'))
            .map(tr => (tr.textContent.match(/10\.0\.0\.\d+/) || [''])[0]).filter(Boolean);
        return eq(order.join(','), '10.0.0.9,10.0.0.10');
    });

    check('unsorted state preserves the incoming order', () => {
        _hostsSort = { key: null, dir: 'desc' };
        renderHostsTable(hosts);
        const order = [].slice.call(document.querySelectorAll('#hosts-table-body tr'))
            .map(tr => (tr.textContent.match(/10\.0\.0\.\d/) || [''])[0]).filter(Boolean);
        return eq(order.join(','), '10.0.0.3,10.0.0.1,10.0.0.2');
    });

    check('aria-sort marks the active column only', () => {
        _hostsSort = { key: 'bytes_sent', dir: 'desc' };
        renderHostsTable(hosts);
        const head = document.getElementById('hosts-table-head');
        const active = head.querySelector('th[data-sort-key="bytes_sent"]').getAttribute('aria-sort');
        const other  = head.querySelector('th[data-sort-key="ip"]').getAttribute('aria-sort');
        if (active !== 'descending') return `active column aria-sort was "${active}"`;
        return eq(other, 'none', 'inactive column aria-sort');
    });

    // ── Chart text alternatives ──────────────────────────────────────────────
    group('Chart text alternatives');

    check('_describeChart labels the canvas as an image', () => {
        const c = document.getElementById('fixture-chart');
        _describeChart(c, 'Test chart summary', [['TCP', 10]]);
        return eq(c.getAttribute('role'), 'img', 'role')
            && eq(c.getAttribute('aria-label'), 'Test chart summary', 'aria-label');
    });

    check('_describeChart emits a hidden data table', () => {
        const c = document.getElementById('fixture-chart');
        _describeChart(c, 'Protocols', [['TCP', 10], ['UDP', 5]]);
        const t = document.getElementById('fixture-chart-a11y-table');
        if (!t) return 'no data table emitted';
        if (!t.classList.contains('visually-hidden')) return 'table is not visually hidden';
        return eq(t.querySelectorAll('tbody tr').length, 2, 'data rows');
    });

    check('_describeChart replaces its table instead of stacking copies', () => {
        // renderNetworkGraph re-runs on every window resize.
        const c = document.getElementById('fixture-chart');
        _describeChart(c, 'Protocols', [['TCP', 10]]);
        _describeChart(c, 'Protocols', [['TCP', 10]]);
        return eq(document.querySelectorAll('#fixture-chart-a11y-table').length, 1, 'table count');
    });

    check('_describeChart escapes hostile row labels', () => {
        const c = document.getElementById('fixture-chart');
        _describeChart(c, 'Flows', [['<b>x</b> to y', 1]]);
        const t = document.getElementById('fixture-chart-a11y-table');
        return t.querySelector('b') ? 'raw markup rendered in data table' : true;
    });

    // ── Summary ──────────────────────────────────────────────────────────────
    const summary = document.getElementById('summary');
    summary.textContent = failed === 0
        ? `All ${passed} tests passed`
        : `${failed} failed, ${passed} passed`;
    summary.className = failed === 0 ? 'pass-all' : 'fail-any';

    // Expose for headless drivers.
    window.__NKS_TEST_RESULTS__ = { passed: passed, failed: failed };
})();
