/**
 * NKS0 PCAP Analyzer — static GitHub Pages frontend
 *
 * The frontend is backend-agnostic: the API base URL and optional API key
 * are stored in localStorage. The backend (FastAPI + NKS0 engine) can be
 * hosted anywhere (Fly.io, Render, Railway, local).
 */

// ─── Config keys ─────────────────────────────────────────────────────────────

const API_BASE_KEY    = 'nks0_api_base';
const API_KEY_STORAGE = 'nks0_api_key';
const DEFAULT_API     = 'http://localhost:8080';

// ─── API base / key helpers ───────────────────────────────────────────────────

function getApiBase() {
    const v = localStorage.getItem(API_BASE_KEY);
    return (v && v.trim()) ? v.trim().replace(/\/+$/, '') : DEFAULT_API;
}

function setApiBase(url) {
    const v = (url || '').trim().replace(/\/+$/, '');
    if (v) localStorage.setItem(API_BASE_KEY, v);
    else localStorage.removeItem(API_BASE_KEY);
    syncConnectionBar();
    checkApiStatus();
}

function getApiKey() {
    const v = localStorage.getItem(API_KEY_STORAGE);
    return (v && v.trim()) ? v.trim() : '';
}

function setApiKey(key) {
    const v = (key || '').trim();
    if (v) localStorage.setItem(API_KEY_STORAGE, v);
    else localStorage.removeItem(API_KEY_STORAGE);
}

function apiHeaders() {
    const key = getApiKey();
    return key ? { 'X-API-Key': key } : {};
}

// ─── Connection bar ───────────────────────────────────────────────────────────

function initConnectionBar() {
    const urlInput  = document.getElementById('api-base-input');
    const keyInput  = document.getElementById('api-key-input');
    const saveBtn   = document.getElementById('api-save-btn');

    if (!urlInput) return;

    syncConnectionBar();

    const save = () => {
        setApiBase(urlInput.value);
        setApiKey(keyInput ? keyInput.value : '');
        maybeHideNoBackendWarning();
    };

    if (saveBtn) saveBtn.addEventListener('click', save);
    urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });

    checkApiStatus();
    // Refresh connection status every 30 s
    setInterval(checkApiStatus, 30_000);
}

function syncConnectionBar() {
    const urlInput = document.getElementById('api-base-input');
    const keyInput = document.getElementById('api-key-input');
    if (urlInput) urlInput.value = getApiBase();
    if (keyInput) keyInput.value = getApiKey();
}

function setApiStatus(text, kind) {
    const el = document.getElementById('api-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'badge nks-status-badge' +
        (kind === 'ok' ? ' nks-status-ok' : kind === 'error' ? ' nks-status-error' : '');
}

function checkApiStatus() {
    setApiStatus('…', '');
    fetch(getApiBase() + '/api/health', { method: 'GET', headers: apiHeaders() })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(() => setApiStatus('Connected', 'ok'))
        .catch(() => setApiStatus('Disconnected', 'error'));
}

// ─── "No backend" warning (index page) ───────────────────────────────────────

function maybeShowNoBackendWarning() {
    const w = document.getElementById('no-backend-warning');
    if (!w) return;
    // Show if API base is still the default local address
    const base = getApiBase();
    if (base === DEFAULT_API || base === '') {
        w.classList.remove('d-none');
    }
}

function maybeHideNoBackendWarning() {
    const w = document.getElementById('no-backend-warning');
    if (w) w.classList.add('d-none');
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function escapeHtml(str) {
    if (str == null) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    if (seconds < 60) return seconds.toFixed(1) + 's';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + Math.floor(seconds % 60) + 's';
    const h = Math.floor(seconds / 3600);
    return h + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
}

function formatNumber(n) {
    if (n == null) return '0';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
}

function sevClass(sev) {
    return (sev || 'info').toLowerCase();
}

// ─── Upload page ──────────────────────────────────────────────────────────────

function initUpload() {
    const zone  = document.getElementById('upload-zone');
    const input = document.getElementById('pcap-input');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) uploadFile(e.dataTransfer.files[0]);
    });

    input.addEventListener('change', () => {
        if (input.files.length > 0) uploadFile(input.files[0]);
    });

    maybeShowNoBackendWarning();
}

