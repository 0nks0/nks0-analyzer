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

    // Delegates to the real renderAlerts so tests exercise the production path
    // (which initialises the severity/category/tactic filter sets). Named
    // differently on purpose: a local `renderAlerts` would shadow the app's.
    function renderList(list) {
        renderAlerts(list);
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

    check('escapeHtml escapes double quotes', () =>
        eq(escapeHtml('say "hi"'), 'say &quot;hi&quot;'));

    check('escapeHtml escapes single quotes', () =>
        eq(escapeHtml("it's"), 'it&#39;s'));

    check('escapeHtml escapes & before the entities it generates', () =>
        eq(escapeHtml('&lt;'), '&amp;lt;'));

    check('a value cannot break out of an attribute it is placed in', () => {
        // escapeHtml is used in attribute position in several render paths.
        // A value carrying a double quote must not be able to close the
        // attribute and start a new one.
        const hostile = '" onmouseover="alert(1)';
        const html = `<span title="${escapeHtml(hostile)}">x</span>`;
        const probe = document.createElement('div');
        probe.innerHTML = html;
        const el = probe.firstElementChild;
        if (el.hasAttribute('onmouseover')) return 'value escaped its attribute and injected a handler';
        return eq(el.getAttribute('title'), hostile, 'round-tripped title');
    });

    check('a hostile alert message cannot inject markup', () => {
        const c = renderList([alert({ message: '<img src=x onerror=alert(1)>' })]);
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
        const c = renderList([alert()]);
        const s = c.querySelector('.nks-alert-summary');
        return eq(s && s.tagName, 'BUTTON', 'summary tag');
    });

    check('summary starts collapsed with aria-expanded=false', () => {
        const c = renderList([alert()]);
        return eq(c.querySelector('.nks-alert-summary').getAttribute('aria-expanded'), 'false');
    });

    check('aria-controls points at an element that exists', () => {
        const c = renderList([alert()]);
        const s = c.querySelector('.nks-alert-summary');
        const id = s.getAttribute('aria-controls');
        return c.querySelector('#' + id) ? true : `aria-controls="${id}" resolves to nothing`;
    });

    check('summary button contains no nested interactive elements', () => {
        // A button must never wrap another control — screen readers cannot
        // reach the inner one and the markup is invalid.
        const c = renderList([alert()]);
        const n = c.querySelector('.nks-alert-summary').querySelectorAll('button,a,input,select,textarea').length;
        return eq(n, 0, 'nested interactive count');
    });

    check('summary button contains no <div> (invalid inside a button)', () => {
        const c = renderList([alert()]);
        return eq(c.querySelector('.nks-alert-summary').querySelectorAll('div').length, 0, 'div count');
    });

    check('setAlertExpanded moves class and aria together', () => {
        const c = renderList([alert()]);
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
        const c = renderList([alert({ id: 'A' }), alert({ id: 'B' }), alert({ id: 'C' })]);
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
        const c = renderList([bare]);
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
        const c = renderList(many);
        return eq(c.querySelectorAll('.nks-alert-item').length, 150, 'rendered rows');
    });

    check('offers a "show more" control when rows are hidden', () => {
        const c = renderList(many);
        return c.querySelector('#alerts-show-more') ? true : 'no show-more control rendered';
    });

    check('no "show more" control when everything fits', () => {
        const c = renderList([alert()]);
        return c.querySelector('#alerts-show-more') ? 'show-more rendered unnecessarily' : true;
    });

    check('showMoreAlerts reveals the next page', () => {
        renderList(many);
        showMoreAlerts();
        const n = document.getElementById('alerts-container').querySelectorAll('.nks-alert-item').length;
        return eq(n, 300 > many.length ? many.length : 300, 'rows after show more');
    });

    check('_ensureAlertRendered grows the list to reach a far index', () => {
        // See-also links and timeline dots address the full sorted list, so a
        // target beyond the cap must still be reachable.
        const c = renderList(many);
        if (c.querySelector('[data-idx="240"]')) return 'index 240 should start hidden';
        _ensureAlertRendered(240);
        return document.getElementById('alerts-container').querySelector('[data-idx="240"]')
            ? true : 'index 240 still not rendered after ensure';
    });

    check('data-idx values index the full sorted list, not the visible page', () => {
        const c = renderList(many);
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

    // ── MITRE tactic filtering ───────────────────────────────────────────────
    group('ATT&CK tactic filter');

    const tacticAlerts = [
        alert({ id: 'T1', category: 'PortScan', mitre: { tactic: 'Discovery', techniques: [{ id: 'T1046' }] } }),
        alert({ id: 'T2', category: 'Beaconing', mitre: { tactic: 'Command and Control', techniques: [{ id: 'T1071' }] } }),
        alert({ id: 'T3', category: 'SmbLateral', mitre: { tactic: 'Lateral Movement', techniques: [{ id: 'T1021' }] } }),
        alert({ id: 'T4', category: 'Generic' }),   // no mitre block
    ];

    check('alertTactic reads the tactic, defaulting to Unmapped', () =>
        eq(alertTactic(tacticAlerts[0]), 'Discovery') && eq(alertTactic(tacticAlerts[3]), 'Unmapped'));

    check('filtering to one tactic hides the others', () => {
        renderList(tacticAlerts);
        _checkedTactics = new Set(['Lateral Movement']);
        applyFilters();
        const rows = document.querySelectorAll('#alerts-container .nks-alert-item');
        if (rows.length !== 1) return `expected 1 row, got ${rows.length}`;
        return rows[0].textContent.indexOf('SmbLateral') !== -1 ? true : 'wrong alert survived the filter';
    });

    check('a tactic filter cuts across categories', () => {
        // Two different categories sharing a tactic must both survive.
        const shared = [
            alert({ id: 'S1', category: 'PortScan',  mitre: { tactic: 'Discovery' } }),
            alert({ id: 'S2', category: 'PingSweep', mitre: { tactic: 'Discovery' } }),
            alert({ id: 'S3', category: 'Beaconing', mitre: { tactic: 'Command and Control' } }),
        ];
        renderList(shared);
        _checkedTactics = new Set(['Discovery']);
        applyFilters();
        return eq(document.querySelectorAll('#alerts-container .nks-alert-item').length, 2, 'rows');
    });

    check('renderAlerts re-checks every tactic present', () => {
        renderList(tacticAlerts);
        return _checkedTactics.has('Discovery') && _checkedTactics.has('Unmapped')
            ? true : 'tactics were not all re-enabled on a fresh render';
    });

    // ── Triage ───────────────────────────────────────────────────────────────
    group('Local triage state');

    function freshTriage() {
        try { localStorage.removeItem('nks0_triage'); } catch (_) {}
        _currentAnalysisId = 'test-analysis';
        _triage = {};
        _showReviewed = true;
        _showFp = true;
    }

    check('marking an alert reviewed records it', () => {
        freshTriage();
        renderList([alert({ id: 'A1' })]);
        setAlertMark('A1', 'reviewed');
        return eq(alertMark('A1'), 'reviewed');
    });

    check('marks survive a reload for the same analysis', () => {
        freshTriage();
        renderList([alert({ id: 'A1' })]);
        setAlertMark('A1', 'fp');
        _triage = {};                       // simulate a page reload
        loadTriage('test-analysis');
        return eq(alertMark('A1'), 'fp');
    });

    check('marks are scoped to one analysis', () => {
        freshTriage();
        renderList([alert({ id: 'A1' })]);
        setAlertMark('A1', 'reviewed');
        loadTriage('a-different-analysis');
        return alertMark('A1') === null ? true : 'a mark leaked between analyses';
    });

    check('hiding false positives removes them from the list', () => {
        freshTriage();
        renderList([alert({ id: 'A1' }), alert({ id: 'A2' })]);
        setAlertMark('A1', 'fp');
        _showFp = false;
        applyFilters();
        return eq(document.querySelectorAll('#alerts-container .nks-alert-item').length, 1, 'visible rows');
    });

    check('marked alerts are still shown while the toggle is on', () => {
        freshTriage();
        renderList([alert({ id: 'A1' }), alert({ id: 'A2' })]);
        setAlertMark('A1', 'reviewed');
        applyFilters();
        return eq(document.querySelectorAll('#alerts-container .nks-alert-item').length, 2, 'visible rows');
    });

    check('triageCounts reports each mark type', () => {
        freshTriage();
        renderList([alert({ id: 'A1' }), alert({ id: 'A2' }), alert({ id: 'A3' })]);
        setAlertMark('A1', 'reviewed');
        setAlertMark('A2', 'fp');
        const c = triageCounts();
        return eq(c.reviewed, 1, 'reviewed') && eq(c.fp, 1, 'fp');
    });

    check('clearing removes every mark', () => {
        freshTriage();
        renderList([alert({ id: 'A1' }), alert({ id: 'A2' })]);
        setAlertMark('A1', 'reviewed');
        setAlertMark('A2', 'fp');
        clearTriage();
        const c = triageCounts();
        return eq(c.reviewed + c.fp, 0, 'remaining marks');
    });

    check('mark buttons render outside the summary button', () => {
        // Same invariant as the disclosure work: no interactive nesting.
        freshTriage();
        renderList([alert({ id: 'A1' })]);
        const item = document.querySelector('.nks-alert-item');
        const inSummary = item.querySelector('.nks-alert-summary').querySelectorAll('.nks-mark-btn').length;
        const inRow = item.querySelectorAll('.nks-mark-btn').length;
        if (inSummary !== 0) return 'mark buttons nested inside the summary button';
        return eq(inRow, 2, 'mark buttons present in the row');
    });

    // ── Per-alert triage keys ────────────────────────────────────────────────
    // Two findings can share a rule id. The mark has to follow the flow, not
    // the rule, and survive a re-analysis that only changes string formatting.
    group('Per-alert triage keys');

    // Two R002 flows from a real beacon-demo capture: same rule, different
    // destination and first timestamp. Source port is absent, as in the API.
    const flowA = {
        id: 'R002', severity: 'High', category: 'BruteForce',
        message: 'Possible brute-force behavior: 10.0.0.23 made 40 short TCP connections to 198.51.100.77:443.',
        details: { src_ip: '10.0.0.23', dst_ip: '198.51.100.77', dst_port: 443, protocol: 'TCP', attempts: 40 },
        evidence: { flow_key: { src_ip: '10.0.0.23', dst_ip: '198.51.100.77', dst_port: 443, protocol: 'TCP' } },
        first_seen: 1767225612.0,
    };
    const flowB = {
        id: 'R002', severity: 'High', category: 'BruteForce',
        message: 'Possible brute-force behavior: 10.0.0.23 made 14 short TCP connections to 192.0.2.40:443.',
        details: { src_ip: '10.0.0.23', dst_ip: '192.0.2.40', dst_port: 443, protocol: 'TCP', attempts: 14 },
        first_seen: 1767225734.943087,
    };

    function reviewedKeys() {
        return [].map.call(
            document.querySelectorAll('.nks-mark-btn[data-mark="reviewed"]'),
            b => b.getAttribute('data-triage-key')
        );
    }

    check('two alerts from the same rule are marked independently', () => {
        freshTriage();
        renderList([flowA, flowB]);
        const keys = reviewedKeys();
        if (keys.length !== 2) return 'expected two reviewed buttons, got ' + keys.length;
        if (keys[0] === keys[1]) return 'both alerts received the same triage key';
        setAlertMark(keys[0], 'reviewed');
        setAlertMark(keys[1], 'fp');
        applyFilters();
        const items = document.querySelectorAll('#alerts-container .nks-alert-item');
        if (items.length !== 2) return 'a mark hid an alert while both toggles are on';
        const aRev = items[0].querySelector('.nks-mark-btn[data-mark="reviewed"]').getAttribute('aria-pressed');
        const bRev = items[1].querySelector('.nks-mark-btn[data-mark="reviewed"]').getAttribute('aria-pressed');
        const aFp  = items[0].querySelector('.nks-mark-btn[data-mark="fp"]').getAttribute('aria-pressed');
        const bFp  = items[1].querySelector('.nks-mark-btn[data-mark="fp"]').getAttribute('aria-pressed');
        if (aRev !== 'true' || bRev !== 'false') return 'reviewed state leaked across the rule';
        if (aFp !== 'false' || bFp !== 'true') return 'false-positive state leaked across the rule';
        return true;
    });

    check('the key is stable across a reload and a re-analysis', () => {
        freshTriage();
        // Same flow, written the way a second run might: lowercased protocol,
        // port as a string, timestamp as "1767225612.0", tuple only on flow_key.
        const again = {
            id: 'R002',
            message: 'message text can change without being a different flow',
            details: { src_ip: '10.0.0.23', dst_ip: '198.51.100.77', dst_port: '443', protocol: 'tcp' },
            evidence: { flow_key: { src_ip: '10.0.0.23', dst_ip: '198.51.100.77', dst_port: 443, protocol: 'TCP' } },
            first_seen: '1767225612.0',
        };
        const k1 = alertTriageKey(flowA);
        const k2 = alertTriageKey(again);
        if (k1 !== k2) return 're-analysis produced a different key: ' + k1 + ' vs ' + k2;
        if (alertTriageKey(flowA) === alertTriageKey(flowB)) return 'two different flows share a key';
        setAlertMark(k1, 'fp');
        _triage = {};
        loadTriage('test-analysis');
        return eq(alertMark(k2), 'fp');
    });

    check('source port is part of the key when the capture has one', () => {
        const left = alert({
            id: 'R010',
            details: { src_ip: '10.0.0.8', src_port: 4242, dst_ip: '10.0.0.9', dst_port: 445, protocol: 'TCP' },
            first_seen: 10,
        });
        const right = alert({
            id: 'R010',
            details: { src_ip: '10.0.0.8', src_port: 4243, dst_ip: '10.0.0.9', dst_port: 445, protocol: 'TCP' },
            first_seen: 10,
        });
        return alertTriageKey(left) !== alertTriageKey(right)
            ? true : 'source port was ignored';
    });

    check('an old rule-scoped mark is copied onto each alert once, then dropped', () => {
        freshTriage();
        _triage = { R002: 'fp', R999: 'reviewed' };
        saveTriage('test-analysis');
        _triage = {};
        loadTriage('test-analysis');
        if (alertMark('R002') !== 'fp') return 'legacy mark was not loaded';
        renderList([flowA, flowB]);
        if (alertMark('R002')) return 'legacy rule key was kept after migration';
        if (alertMark('R999') !== 'reviewed') return 'a mark for a rule not in this result was deleted';
        const ka = alertTriageKey(flowA);
        const kb = alertTriageKey(flowB);
        if (alertMark(ka) !== 'fp' || alertMark(kb) !== 'fp') return 'the old mark did not apply to every alert of the rule';
        setAlertMark(ka, null);
        if (alertMark(kb) !== 'fp') return 'clearing one migrated mark cleared the other';
        renderList([flowA, flowB]);
        if (alertMark('R002')) return 'a second render restored the rule key';
        return eq(alertMark(kb), 'fp');
    });

    check('missing fields do not throw and still separate alerts', () => {
        freshTriage();
        const samples = [
            null, undefined, {},
            { id: 'R1', details: null, evidence: null, first_seen: NaN, message: null },
            { id: 'R1', details: { src_ip: null, dst_port: undefined }, evidence: { flow_key: null }, message: 'x' },
            { details: 'nope', evidence: 5, first_seen: { bad: true }, message: 'still here' },
        ];
        samples.forEach(alertTriageKey);
        const sparse = [
            { id: 'R1', message: 'alpha' },
            { id: 'R1', message: 'beta' },
            { message: 'no rule id at all' },
        ];
        renderList(sparse);
        const keys = reviewedKeys();
        if (keys.length !== 3) return 'expected a mark control per sparse alert, got ' + keys.length;
        if (!keys[0] || !keys[1] || !keys[2]) return 'a missing field produced an empty key';
        if (keys[0] === keys[1]) return 'same rule with different messages collapsed to one key';
        if (keys[0].indexOf('k|h|') !== 0) return 'expected the message hash fallback, got ' + keys[0];
        setAlertMark(keys[0], 'reviewed');
        if (alertMark(keys[1])) return 'hash-keyed marks are not independent';
        return true;
    });

    // ── Deep links ───────────────────────────────────────────────────────────
    group('Alert deep links');

    check('a hash naming an alert expands it', () => {
        renderList([alert({ id: 'D1' }), alert({ id: 'D2' })]);
        window.location.hash = '#alert-1';
        const ok = applyAlertHash({ instant: true });
        // Scoped to .nks-alert-item: see-also pills carry data-idx too, and the
        // pill pointing at alert N precedes alert N in the document.
        const item = document.querySelector('.nks-alert-item[data-idx="1"]');
        window.location.hash = '';
        if (!ok) return 'applyAlertHash reported failure';
        if (!item) return 'alert item 1 not found';
        return item.classList.contains('expanded') ? true : 'target alert was not expanded';
    });

    check('see-also pills and alert items are told apart by data-idx', () => {
        // Regression guard for the selector bug above: an unscoped
        // [data-idx="N"] matched a pill, so see-also navigation expanded nothing.
        renderList([alert({ id: 'D1' }), alert({ id: 'D2' })]);
        const first = document.querySelector('[data-idx="1"]');
        const scoped = document.querySelector('.nks-alert-item[data-idx="1"]');
        if (!scoped) return 'scoped selector found no alert item';
        if (first === scoped) return true;   // no pills rendered in this fixture
        return first.classList.contains('nks-see-also-pill')
            ? true
            : 'unexpected element matched the unscoped selector';
    });

    check('a malformed hash is ignored rather than throwing', () => {
        renderList([alert({ id: 'D1' })]);
        window.location.hash = '#alert-not-a-number';
        const ok = applyAlertHash();
        window.location.hash = '';
        return ok === false ? true : 'a malformed hash was treated as a target';
    });

    check('no hash means no navigation', () => {
        renderList([alert({ id: 'D1' })]);
        window.location.hash = '';
        return applyAlertHash() === false ? true : 'navigated without a hash';
    });

    // ── Standalone report ────────────────────────────────────────────────────
    group('Standalone report export');

    const reportData = {
        id: 'abc123',
        filename: 'capture.pcapng',
        summary: {
            total_packets: 1234,
            time_range: { duration_seconds: 60 },
            alert_counts: { Critical: 0, High: 1, Medium: 1, Low: 0, Info: 0 },
            top_talkers: [{ ip: '10.0.0.1', bytes_sent: 100, bytes_received: 200 }],
        },
        alerts: [
            alert({ id: 'R1', severity: 'High', message: 'Something bad', mitre: { tactic: 'Discovery', techniques: [{ id: 'T1046', name: 'Scanning' }] } }),
            alert({ id: 'R2', severity: 'Medium', message: 'Something odd' }),
        ],
    };

    check('report is a complete standalone HTML document', () => {
        const html = buildStandaloneReport(reportData);
        if (html.indexOf('<!DOCTYPE html>') !== 0) return 'missing doctype';
        return html.indexOf('</html>') !== -1 ? true : 'document not closed';
    });

    check('report contains no scripts and no external references', () => {
        // It must open offline, and it renders attacker-influenced capture data,
        // so nothing in it should be able to execute or phone home.
        const html = buildStandaloneReport(reportData);
        if (/<script/i.test(html)) return 'report contains a <script> tag';
        if (/\shref\s*=\s*["']https?:/i.test(html)) return 'report links to an external stylesheet';
        if (/\ssrc\s*=\s*["']https?:/i.test(html)) return 'report references an external resource';
        return true;
    });

    check('report includes every alert', () => {
        const html = buildStandaloneReport(reportData);
        return html.indexOf('Something bad') !== -1 && html.indexOf('Something odd') !== -1
            ? true : 'an alert is missing from the report';
    });

    check('report carries the ATT&CK mapping', () => {
        const html = buildStandaloneReport(reportData);
        return html.indexOf('T1046') !== -1 ? true : 'technique id missing';
    });

    check('report escapes hostile capture content', () => {
        const hostile = JSON.parse(JSON.stringify(reportData));
        hostile.alerts[0].message = '<img src=x onerror=alert(1)>';
        hostile.filename = '<script>bad()</script>';
        const html = buildStandaloneReport(hostile);
        if (/<img/i.test(html)) return 'raw <img> survived into the report';
        if (/<script/i.test(html)) return 'raw <script> survived into the report';
        return true;
    });

    check('report reflects triage marks', () => {
        freshTriage();
        renderList(reportData.alerts);
        setAlertMark('R1', 'fp');
        const html = buildStandaloneReport(reportData);
        return html.indexOf('marked false positive') !== -1 ? true : 'mark not shown in report';
    });

    // ── Theme ────────────────────────────────────────────────────────────────
    group('Theme');

    check('applyTheme sets the document attribute', () => {
        applyTheme('light');
        const got = document.documentElement.getAttribute('data-bs-theme');
        applyTheme('dark');
        return eq(got, 'light');
    });

    check('toggleTheme flips and persists the choice', () => {
        applyTheme('dark');
        toggleTheme();
        const after = document.documentElement.getAttribute('data-bs-theme');
        let stored = null;
        try { stored = localStorage.getItem('nks0_theme'); } catch (_) {}
        applyTheme('dark');
        if (after !== 'light') return `expected light after toggle, got ${after}`;
        return eq(stored, 'light', 'persisted value');
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