function uploadFile(file) {
    const prompt    = document.getElementById('upload-prompt');
    const progress  = document.getElementById('upload-progress');
    const errorDiv  = document.getElementById('upload-error');
    const fnameEl   = document.getElementById('progress-filename');
    const statusEl  = document.getElementById('progress-status');

    if (!prompt || !progress || !errorDiv) return;

    prompt.classList.add('d-none');
    errorDiv.classList.add('d-none');
    progress.classList.remove('d-none');
    if (fnameEl) fnameEl.textContent = file.name;
    if (statusEl) statusEl.textContent = 'Uploading and analyzing…';

    const fd = new FormData();
    fd.append('file', file);

    fetch(getApiBase() + '/api/analyze', {
        method: 'POST',
        body: fd,
        headers: apiHeaders(),
    })
        .then(resp => {
            if (!resp.ok) return resp.json().then(d => { throw new Error(d.detail || 'Analysis failed'); });
            return resp.json();
        })
        .then(data => {
            window.location.href = 'results.html?id=' + encodeURIComponent(data.id);
        })
        .catch(err => {
            progress.classList.add('d-none');
            errorDiv.classList.remove('d-none');
            const msgEl = document.getElementById('error-message');
            if (msgEl) msgEl.textContent = err.message;
        });
}

function resetUpload() {
    const els = {
        prompt:   document.getElementById('upload-prompt'),
        progress: document.getElementById('upload-progress'),
        error:    document.getElementById('upload-error'),
        input:    document.getElementById('pcap-input'),
    };
    if (els.prompt)   els.prompt.classList.remove('d-none');
    if (els.progress) els.progress.classList.add('d-none');
    if (els.error)    els.error.classList.add('d-none');
    if (els.input)    els.input.value = '';
}

function loadRecentResults() {
    const container = document.getElementById('recent-results');
    const list      = document.getElementById('recent-list');
    if (!container || !list) return;

    fetch(getApiBase() + '/api/results', { headers: apiHeaders() })
        .then(r => r.json())
        .then(data => {
            const items = data.results || [];
            if (!items.length) return;

            container.classList.remove('d-none');
            list.innerHTML = items.map(item => {
                const counts = item.alert_counts || {};
                const badges = ['High', 'Medium', 'Low', 'Info']
                    .filter(s => counts[s] > 0)
                    .map(s => `<span class="nks-sev-pill ${sevClass(s)}">${counts[s]} ${s}</span>`)
                    .join(' ');

                return `<a href="results.html?id=${encodeURIComponent(item.id)}" class="nks-recent-item">
                    <span><i class="bi bi-file-earmark-text me-1"></i>${escapeHtml(item.filename || item.id)}</span>
                    <span class="d-flex align-items-center gap-2">
                        ${badges}
                        <span class="text-secondary">${formatNumber(item.total_packets)} pkts</span>
                    </span>
                </a>`;
            }).join('');
        })
        .catch(() => {});
}

// ─── Results page ─────────────────────────────────────────────────────────────

let _allAlerts    = [];
let _rawData      = null;
let _currentFilter = 'all';
let _searchQuery   = '';

function loadResults(analysisId) {
    const loadingEl = document.getElementById('loading-state');
    const contentEl = document.getElementById('results-content');
    const errorEl   = document.getElementById('error-state');

    fetch(getApiBase() + '/api/results/' + encodeURIComponent(analysisId), { headers: apiHeaders() })
        .then(resp => {
            if (!resp.ok) throw new Error('Analysis not found (id: ' + analysisId + ')');
            return resp.json();
        })
        .then(data => {
            _rawData = data;
            if (loadingEl) loadingEl.classList.add('d-none');
            if (contentEl) contentEl.classList.remove('d-none');
            renderResults(data);
            initExportButton(data);
            initAlertSearch();
        })
        .catch(err => {
            if (loadingEl) loadingEl.classList.add('d-none');
            if (errorEl)   errorEl.classList.remove('d-none');
            const msgEl = document.getElementById('results-error-message');
            if (msgEl) msgEl.textContent = err.message;
        });
}

function renderResults(data) {
    const summary   = data.summary   || {};
    const timeRange = summary.time_range || {};

    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    set('stat-filename',      data.filename || data.id || '—');
    set('stat-packets',       formatNumber(summary.total_packets || 0));
    set('stat-duration',      formatDuration(timeRange.duration_seconds || 0));
    set('stat-analysis-time', ((data.analysis_time_seconds || 0).toFixed(2)) + 's');

    renderSeverityBadges(summary.alert_counts || {});
    renderAlerts(data.alerts || []);
    renderProtocolChart(summary.protocol_bytes || {});
    renderHostsTable(summary.top_talkers || []);
    renderSeverityChart(summary.alert_counts || {});
}

// ─── Severity summary badges ──────────────────────────────────────────────────

function renderSeverityBadges(counts) {
    const el = document.getElementById('severity-badges');
    if (!el) return;
    el.innerHTML = ['High', 'Medium', 'Low', 'Info'].map(sev => {
        const n = counts[sev] || 0;
        return `<span class="nks-sev-badge nks-sev-${sevClass(sev)}">${n} ${sev}</span>`;
    }).join('');
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

function renderAlerts(alerts) {
    _allAlerts = alerts;
    renderAlertFilters(alerts);
    applyAlertsFilter();
}

function renderAlertFilters(alerts) {
    const container = document.getElementById('alert-filters');
    if (!container) return;

    const cats = [...new Set(alerts.map(a => a.category || 'Generic'))].sort();
    let html = `<button class="btn btn-outline-secondary nks-filter-btn active" onclick="setAlertFilter('all')">All</button>`;
    cats.forEach(cat => {
        html += `<button class="btn btn-outline-secondary nks-filter-btn" onclick="setAlertFilter(${JSON.stringify(cat)})">${escapeHtml(cat)}</button>`;
    });
    container.innerHTML = html;
}

function setAlertFilter(category) {
    _currentFilter = category;
    document.querySelectorAll('#alert-filters .nks-filter-btn').forEach(btn => {
        const label = category === 'all' ? 'All' : category;
        btn.classList.toggle('active', btn.textContent.trim() === label);
    });
    applyAlertsFilter();
}

function initAlertSearch() {
    const input = document.getElementById('alert-search');
    if (!input) return;
    input.addEventListener('input', () => {
        _searchQuery = input.value.trim().toLowerCase();
        applyAlertsFilter();
    });
}

function applyAlertsFilter() {
    let filtered = _currentFilter === 'all'
        ? _allAlerts
        : _allAlerts.filter(a => (a.category || 'Generic') === _currentFilter);

    if (_searchQuery) {
        filtered = filtered.filter(a =>
            (a.message || '').toLowerCase().includes(_searchQuery) ||
            (a.category || '').toLowerCase().includes(_searchQuery) ||
            (a.severity || '').toLowerCase().includes(_searchQuery)
        );
    }

    renderAlertList(filtered);

    const footer = document.getElementById('alerts-footer');
    const label  = document.getElementById('alerts-count-label');
    if (footer && label) {
        label.textContent = filtered.length + ' of ' + _allAlerts.length + ' alerts';
        footer.classList.remove('d-none');
    }
}

function renderAlertList(alerts) {
    const container = document.getElementById('alerts-container');
    if (!container) return;

    if (!alerts.length) {
        container.innerHTML = '<div class="text-center text-secondary p-4">No matching alerts</div>';
        return;
    }

    const sevOrder = { High: 0, Medium: 1, Low: 2, Info: 3 };
    const sorted = [...alerts].sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4));

    container.innerHTML = sorted.map(alert => {
        const sev     = sevClass(alert.severity);
        const confHtml = alert.confidence != null
            ? `<span class="nks-conf-badge">${(alert.confidence * 100).toFixed(0)}%</span>`
            : '';

        let detailsHtml = '';

        if (alert.evidence && Object.keys(alert.evidence).length) {
            detailsHtml += '<div class="mb-2"><span class="text-secondary" style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.05em">Evidence</span></div>';
            for (const [k, v] of Object.entries(alert.evidence)) {
                const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
                detailsHtml += `<div class="nks-evidence-row">
                    <span class="nks-evidence-key">${escapeHtml(k)}</span>
                    <span class="nks-evidence-val">${escapeHtml(val)}</span>
                </div>`;
            }
        }

        if (alert.tags && alert.tags.length) {
            detailsHtml += '<div class="mt-2">';
            alert.tags.forEach(t => { detailsHtml += `<span class="nks-tag">${escapeHtml(t)}</span>`; });
            detailsHtml += '</div>';
        }

        return `<div class="nks-alert-item" onclick="this.classList.toggle('expanded')">
            <div class="d-flex align-items-start gap-2">
                <span class="nks-sev-pill ${sev}">${escapeHtml(alert.severity)}</span>
                <div class="flex-grow-1 min-width-0">
                    <span>${escapeHtml(alert.message)}</span>${confHtml}
                    <div class="text-secondary" style="font-size:0.73rem">${escapeHtml(alert.category || '')}</div>
                </div>
            </div>
            ${detailsHtml ? `<div class="nks-alert-details">${detailsHtml}</div>` : ''}
        </div>`;
    }).join('');
}

// ─── Export JSON ──────────────────────────────────────────────────────────────

function initExportButton(data) {
    const btn = document.getElementById('export-json-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = (data.filename || data.id || 'nks0-results') + '.json';
        a.click();
        URL.revokeObjectURL(url);
    });
}

// ─── Protocol chart ───────────────────────────────────────────────────────────

let _protocolChart = null;

function renderProtocolChart(protocolBytes) {
    const canvas = document.getElementById('protocol-chart');
    if (!canvas) return;

    const entries = Object.entries(protocolBytes).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
        canvas.parentElement.innerHTML = '<p class="text-secondary text-center small py-3">No protocol data</p>';
        return;
    }

    const palette = ['#58a6ff', '#f85149', '#d29922', '#3fb950', '#bc8cff', '#f778ba', '#79c0ff', '#56d364'];

    if (_protocolChart) { _protocolChart.destroy(); _protocolChart = null; }

    _protocolChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: entries.map(e => e[0]),
            datasets: [{
                data: entries.map(e => e[1]),
                backgroundColor: palette.slice(0, entries.length),
                borderWidth: 0,
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#8b949e', font: { size: 10 }, padding: 10 } },
                tooltip: { callbacks: { label: ctx => ctx.label + ': ' + formatBytes(ctx.raw) } },
            },
        },
    });
}

// ─── Severity bar chart ───────────────────────────────────────────────────────

let _severityChart = null;

function renderSeverityChart(counts) {
    const canvas = document.getElementById('severity-chart');
    if (!canvas) return;

    const labels = ['High', 'Medium', 'Low', 'Info'];
    const values = labels.map(s => counts[s] || 0);
    const colors = ['#f85149', '#d29922', '#58a6ff', '#3fb950'];

    if (_severityChart) { _severityChart.destroy(); _severityChart = null; }

    _severityChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                borderRadius: 4,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#21262d' }, ticks: { color: '#8b949e', font: { size: 11 } } },
                y: {
                    grid: { color: '#21262d' },
                    ticks: { color: '#8b949e', font: { size: 11 }, precision: 0 },
                    beginAtZero: true,
                },
            },
        },
    });
}

// ─── Hosts table ──────────────────────────────────────────────────────────────

function renderHostsTable(talkers) {
    const tbody = document.getElementById('hosts-table-body');
    if (!tbody) return;

    if (!talkers.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-secondary">No hosts</td></tr>';
        return;
    }

    tbody.innerHTML = talkers.map(h => {
        const label = h.hostname
            ? `${escapeHtml(h.ip)} <span class="text-secondary">(${escapeHtml(h.hostname)})</span>`
            : escapeHtml(h.ip);
        return `<tr>
            <td>${label}</td>
            <td class="text-end">${formatBytes(h.bytes_sent)}</td>
            <td class="text-end">${formatBytes(h.bytes_received)}</td>
        </tr>`;
    }).join('');
}
