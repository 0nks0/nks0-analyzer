/**
 * NKS0 PCAP Analyzer — static GitHub Pages frontend
 * No authentication required — uses the guest analysis endpoint.
 */

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_BASE = 'https://nks0-api.onrender.com';
const APP_VERSION = '1.2.4'; // bump this when releasing a new version
function getApiBase() { return API_BASE; }
function apiHeaders() { return {}; }

// ─── Connection status ────────────────────────────────────────────────────────

function initConnectionBar() {
    // Inject version into footer and navbar wherever present
    ['footer-version', 'nav-version'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = 'v' + APP_VERSION;
    });
    checkApiStatus();
    setInterval(checkApiStatus, 30_000);
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
    fetch(API_BASE + '/api/health')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(() => setApiStatus('Online', 'ok'))
        .catch(() => setApiStatus('Offline', 'error'));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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

function formatTs(unix) {
    if (!unix || unix <= 0) return null;
    const d = new Date(unix * 1000);
    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

function formatTsRange(first, last) {
    if (!first) return null;
    const f = formatTs(first);
    if (!last || last === first) return f;
    const dur = last - first;
    if (dur < 1) return f;
    return f + ' — ' + formatDuration(dur);
}

function sevClass(sev) { return (sev || 'info').toLowerCase(); }

// ─── Upload page ──────────────────────────────────────────────────────────────

function initUpload() {
    const zone  = document.getElementById('upload-zone');
    const input = document.getElementById('pcap-input');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) uploadFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', () => {
        if (input.files.length > 0) uploadFile(input.files[0]);
    });
}

function uploadFile(file) {
    const prompt   = document.getElementById('upload-prompt');
    const progress = document.getElementById('upload-progress');
    const errorDiv = document.getElementById('upload-error');
    const fnameEl  = document.getElementById('progress-filename');
    const statusEl = document.getElementById('progress-status');
    const barEl    = document.getElementById('upload-progress-bar');
    const estEl    = document.getElementById('progress-estimate');
    if (!prompt || !progress || !errorDiv) return;

    prompt.classList.add('d-none');
    errorDiv.classList.add('d-none');
    progress.classList.remove('d-none');
    if (fnameEl) fnameEl.textContent = file.name;
    if (statusEl) statusEl.textContent = 'Uploading…';
    if (barEl) barEl.style.width = '0%';
    if (estEl) estEl.textContent = '';

    // Rough estimate: ~2s per MB on Render free tier, minimum 8s
    const estAnalysisSec = Math.max(8, Math.round(file.size / (1024 * 1024) * 2));

    const setBar = pct => { if (barEl) barEl.style.width = Math.min(100, Math.max(0, pct)) + '%'; };

    const showError = msg => {
        progress.classList.add('d-none');
        errorDiv.classList.remove('d-none');
        const el = document.getElementById('error-message');
        if (el) el.textContent = msg;
    };

    const startAnalysisProgress = jobId => {
        if (statusEl) statusEl.textContent = 'Analyzing…';
        setBar(45);
        let elapsed = 0;
        const timer = setInterval(() => {
            elapsed++;
            // Slides from 45 → 92 over estAnalysisSec seconds
            setBar(45 + Math.min(47, (elapsed / estAnalysisSec) * 47));
            const rem = Math.max(0, estAnalysisSec - elapsed);
            if (estEl) estEl.textContent = rem > 2 ? `~${rem}s remaining` : 'Almost done…';
        }, 1000);

        pollJob(jobId, null, 1500, 300_000)
            .then(id => {
                clearInterval(timer);
                setBar(100);
                if (statusEl) statusEl.textContent = 'Done!';
                if (estEl) estEl.textContent = '';
                setTimeout(() => { window.location.href = 'results.html?id=' + encodeURIComponent(id); }, 300);
            })
            .catch(err => { clearInterval(timer); showError(err.message); });
    };

    // Use XHR so we can track upload progress
    const xhr = new XMLHttpRequest();
    const fd  = new FormData();
    fd.append('file', file);

    xhr.upload.onprogress = e => {
        if (e.lengthComputable) setBar((e.loaded / e.total) * 40);
    };

    xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
            let msg = 'Upload failed';
            try { msg = JSON.parse(xhr.responseText).detail || msg; } catch {}
            return showError(msg);
        }
        const data = JSON.parse(xhr.responseText);
        startAnalysisProgress(data.id);
    };

    xhr.onerror = () => showError('Network error — check your connection and try again');

    xhr.open('POST', getApiBase() + '/api/analyze/guest');
    xhr.send(fd);
}

function pollJob(jobId, statusEl, interval = 1500, maxWait = 300_000) {
    const deadline = Date.now() + maxWait;
    let elapsed = 0;
    return new Promise((resolve, reject) => {
        const tick = () => {
            if (Date.now() > deadline) return reject(new Error('Analysis timed out — try a smaller file'));
            elapsed += interval;
            if (statusEl) statusEl.textContent = `Analyzing… (${Math.round(elapsed / 1000)}s)`;
            fetch(getApiBase() + '/api/jobs/' + encodeURIComponent(jobId), { headers: apiHeaders() })
                .then(r => r.json())
                .then(data => {
                    if (data.status === 'done') return resolve(jobId);
                    if (data.status === 'error') return reject(new Error(data.detail || 'Analysis failed on server'));
                    setTimeout(tick, interval);
                })
                .catch(() => setTimeout(tick, interval * 2));
        };
        tick();
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
    // Guest mode — no auth, no server-side history.
}

// ─── Results page state ───────────────────────────────────────────────────────

let _allAlerts     = [];
let _rawData       = null;
let _checkedSev    = new Set();
let _checkedCats   = new Set();
let _ipSearchQuery = '';
let _activeSevTab  = 'All';
let _sevCounts     = {};
let _hostnames     = {};
let _geoInfo       = {};
let _osGuesses     = {};
let _ipSearchTimer = null;
let _currentAnalysisId = null;

// ─── Load results ─────────────────────────────────────────────────────────────

function loadResults(analysisId) {
    _currentAnalysisId = analysisId;
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
            if (data.is_guest) showGuestBanner(data.expires_at);
        })
        .catch(err => {
            if (loadingEl) loadingEl.classList.add('d-none');
            if (errorEl)   errorEl.classList.remove('d-none');
            const msgEl = document.getElementById('results-error-message');
            if (msgEl) msgEl.textContent = err.message;
        });
}

function renderResults(data) {
    const summary   = data.summary || {};
    const timeRange = summary.time_range || {};

    const set = (id, text, title) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = text;
        if (title) el.title = title;
    };
    set('stat-filename',      data.filename || data.id || '—', data.filename || '');
    set('stat-packets',       formatNumber(summary.total_packets || 0));
    set('stat-duration',      formatDuration(timeRange.duration_seconds || 0));
    set('stat-analysis-time', ((data.analysis_time_seconds || 0).toFixed(2)) + 's');

    // Build ip → hostname / geo / os lookups
    _hostnames = {};
    _geoInfo   = {};
    _osGuesses = {};

    (summary.top_talkers || []).forEach(h => {
        if (h.hostname) _hostnames[h.ip] = h.hostname;
        if (h.os_guess) _osGuesses[h.ip] = h.os_guess;
        if (h.country || h.asn) _geoInfo[h.ip] = h;
    });
    (data.hosts || []).forEach(h => {
        if (h.hostname && !_hostnames[h.ip]) _hostnames[h.ip] = h.hostname;
        if (h.os_guess && !_osGuesses[h.ip]) _osGuesses[h.ip] = h.os_guess;
        if ((h.country || h.asn) && !_geoInfo[h.ip]) _geoInfo[h.ip] = h;
    });
    // Dedicated host_geo map (covers all hosts)
    Object.entries(data.host_geo || {}).forEach(([ip, g]) => {
        if (g.country || g.asn) _geoInfo[ip] = g;
    });

    renderSeverityBadges(summary.alert_counts || {});
    renderAlerts(data.alerts || []);
    renderProtocolChart(summary.protocol_bytes || {});
    renderHostsTable(summary.top_talkers || []);
    renderSeverityChart(summary.alert_counts || {});
    renderNetworkGraph(data.connections || summary.connections || [], data.alerts || [], summary.top_talkers || []);
    renderGeoMap(data.hosts || summary.top_talkers || [], data.alerts || []);
    initExportButtons(data);
}

// ─── Severity tab buttons ─────────────────────────────────────────────────────

function renderSeverityBadges(counts) {
    _sevCounts = counts;
    const el    = document.getElementById('severity-badges');
    if (!el) return;
    const order = ['Critical', 'High', 'Medium', 'Low', 'Info'];
    const total = order.reduce((s, sev) => s + (counts[sev] || 0), 0);

    let html = `<button class="nks-sev-tab${_activeSevTab === 'All' ? ' active' : ''}" onclick="filterBySev('All')">All <span class="nks-sev-tab-count">${total}</span></button>`;
    order.forEach(sev => {
        const n = counts[sev] || 0;
        if (!n) return;
        const active = _activeSevTab === sev ? ' active' : '';
        html += `<button class="nks-sev-tab nks-sev-${sevClass(sev)}${active}" onclick="filterBySev('${sev}')">${escapeHtml(sev)} <span class="nks-sev-tab-count">${n}</span></button>`;
    });
    el.innerHTML = html;
}

function filterBySev(sev) {
    _activeSevTab = sev;
    const order = ['Critical', 'High', 'Medium', 'Low', 'Info'];
    _checkedSev  = sev === 'All' ? new Set(order) : new Set([sev]);
    _checkedCats = new Set(_allAlerts.map(a => a.category || 'Generic'));
    renderSeverityBadges(_sevCounts);
    renderFilterBar(_allAlerts);
    updateFilterPills();
    applyFilters();
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function renderAlerts(alerts) {
    _allAlerts   = alerts;
    _activeSevTab = 'All';
    _checkedSev  = new Set(alerts.map(a => a.severity || 'Info'));
    _checkedCats = new Set(alerts.map(a => a.category || 'Generic'));
    renderFilterBar(alerts);
    renderTimeline(alerts);
    applyFilters();
}

function renderFilterBar(alerts) {
    const bar = document.getElementById('alert-filter-bar');
    if (!bar) return;

    const catCounts = {};
    _allAlerts.forEach(a => {
        const cat = a.category || 'Generic';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    if (!Object.keys(catCounts).length) { bar.innerHTML = ''; return; }

    const pills = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, n]) => {
            const active = _checkedCats.has(cat) ? ' active' : '';
            return `<button class="nks-cat-pill${active}" data-cat="${escapeHtml(cat)}"
                        onclick="toggleCat(this.dataset.cat, !_checkedCats.has(this.dataset.cat))">${escapeHtml(cat)}<span class="nks-pill-count">${n}</span></button>`;
        }).join('');

    bar.innerHTML = `<div class="d-flex flex-wrap gap-1 align-items-center">${pills}<span class="nks-filter-count ms-2" id="filter-count"></span></div>`;
}

function toggleSev(sev, on) { on ? _checkedSev.add(sev) : _checkedSev.delete(sev); applyFilters(); }
function toggleCat(cat, on) { on ? _checkedCats.add(cat) : _checkedCats.delete(cat); updateFilterPills(); applyFilters(); }

function updateFilterPills() {
    document.querySelectorAll('#alert-filter-bar .nks-cat-pill').forEach(btn => {
        btn.classList.toggle('active', _checkedCats.has(btn.dataset.cat));
    });
}

// ─── IP search ────────────────────────────────────────────────────────────────

function onIpSearchInput(val) {
    clearTimeout(_ipSearchTimer);
    _ipSearchTimer = setTimeout(() => {
        _ipSearchQuery = (val || '').trim().toLowerCase();
        const clearBtn = document.getElementById('search-clear-btn');
        if (clearBtn) clearBtn.classList.toggle('d-none', !_ipSearchQuery);
        applyFilters();
    }, 120);
}

function clearIpSearch() {
    _ipSearchQuery = '';
    const inp = document.getElementById('alert-ip-search');
    if (inp) inp.value = '';
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.classList.add('d-none');
    applyFilters();
}

function _alertMatchesIpSearch(alert) {
    if (!_ipSearchQuery) return true;
    const d = alert.details || {};
    const fields = [
        alert.category, alert.message,
        d.src_ip, d.dst_ip, d.target_ip, d.ip, d.mac, d.domain, d.hostname,
        ...(d.macs || []),
        ...(d.announced_ips || []),
        ...(d.domains || []),
        ...(d.samples || []).map(s => s.dst_ip),
    ];
    return fields.some(f => f && String(f).toLowerCase().includes(_ipSearchQuery));
}

function expandAllAlerts() {
    document.querySelectorAll('.nks-alert-item:not(.expanded)').forEach(el => el.classList.add('expanded'));
}
function collapseAllAlerts() {
    document.querySelectorAll('.nks-alert-item.expanded').forEach(el => el.classList.remove('expanded'));
}

// ─── Apply filters ────────────────────────────────────────────────────────────

function applyFilters() {
    const filtered = _allAlerts.filter(a => {
        const sev = a.severity || 'Info';
        const cat = a.category || 'Generic';
        return _checkedSev.has(sev) && _checkedCats.has(cat) && _alertMatchesIpSearch(a);
    });

    const countEl = document.getElementById('filter-count');
    if (countEl) {
        countEl.textContent = filtered.length === _allAlerts.length
            ? `${_allAlerts.length} alert${_allAlerts.length !== 1 ? 's' : ''}`
            : `${filtered.length} / ${_allAlerts.length} shown`;
    }
    const badgeEl = document.getElementById('alert-card-count');
    if (badgeEl) {
        badgeEl.textContent = filtered.length === _allAlerts.length
            ? _allAlerts.length
            : `${filtered.length} / ${_allAlerts.length}`;
    }

    renderAlertList(filtered);

    const footer = document.getElementById('alerts-footer');
    const label  = document.getElementById('alerts-count-label');
    if (footer && label) {
        label.textContent = filtered.length + ' of ' + _allAlerts.length + ' alerts';
        footer.classList.remove('d-none');
    }
}

// ─── Alert list renderer ──────────────────────────────────────────────────────

function _buildSeeAlsoMap(alerts) {
    const map = {};
    alerts.forEach((a, idx) => {
        const ip = (a.details || {}).src_ip || (a.details || {}).ip;
        if (!ip) return;
        if (!map[ip]) map[ip] = [];
        map[ip].push({ category: a.category || 'Generic', severity: a.severity || 'Info', idx });
    });
    return map;
}

function renderAlertList(alerts) {
    const container = document.getElementById('alerts-container');
    if (!container) return;

    if (!alerts.length) {
        container.innerHTML = '<div class="text-center text-secondary p-4">No matching alerts</div>';
        return;
    }

    const sevOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
    const sorted   = [...alerts].sort((a, b) => (sevOrder[a.severity] ?? 5) - (sevOrder[b.severity] ?? 5));
    const seeAlso  = _buildSeeAlsoMap(sorted);

    container.innerHTML = sorted.map((alert, idx) => {
        const sev = sevClass(alert.severity);

        const confHtml = (() => {
            if (alert.confidence == null) return '';
            const pct = (alert.confidence * 100).toFixed(0);
            const col = alert.confidence >= 0.70 ? 'var(--nks-info)' :
                        alert.confidence >= 0.40 ? 'var(--nks-medium)' : 'var(--nks-high)';
            return `<span class="nks-conf-badge" style="color:${col}">${pct}%</span>`;
        })();

        const tsHtml = (() => {
            const r = formatTsRange(alert.first_seen, alert.last_seen);
            return r ? `<div class="nks-alert-time"><i class="bi bi-clock" style="font-size:0.6rem"></i> ${escapeHtml(r)}</div>` : '';
        })();

        const richHtml   = _renderAlertBody(alert);
        const tagsHtml   = (alert.tags && alert.tags.length)
            ? `<div class="mt-2">${alert.tags.map(t => `<span class="nks-tag">${escapeHtml(t)}</span>`).join('')}</div>`
            : '';
        const seeAlsoHtml = _renderSeeAlso(alert, idx, seeAlso);

        const detailsHtml = (richHtml || tagsHtml || seeAlsoHtml)
            ? `<div class="nks-alert-details">${richHtml}${tagsHtml}${seeAlsoHtml}</div>`
            : '';

        return `<div class="nks-alert-item" data-idx="${idx}" data-sev="${escapeHtml(alert.severity)}" onclick="this.classList.toggle('expanded')">
            <div class="d-flex align-items-start gap-2" style="padding-right:1.4rem">
                <span class="nks-sev-pill ${sev}">${escapeHtml(alert.severity)}</span>
                <div class="flex-grow-1" style="min-width:0">
                    <span>${_enrichMsg(alert.message)}</span>${confHtml}
                    <div class="text-secondary" style="font-size:0.73rem">${escapeHtml(alert.category || '')}</div>
                    ${tsHtml}
                </div>
            </div>
            ${detailsHtml}
        </div>`;
    }).join('');
}

// ─── See-also cross-links ─────────────────────────────────────────────────────

function _renderSeeAlso(alert, alertIdx, seeAlsoMap) {
    const ip = (alert.details || {}).src_ip || (alert.details || {}).ip;
    if (!ip) return '';
    const related = (seeAlsoMap[ip] || []).filter(x => x.idx !== alertIdx);
    if (!related.length) return '';
    const pills = related.slice(0, 6).map(r =>
        `<span class="nks-see-also-pill nks-sev-pill ${sevClass(r.severity)}"
              onclick="event.stopPropagation(); scrollToAlert(${r.idx})">${escapeHtml(r.category)}</span>`
    ).join('');
    return `<div class="nks-see-also"><i class="bi bi-link-45deg"></i> Same host: ${pills}</div>`;
}

function scrollToAlert(idx) {
    const el = document.querySelector(`[data-idx="${idx}"]`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('expanded');
    }
}

// ─── IP / Geo / OS label helpers ─────────────────────────────────────────────

function _flagEmoji(iso2) {
    if (!iso2 || iso2.length !== 2) return '';
    const base = 0x1F1E6;
    const a = iso2.toUpperCase().charCodeAt(0) - 65;
    const b = iso2.toUpperCase().charCodeAt(1) - 65;
    if (a < 0 || a > 25 || b < 0 || b > 25) return '';
    return String.fromCodePoint(base + a) + String.fromCodePoint(base + b);
}

const _IP_RE = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/g;
function _enrichMsg(msg) {
    if (!msg) return '';
    return escapeHtml(msg).replace(_IP_RE, ip => {
        const hn = _hostnames[ip];
        return hn ? `${ip} <span class="nks-hostname">(${escapeHtml(hn)})</span>` : ip;
    });
}

function _ipLabel(ip) {
    if (!ip) return '';
    let label = escapeHtml(ip);
    const hn  = _hostnames[ip];
    const geo = _geoInfo[ip];
    if (hn)  label += ` <span class="nks-hostname">(${escapeHtml(hn)})</span>`;
    if (geo && geo.country) {
        const flag  = _flagEmoji(geo.country);
        const where = [geo.city, geo.region, geo.country_name || geo.country].filter(Boolean).join(', ');
        label += ` <span class="nks-geo-badge" title="${escapeHtml(where)}">${flag} ${escapeHtml(geo.country_name || geo.country)}</span>`;
    }
    if (geo && (geo.org || geo.asn)) {
        const asnLabel = [geo.org, geo.asn ? `AS${geo.asn}` : null].filter(Boolean).join(' · ');
        label += ` <span class="nks-asn-badge">${escapeHtml(asnLabel)}</span>`;
    }
    return label;
}

function _osLabel(ip) {
    const os = _osGuesses[ip];
    return os ? `<span class="nks-os-badge ms-1">${escapeHtml(os)}</span>` : '';
}

// ─── Per-category rich renderers ──────────────────────────────────────────────

function _renderAlertBody(alert) {
    try {
    const cat = alert.category || '';
    let html = '';
    switch (cat) {
        case 'PortScan':              html = _renderPortScan(alert); break;
        case 'BruteForce':            html = _renderBruteForce(alert); break;
        case 'CleartextCredentials':  html = _renderCredentials(alert); break;
        case 'Beaconing':             html = _renderBeaconing(alert); break;
        case 'StunTunnel':            html = _renderStunTunnel(alert); break;
        case 'SuspiciousDNS':         html = _renderSuspiciousDns(alert); break;
        case 'DataExfiltration':      html = _renderDataExfil(alert); break;
        case 'HttpAnomaly':           html = _renderHttpAnomaly(alert); break;
        case 'LargeFlow':             html = _renderLargeFlow(alert); break;
        case 'TlsAnomaly':            html = _renderTlsAnomaly(alert); break;
        case 'ArpSpoofing':           html = _renderArpSpoofing(alert); break;
        case 'IcmpTunnel':            html = _renderIcmpTunnel(alert); break;
        case 'DohBypass':             html = _renderDohBypass(alert); break;
        case 'SmbLateral':            html = _renderSmbLateral(alert); break;
        case 'RdpBrute':              html = _renderRdpBrute(alert); break;
        case 'PingSweep':             html = _renderPingSweep(alert); break;
        case 'LlmnrPoisoning':        html = _renderLlmnrPoisoning(alert); break;
        case 'TorTraffic':            html = _renderTorTraffic(alert); break;
        case 'LargeDnsFlow':          html = _renderLargeDnsFlow(alert); break;
        case 'SshSpray':              html = _renderSshSpray(alert); break;
        case 'Correlation':
        case 'ActiveExfiltration':
        case 'FullAttackChain':
        case 'PossibleCompromise':
        case 'ActiveIntrusion':
        case 'EncryptedC2':
        case 'DnsTunneling':
        case 'LateralMovementCampaign':
        case 'C2Evasion':
        case 'NetworkMitm':
        case 'AggressiveRecon':
        case 'MultiVectorRecon':      html = _renderCorrelation(alert); break;
        default:                      html = _renderDefault(alert); break;
    }
    html += _remediationHtml(cat);
    return html;
    } catch (e) {
        console.error('Alert render error:', e, alert);
        return `<div class="text-secondary small p-2">[Detail render error — ${escapeHtml(String(e.message || e))}]</div>`;
    }
}

function _chip(val, label) {
    return `<div class="nks-stat-chip">
        <span class="nks-stat-chip-val">${val}</span>
        <span class="nks-stat-chip-lbl">${escapeHtml(label)}</span>
    </div>`;
}

function _mitreHtml(mitre) {
    if (!mitre || !Array.isArray(mitre.techniques) || !mitre.techniques.length) return '';
    const tactic = mitre.tactic ? `<span class="text-secondary" style="font-size:0.72rem">${escapeHtml(mitre.tactic)} — </span>` : '';
    const techs  = mitre.techniques.map(t =>
        `<span class="nks-mitre-tag" title="${escapeHtml(t.name || '')}">${escapeHtml(t.id)}</span>`
    ).join('');
    return `<div class="nks-detail-section"><div class="nks-detail-label">MITRE ATT&amp;CK</div><div>${tactic}${techs}</div></div>`;
}

// ── PortScan ──────────────────────────────────────────────────────────────────

function _renderPortScan(alert) {
    const d = alert.details || {}, ev = alert.evidence || {};
    let html = `<div class="nks-stat-row">
        ${_chip(ev.unique_ports || 0, 'Ports scanned')}
        ${_chip(ev.confirmed_open_ports || 0, 'Open found')}
        ${_chip(ev.threshold || 0, 'Threshold')}
    </div>`;
    html += `<div class="nks-detail-section">
        <div class="nks-detail-label">Scan pair</div>
        <div>${_ipLabel(d.src_ip)}${_osLabel(d.src_ip)} <span class="text-secondary">→</span> ${_ipLabel(d.dst_ip)}${_osLabel(d.dst_ip)}</div>
    </div>`;
    const learned = d.attacker_learned || [];
    if (learned.length) {
        html += `<div class="nks-detail-section"><div class="nks-detail-label">Open ports found (${learned.length})</div><div class="nks-port-grid">`;
        learned.forEach(p => { html += `<span class="nks-port-badge" title="${escapeHtml(String(p.response_summary || ''))}">:${p.port}</span>`; });
        html += '</div></div>';
    }
    html += _mitreHtml(d.mitre);
    return html;
}

// ── BruteForce ────────────────────────────────────────────────────────────────

function _renderBruteForce(alert) {
    const d = alert.details || {}, ev = alert.evidence || {};
    let html = `<div class="nks-stat-row">
        ${_chip(d.attempts || 0, 'Attempts')}
        ${_chip(d.threshold || 0, 'Threshold')}
    </div>`;
    html += `<div class="nks-detail-section">
        <div class="nks-detail-label">Target</div>
        <div>${_ipLabel(d.src_ip)} <span class="text-secondary">→</span> ${_ipLabel(d.dst_ip)}:<strong>${d.dst_port || '?'}</strong>
            <span class="ms-1 text-secondary">(${escapeHtml(d.protocol || '')})</span>
        </div>
    </div>`;
    return html;
}

// ── CleartextCredentials ──────────────────────────────────────────────────────

function _credRows(item) {
    const rows = [];
    if (item.username != null) rows.push({ label: 'username', value: item.username, sensitive: false });
    if (item.password != null) rows.push({ label: 'password', value: item.password, sensitive: true });
    if (item.token_preview != null) rows.push({ label: 'token', value: item.token_preview, sensitive: true });
    if (item.field != null && item.value != null) {
        const isSensitive = /pass|pwd|secret|token|key/i.test(item.field);
        rows.push({ label: item.field, value: item.value, sensitive: isSensitive });
    }
    if (item.raw != null) rows.push({ label: 'raw', value: item.raw, sensitive: true });
    return rows.length ? rows : [{ label: '—', value: '—', sensitive: false }];
}

function _maskSecret(val) {
    if (!val || val.length <= 4) return '••••';
    return val.substring(0, 2) + '•'.repeat(Math.min(val.length - 2, 8));
}

function _toggleReveal(id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    const plain  = el.getAttribute('data-plain');
    const masked = el.getAttribute('data-masked');
    const showing = el.textContent.trim() === plain;
    el.textContent = showing ? masked : plain;
    btn.textContent = showing ? 'reveal' : 'hide';
}

function _renderCredentials(alert) {
    const d = alert.details || {};
    const captured = d.captured || [];
    let html = `<div class="nks-detail-section"><div>${_ipLabel(d.src_ip)} <span class="text-secondary">→</span> ${_ipLabel(d.dst_ip)}:<strong>${d.dst_port || '?'}</strong></div></div>`;
    if (!captured.length) return html;

    html += `<div class="nks-detail-section"><div class="nks-detail-label">Captured credentials</div>
        <table class="nks-cred-table"><thead><tr><th>Type</th><th>Field</th><th>Value</th></tr></thead><tbody>`;
    captured.forEach((item, i) => {
        const ctype = item.type || '';
        const rows  = _credRows(item);
        rows.forEach((row, j) => {
            const typeTd = j === 0 ? `<td rowspan="${rows.length}"><span class="nks-cred-type-badge">${escapeHtml(ctype)}</span></td>` : '';
            const masked = _maskSecret(String(row.value));
            const uid = `cv-${i}-${j}`;
            html += `<tr>${typeTd}<td class="text-secondary">${escapeHtml(row.label)}</td><td>
                <span class="nks-cred-value" data-plain="${escapeHtml(String(row.value))}" data-masked="${escapeHtml(masked)}" id="${uid}">
                    ${escapeHtml(row.sensitive ? masked : String(row.value))}
                </span>
                ${row.sensitive ? `<button class="nks-reveal-btn ms-1" onclick="event.stopPropagation();_toggleReveal('${uid}',this)">reveal</button>` : ''}
            </td></tr>`;
        });
    });
    html += `</tbody></table></div>`;
    html += _mitreHtml((alert.details || {}).mitre);
    return html;
}

// ── Beaconing ─────────────────────────────────────────────────────────────────

function _renderBeaconing(alert) {
    const d = alert.details || {}, ev = alert.evidence || {};
    const mean  = d.mean_interval_seconds || ev.mean_interval_seconds;
    const cv    = d.interval_cv           || ev.coefficient_of_variation;
    const count = d.connection_count      || ev.connection_count;

    let html = `<div class="nks-stat-row">
        ${_chip(count || '?', 'Connections')}
        ${_chip(mean != null ? mean + 's' : '—', 'Avg interval')}
        ${_chip(cv   != null ? cv.toFixed(2) : '—', 'CV (jitter)')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Beacon channel</div>
        <div>${_ipLabel(d.src_ip)} <span class="text-secondary">→</span> ${_ipLabel(d.dst_ip)}:<strong>${d.dst_port || '?'}</strong></div>
    </div>`;
    if (cv != null) {
        const cvPct = Math.min(cv * 100, 100);
        const barCol = cv < 0.15 ? 'var(--nks-high)' : cv < 0.25 ? 'var(--nks-medium)' : 'var(--nks-info)';
        html += `<div class="nks-detail-section"><div class="nks-detail-label">Regularity (lower = more clock-like)</div>
            <div style="display:flex;align-items:center;gap:0.5rem">
                <div style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
                    <div style="width:${cvPct}%;height:100%;background:${barCol};border-radius:3px"></div>
                </div>
                <span style="font-size:0.75rem;color:var(--nks-text-muted)">CV=${cv.toFixed(3)}</span>
            </div>
        </div>`;
    }
    html += _mitreHtml(d.mitre);
    return html;
}

// ── STUN / VPN Tunnel ─────────────────────────────────────────────────────────

function _renderStunTunnel(alert) {
    const d = alert.details || {}, ev = alert.evidence || {};
    let html = `<div class="nks-stat-row">
        ${_chip(d.stun_endpoint_count || 0, 'STUN endpoints')}
        ${_chip(ev.wireguard_data_plane_confirmed ? 'Yes' : 'No', 'WireGuard')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Participant</div><div>${_ipLabel(d.src_ip)}</div></div>`;
    const vpnPeers = d.vpn_data_plane_peers || ev.vpn_partners || [];
    if (vpnPeers.length) {
        html += `<div class="nks-detail-section"><div class="nks-detail-label">VPN data-plane peers</div><div class="nks-peer-list">
            ${vpnPeers.map(p => `<span class="nks-peer-badge">${escapeHtml(String(p))}</span>`).join('')}
        </div></div>`;
    }
    html += _mitreHtml(d.mitre);
    return html;
}

// ── SuspiciousDNS ─────────────────────────────────────────────────────────────

function _renderSuspiciousDns(alert) {
    const d = alert.details || {}, ev = alert.evidence || {};
    const suspCount = d.suspicious_domain_count || ev.suspicious_domain_count;
    const totalUniq = d.total_unique_domains    || ev.total_unique_domains;
    const ratio     = d.suspicious_ratio        || ev.suspicious_ratio;
    let html = '';
    if (suspCount != null) {
        html += `<div class="nks-stat-row">
            ${_chip(suspCount, 'Suspicious domains')}
            ${totalUniq != null ? _chip(totalUniq, 'Total unique') : ''}
            ${ratio != null ? _chip((ratio * 100).toFixed(0) + '%', 'Sus. ratio') : ''}
        </div>`;
    }
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Source</div><div>${_ipLabel(d.src_ip || ev.src_ip)}</div></div>`;
    const domains = d.sample_domains || ev.sample_domains || [];
    if (domains.length) {
        html += `<div class="nks-detail-section"><div class="nks-detail-label">Sample suspicious domains</div>`;
        domains.forEach(dom => {
            html += `<div class="nks-domain-row"><span class="nks-domain-name">${escapeHtml(String(dom))}</span><span class="nks-domain-sus">DGA</span></div>`;
        });
        html += '</div>';
    }
    html += _mitreHtml(d.mitre);
    return html;
}

// ── DataExfiltration ──────────────────────────────────────────────────────────

function _renderDataExfil(alert) {
    const d = alert.details || {}, ev = alert.evidence || {};
    const sent = d.bytes_sent || 0, recv = d.bytes_received || 0;
    let html = `<div class="nks-stat-row">
        ${_chip(formatBytes(sent), 'Sent')}
        ${_chip(formatBytes(recv), 'Received')}
        ${ev.sent_over_received_ratio != null ? _chip(ev.sent_over_received_ratio.toFixed(1) + '×', 'Ratio') : ''}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Host</div><div>${_ipLabel(d.ip || ev.src_ip)}</div></div>`;
    const dests = d.top_destinations || [];
    if (dests.length) {
        const maxB = Math.max(...dests.map(x => x.bytes || 0), 1);
        html += `<div class="nks-detail-section"><div class="nks-detail-label">Top destinations</div>`;
        dests.forEach(dest => {
            const pct   = ((dest.bytes || 0) / maxB * 100).toFixed(0);
            const label = dest.hostname ? `${dest.ip} <span class="nks-hostname">(${escapeHtml(dest.hostname)})</span>` : escapeHtml(dest.ip || '?');
            html += `<div class="nks-dest-row">
                <span class="nks-dest-ip">${label}</span>
                <div class="nks-dest-bar-wrap"><div class="nks-dest-bar" style="width:${pct}%"></div></div>
                <span class="nks-dest-bytes">${formatBytes(dest.bytes || 0)}</span>
            </div>`;
        });
        html += '</div>';
    }
    return html;
}

// ── Correlation / attack chain ────────────────────────────────────────────────

const _CORR_META = {
    ActiveExfiltration:       { icon: 'bi-cloud-upload',     label: 'Active Exfiltration',      color: 'var(--nks-critical)' },
    FullAttackChain:          { icon: 'bi-diagram-3',         label: 'Full Attack Chain',         color: 'var(--nks-critical)' },
    PossibleCompromise:       { icon: 'bi-person-x',          label: 'Possible Compromise',       color: 'var(--nks-critical)' },
    ActiveIntrusion:          { icon: 'bi-door-open',         label: 'Active Intrusion',          color: 'var(--nks-high)' },
    EncryptedC2:              { icon: 'bi-lock',              label: 'Encrypted C2',              color: 'var(--nks-high)' },
    DnsTunneling:             { icon: 'bi-arrow-left-right',  label: 'DNS Tunneling',             color: 'var(--nks-high)' },
    LateralMovementCampaign:  { icon: 'bi-shuffle',           label: 'Lateral Movement',          color: 'var(--nks-high)' },
    C2Evasion:                { icon: 'bi-eye-slash',         label: 'C2 with Evasion',           color: 'var(--nks-high)' },
    NetworkMitm:              { icon: 'bi-people',            label: 'Network MITM',              color: 'var(--nks-high)' },
    AggressiveRecon:          { icon: 'bi-binoculars',        label: 'Aggressive Recon',          color: 'var(--nks-medium)' },
    MultiVectorRecon:         { icon: 'bi-radar',             label: 'Multi-Vector Recon',        color: 'var(--nks-medium)' },
    Correlation:              { icon: 'bi-link-45deg',        label: 'Correlated Finding',        color: 'var(--nks-high)' },
};

function _renderCorrelation(alert) {
    const d = alert.details || {}, ev = alert.evidence || {};
    const cat  = alert.category || 'Correlation';
    const meta = _CORR_META[cat] || _CORR_META['Correlation'];
    let html = `<div class="nks-stat-row">
        ${_chip(`<i class="bi ${meta.icon}" style="color:${meta.color}"></i> ${escapeHtml(meta.label)}`, 'Pattern')}
        ${_chip(d.alert_count || '?', 'Contributing alerts')}
        ${alert.confidence != null ? _chip((alert.confidence * 100).toFixed(0) + '%', 'Confidence') : ''}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Source host</div><div>${_ipLabel(d.src_ip || ev.src_ip)}</div></div>`;
    const cats = d.contributing_categories || ev.matched_categories || d.correlated_categories || d.chain || [];
    if (cats.length) {
        html += `<div class="nks-detail-section"><div class="nks-detail-label">Matched rules</div><div class="nks-chain">`;
        cats.forEach((c, i) => {
            html += `<span class="nks-chain-step">${escapeHtml(String(c))}</span>`;
            if (i < cats.length - 1) html += `<span class="nks-chain-arrow">+</span>`;
        });
        html += '</div></div>';
    }
    html += _mitreHtml(d.mitre);
    return html;
}

// ── HttpAnomaly ───────────────────────────────────────────────────────────────

function _renderHttpAnomaly(alert) {
    const d = alert.details || {};
    const patLabels = {
        auth:     { icon: 'bi-shield-x',         label: 'Auth failures (401/403)', color: 'var(--nks-high)' },
        notfound: { icon: 'bi-search',            label: 'Path scanning (404)',     color: 'var(--nks-medium)' },
        error:    { icon: 'bi-exclamation-octagon', label: 'Server errors (5xx)',   color: 'var(--nks-high)' },
    };
    const pat = patLabels[d.pattern] || { icon: 'bi-bar-chart', label: d.pattern || 'HTTP', color: 'var(--nks-accent)' };
    let html = `<div class="nks-stat-row">
        ${_chip(`<i class="bi ${pat.icon}" style="color:${pat.color}"></i> ${escapeHtml(pat.label)}`, 'Pattern')}
        ${_chip(d.response_count || 0, 'Responses')}
        ${_chip(d.threshold || 0, 'Threshold')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Attacker → Target</div>
        <div>${_ipLabel(d.src_ip)} <span class="text-secondary">→</span> ${_ipLabel(d.dst_ip)}:<strong>${d.dst_port || '?'}</strong></div>
    </div>`;
    html += _mitreHtml(d.mitre);
    return html;
}

// ── LargeFlow ─────────────────────────────────────────────────────────────────

function _renderLargeFlow(alert) {
    const d = alert.details || {}, ev = alert.evidence || {};
    const mb = d.bytes_total ? (d.bytes_total / (1024 * 1024)).toFixed(1) : '?';
    let html = `<div class="nks-stat-row">
        ${_chip(mb + ' MB', 'Flow size')}
        ${_chip(formatBytes(ev.threshold_bytes || 0), 'Threshold')}
        ${_chip(escapeHtml(d.protocol || '?'), 'Protocol')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Transfer</div>
        <div>${_ipLabel(d.src_ip)} <span class="text-secondary">→</span> ${_ipLabel(d.dst_ip)}:<strong>${d.dst_port || '?'}</strong></div>
    </div>`;
    html += _mitreHtml(d.mitre);
    return html;
}

// ── TlsAnomaly ────────────────────────────────────────────────────────────────

function _renderTlsAnomaly(alert) {
    const d = alert.details || {};
    const typeLabels = {
        ip_as_sni:          { icon: 'bi-incognito',       label: 'IP-as-SNI',          color: 'var(--nks-high)' },
        hidden_service_tld: { icon: 'bi-eye-slash',       label: 'Hidden-service TLD', color: 'var(--nks-high)' },
        dga_like_sni:       { icon: 'bi-robot',           label: 'DGA-like SNI',        color: 'var(--nks-medium)' },
        no_sni_on_443:      { icon: 'bi-question-circle', label: 'No SNI on 443',       color: 'var(--nks-low)' },
    };
    const t  = typeLabels[d.anomaly_type] || { icon: 'bi-shield-exclamation', label: d.anomaly_type || 'TLS', color: 'var(--nks-accent)' };
    let html = `<div class="nks-stat-row">
        ${_chip(`<i class="bi ${t.icon}" style="color:${t.color}"></i> ${escapeHtml(t.label)}`, 'Anomaly type')}
        ${_chip(d.count || 0, 'Flows')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Source</div><div>${_ipLabel(d.src_ip)}</div></div>`;
    const samples = d.samples || [];
    if (samples.length) {
        html += `<div class="nks-detail-section"><div class="nks-detail-label">Sample connections</div>`;
        samples.forEach(s => {
            const sniPart   = s.sni ? ` SNI: <code class="nks-code">${escapeHtml(s.sni)}</code>` : '';
            html += `<div class="nks-domain-row"><span style="font-size:0.78rem">${_ipLabel(s.dst_ip)}:<strong>${s.dst_port || '?'}</strong>${sniPart}</span></div>`;
        });
        html += '</div>';
    }
    return html;
}

// ── ArpSpoofing ───────────────────────────────────────────────────────────────

function _renderArpSpoofing(alert) {
    const d = alert.details || {};
    let html = '';
    if (d.target_ip) {
        html += `<div class="nks-stat-row">
            ${_chip(escapeHtml(d.target_ip), 'Target IP')}
            ${d.mac_count != null ? _chip(d.mac_count, 'Conflicting MACs') : ''}
        </div>`;
        const macs = d.macs || [];
        if (macs.length) {
            const legitMac = d.legitimate_mac || '', suspectMac = d.suspect_mac || '';
            html += `<div class="nks-detail-section"><div class="nks-detail-label">MAC addresses</div><div class="nks-peer-list">`;
            macs.forEach(mac => {
                const isSuspect = mac === suspectMac, isLegit = mac === legitMac;
                const style = isSuspect ? 'background:rgba(248,81,73,0.12);color:var(--nks-high);border-color:rgba(248,81,73,0.25)'
                            : isLegit   ? 'background:rgba(63,185,80,0.1);color:var(--nks-info);border-color:rgba(63,185,80,0.2)' : '';
                const badge = isSuspect ? ' ⚠ suspect' : isLegit ? ' ✓ likely legit' : '';
                html += `<span class="nks-peer-badge" style="${style}"><code class="nks-code" style="background:none;border:none;padding:0">${escapeHtml(mac)}</code>${badge}</span>`;
            });
            html += '</div></div>';
        }
    }
    return html;
}

// ── IcmpTunnel ────────────────────────────────────────────────────────────────

function _renderIcmpTunnel(alert) {
    const d = alert.details || {};
    const isOversized = d.pattern === 'oversized_payload';
    let html = `<div class="nks-stat-row">
        ${isOversized ? _chip((d.max_payload_bytes || '?') + ' bytes', 'Max payload') : _chip(formatBytes(d.total_bytes || 0), 'Total ICMP data')}
        ${_chip(isOversized ? 'Oversized payload' : 'High volume', 'Pattern')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Host pair</div>
        <div>${_ipLabel(d.src_ip)} <span class="text-secondary">↔</span> ${_ipLabel(d.dst_ip)}</div>
    </div>`;
    return html;
}

// ── DohBypass ─────────────────────────────────────────────────────────────────

function _renderDohBypass(alert) {
    const d = alert.details || {};
    let html = `<div class="nks-stat-row">
        ${_chip(d.total_flows || 0, 'DoH flows')}
        ${_chip((d.providers || []).length, 'Providers')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Source</div><div>${_ipLabel(d.src_ip)}</div></div>`;
    const resolvers = d.resolvers || [];
    if (resolvers.length) {
        html += `<div class="nks-detail-section"><div class="nks-detail-label">DoH resolvers</div>`;
        resolvers.forEach(r => {
            html += `<div style="font-size:0.82rem;margin-bottom:0.2rem">
                <code class="nks-code">${escapeHtml(r.ip)}</code>
                <span class="text-secondary ms-2">${escapeHtml(r.provider)}</span>
                <span class="nks-filter-pill ms-2">${r.flows} flow${r.flows !== 1 ? 's' : ''}</span>
            </div>`;
        });
        html += '</div>';
    }
    return html;
}

// ── SmbLateral ────────────────────────────────────────────────────────────────

function _renderSmbLateral(alert) {
    const d = alert.details || {};
    let html = `<div class="nks-stat-row">
        ${_chip(d.unique_hosts || 0, 'Internal hosts')}
        ${_chip(d.threshold || 0, 'Threshold')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Source (lateral mover)</div><div>${_ipLabel(d.src_ip)}</div></div>`;
    const targets = d.sample_targets || [];
    if (targets.length) {
        html += `<div class="nks-detail-section"><div class="nks-detail-label">Sample targets</div><div class="nks-port-grid">`;
        targets.forEach(ip => { html += `<span class="nks-port-badge">${escapeHtml(ip)}</span>`; });
        html += '</div></div>';
    }
    return html;
}

// ── RdpBrute ─────────────────────────────────────────────────────────────────

function _renderRdpBrute(alert) {
    const d = alert.details || {};
    let html = `<div class="nks-stat-row">
        ${_chip(d.attempts || 0, 'Attempts')}
        ${_chip(d.threshold || 0, 'Threshold')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Attacker → Target</div>
        <div>${_ipLabel(d.src_ip)} <span class="text-secondary">→</span> ${_ipLabel(d.dst_ip)}<span class="text-secondary">:3389</span></div>
    </div>`;
    return html;
}

// ── PingSweep ────────────────────────────────────────────────────────────────

function _renderPingSweep(alert) {
    const d = alert.details || {};
    let html = `<div class="nks-stat-row">
        ${_chip(d.unique_hosts || 0, 'Hosts swept')}
        ${_chip(d.threshold || 0, 'Threshold')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Source</div><div>${_ipLabel(d.src_ip)}</div></div>`;
    const targets = d.sample_targets || [];
    if (targets.length) {
        html += `<div class="nks-detail-section"><div class="nks-detail-label">Sample targets</div><div class="nks-port-grid">`;
        targets.forEach(ip => { html += `<span class="nks-port-badge">${escapeHtml(ip)}</span>`; });
        html += '</div></div>';
    }
    return html;
}

// ── LlmnrPoisoning ───────────────────────────────────────────────────────────

function _renderLlmnrPoisoning(alert) {
    const d = alert.details || {};
    let html = `<div class="nks-stat-row">
        ${_chip(d.peer_count || 0, 'Peers poisoned')}
        ${_chip(d.protocol || '?', 'Protocol')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Suspected poisoner</div><div>${_ipLabel(d.src_ip)}</div></div>`;
    return html;
}

// ── TorTraffic ───────────────────────────────────────────────────────────────

function _renderTorTraffic(alert) {
    const d = alert.details || {};
    let html = `<div class="nks-stat-row">
        ${_chip(d.total_flows || 0, 'Tor flows')}
        ${_chip(d.unique_peers || 0, 'Unique peers')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Host</div><div>${_ipLabel(d.src_ip)}</div></div>`;
    const ports = d.ports || {};
    const portKeys = Object.keys(ports);
    if (portKeys.length) {
        const TOR_NAMES = { 9001: 'ORPort', 9030: 'DirPort', 9050: 'SOCKS', 9051: 'Control', 9150: 'Browser' };
        html += `<div class="nks-detail-section"><div class="nks-detail-label">Tor ports</div><div class="nks-port-grid">`;
        portKeys.sort().forEach(p => {
            const name = TOR_NAMES[p] ? ` (${TOR_NAMES[p]})` : '';
            html += `<span class="nks-port-badge">${p}${name} — ${(ports[p].flows || 0)} flows</span>`;
        });
        html += '</div></div>';
    }
    return html;
}

// ── LargeDnsFlow ─────────────────────────────────────────────────────────────

function _renderLargeDnsFlow(alert) {
    const d = alert.details || {};
    let html = `<div class="nks-stat-row">
        ${_chip(formatBytes(d.max_flow_bytes || 0), 'Max flow')}
        ${_chip(d.flow_count || 0, 'Oversized flows')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Client → DNS server</div>
        <div>${_ipLabel(d.src_ip)} <span class="text-secondary">→</span> ${_ipLabel(d.dst_ip)}</div>
    </div>`;
    return html;
}

// ── SshSpray ─────────────────────────────────────────────────────────────────

function _renderSshSpray(alert) {
    const d = alert.details || {};
    let html = `<div class="nks-stat-row">
        ${_chip(d.unique_destinations || 0, 'External SSH hosts')}
        ${_chip(d.threshold || 0, 'Threshold')}
    </div>`;
    html += `<div class="nks-detail-section"><div class="nks-detail-label">Source</div><div>${_ipLabel(d.src_ip)}</div></div>`;
    const targets = d.sample_targets || [];
    if (targets.length) {
        html += `<div class="nks-detail-section"><div class="nks-detail-label">Sample targets</div><div class="nks-port-grid">`;
        targets.forEach(ip => { html += `<span class="nks-port-badge">${escapeHtml(ip)}</span>`; });
        html += '</div></div>';
    }
    return html;
}

// ── Default fallback ──────────────────────────────────────────────────────────

function _renderDefault(alert) {
    const d = alert.details || {}, ev = alert.evidence;
    let html = '';
    if (d.src_ip || d.dst_ip) {
        html += '<div class="nks-detail-section">';
        if (d.src_ip) html += `<div><span class="text-secondary" style="font-size:0.72rem">SRC</span> ${_ipLabel(d.src_ip)}</div>`;
        if (d.dst_ip) {
            const dest = d.dst_port ? `${_ipLabel(d.dst_ip)}:<strong>${d.dst_port}</strong>` : _ipLabel(d.dst_ip);
            html += `<div><span class="text-secondary" style="font-size:0.72rem">DST</span> ${dest}</div>`;
        }
        html += '</div>';
    }
    if (ev && Object.keys(ev).length) {
        html += '<div class="nks-detail-section"><div class="nks-detail-label">Evidence</div>';
        for (const [k, v] of Object.entries(ev)) {
            const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
            html += `<div class="nks-evidence-row">
                <span class="nks-evidence-key">${escapeHtml(k)}</span>
                <span class="nks-evidence-val">${escapeHtml(val)}</span>
            </div>`;
        }
        html += '</div>';
    }
    html += _mitreHtml(d.mitre);
    return html;
}

// ─── Remediation tips ─────────────────────────────────────────────────────────

const _REMEDIATION = {
    PortScan: 'Identify the scanning host and determine if authorized. If unauthorized, block at firewall. Review exposed services.',
    BruteForce: 'Review auth logs for successful logins. Enable account lockout. Block source IP. Rotate credentials on the targeted service.',
    CleartextCredentials: 'Upgrade to encrypted protocols (HTTPS, SFTP, SSH). Rotate any exposed credentials immediately.',
    Beaconing: 'ISOLATE the host immediately — strong C2 indicator. Investigate processes, scheduled tasks, startup items. Capture memory for forensics.',
    DataExfiltration: 'Isolate the host. Identify what data was sent. Review DLP policies and outbound firewall rules. Engage incident response.',
    SuspiciousDNS: 'Investigate DNS queries from this host. Block external DNS resolvers. Enforce DNS through an internal resolver with logging.',
    TlsAnomaly: 'Investigate connections with IP-as-SNI or missing SNI — common C2 indicators. Block at perimeter if unexpected.',
    ArpSpoofing: 'Investigate for MITM attacks. Implement Dynamic ARP Inspection on managed switches. Rotate credentials on affected segment.',
    IcmpTunnel: 'Block unusual ICMP payload sizes at perimeter. Investigate host pair for data exfiltration.',
    DohBypass: 'Block known DoH resolver IPs at perimeter. Enforce DNS through a monitored resolver.',
    SmbLateral: 'ISOLATE the spreading host — consistent with ransomware/worms. Review SMB shares and access controls.',
    RdpBrute: 'Block the attacking IP. Enable NLA on RDP. Move RDP behind a VPN or change port.',
    PingSweep: 'Block ICMP from untrusted sources. Investigate the host for recon tooling.',
    LlmnrPoisoning: 'Disable LLMNR/NBT-NS via Group Policy. Rotate passwords for all users on the affected segment.',
    TorTraffic: 'Block Tor entry nodes and ports (9001, 9030, 9050) if Tor is not authorized.',
    LargeDnsFlow: 'Inspect DNS traffic for encoded data. Block large DNS responses from untrusted resolvers.',
    StunTunnel: 'Investigate whether VPN/P2P usage is authorized. Block STUN (UDP:3478) and WireGuard traffic if not.',
    HttpAnomaly: 'Review web server logs. Implement WAF rules. Block source IP if unauthorized.',
    LargeFlow: 'Determine if this transfer is authorized (backup, update). Review firewall logs.',
    ActiveExfiltration: 'CRITICAL: Isolate all involved hosts immediately. Preserve evidence. Engage incident response.',
    FullAttackChain: 'CRITICAL: Full breach detected. Isolate ALL involved hosts. Engage incident response immediately.',
    PossibleCompromise: 'HIGH: Possible compromise. Isolate host. Review for persistence. Reset all credentials.',
    ActiveIntrusion: 'HIGH: Active intrusion. Block source IP immediately. Patch targeted services.',
    EncryptedC2: 'HIGH: Encrypted C2 channel suspected. Isolate beaconing host. Inspect all outbound TLS.',
    DnsTunneling: 'HIGH: DNS-based exfiltration or C2. Sinkhole involved domains. Isolate the querying host.',
    LateralMovementCampaign: 'HIGH: Active lateral movement. Isolate all involved hosts. Change all domain credentials.',
    C2Evasion: 'HIGH: C2 with active evasion. Isolate the host — treat as confirmed infection.',
    NetworkMitm: 'HIGH: MITM attack in progress. Rotate ALL credentials on affected segment. Remove the rogue device.',
    AggressiveRecon: 'Block the scanning host. Review firewall rules. Limit internal reconnaissance reach.',
    MultiVectorRecon: 'Block the source host. This host has performed multi-type scanning — active network mapping.',
};

function _remediationHtml(category) {
    const tip = _REMEDIATION[category];
    if (!tip) return '';
    const isCritical = ['ActiveExfiltration', 'FullAttackChain', 'PossibleCompromise'].includes(category);
    const isHigh = ['EncryptedC2', 'DnsTunneling', 'LateralMovementCampaign', 'C2Evasion', 'NetworkMitm', 'ActiveIntrusion'].includes(category);
    const color = isCritical ? 'var(--nks-critical)' : isHigh ? 'var(--nks-high)' : 'var(--nks-medium)';
    return `<div class="nks-detail-section nks-remediation-section" style="border-left:3px solid ${color};padding-left:0.6rem;margin-top:0.5rem">
        <div class="nks-detail-label" style="color:${color}"><i class="bi bi-shield-exclamation"></i> Recommended Action</div>
        <div style="font-size:0.8rem;line-height:1.5">${escapeHtml(tip)}</div>
    </div>`;
}

// ─── Export ───────────────────────────────────────────────────────────────────

function initExportButtons(data) {
    const jsonBtn = document.getElementById('export-json-btn');
    if (jsonBtn) {
        jsonBtn.onclick = () => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = (data.filename || data.id || 'nks0-results') + '.json';
            a.click();
            URL.revokeObjectURL(url);
        };
    }

    const csvBtn = document.getElementById('export-csv-btn');
    if (csvBtn) {
        csvBtn.onclick = () => exportCsv(data.filename || data.id || 'nks0');
    }
}

function exportCsv(baseName) {
    if (!_allAlerts.length) return;
    const ESC = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Severity', 'Category', 'Confidence', 'Message', 'Source IP', 'Destination IP', 'First Seen', 'Tags']];
    _allAlerts.forEach(a => {
        const d = a.details || {};
        rows.push([
            ESC(a.severity),
            ESC(a.category),
            a.confidence != null ? (a.confidence * 100).toFixed(0) + '%' : '',
            ESC(a.message),
            ESC(d.src_ip || d.ip || ''),
            ESC(d.dst_ip || ''),
            a.first_seen ? new Date(a.first_seen * 1000).toISOString() : '',
            ESC((a.tags || []).join('; ')),
        ]);
    });
    const csv  = rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = baseName + '_alerts.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Protocol chart (horizontal bar) ─────────────────────────────────────────

let _protocolChart = null;

function renderProtocolChart(protocolBytes) {
    const canvas = document.getElementById('protocol-chart');
    if (!canvas) return;

    const entries = Object.entries(protocolBytes).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!entries.length) {
        canvas.parentElement.innerHTML = '<p class="text-secondary text-center small py-3">No protocol data</p>';
        return;
    }

    const colors = ['#58a6ff','#f85149','#d29922','#3fb950','#bc8cff','#f778ba','#79c0ff','#56d364','#ffa657','#8b949e'];
    if (_protocolChart) { _protocolChart.destroy(); _protocolChart = null; }

    canvas.style.height = Math.max(120, entries.length * 26) + 'px';

    _protocolChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: entries.map(e => e[0]),
            datasets: [{ data: entries.map(e => e[1]), backgroundColor: colors.slice(0, entries.length), borderWidth: 0, borderRadius: 3 }],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${formatBytes(ctx.raw)}` } },
            },
            scales: {
                x: { grid: { color: '#21262d' }, ticks: { color: '#8b949e', font: { size: 10 }, callback: v => formatBytes(v) } },
                y: { grid: { display: false }, ticks: { color: '#8b949e', font: { size: 11 } } },
            },
        },
    });
}

// ─── Severity bar chart ───────────────────────────────────────────────────────

let _severityChart = null;

function renderSeverityChart(counts) {
    const canvas = document.getElementById('severity-chart');
    if (!canvas) return;
    const labels = ['Critical', 'High', 'Medium', 'Low', 'Info'];
    const values = labels.map(s => counts[s] || 0);
    const colors = ['#ff6e40', '#f85149', '#d29922', '#58a6ff', '#3fb950'];
    if (_severityChart) { _severityChart.destroy(); _severityChart = null; }
    _severityChart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, borderRadius: 4 }] },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#21262d' }, ticks: { color: '#8b949e', font: { size: 11 } } },
                y: { grid: { color: '#21262d' }, ticks: { color: '#8b949e', font: { size: 11 }, precision: 0 }, beginAtZero: true },
            },
        },
    });
}

// ─── Hosts table ──────────────────────────────────────────────────────────────

function renderHostsTable(talkers) {
    const tbody = document.getElementById('hosts-table-body');
    if (!tbody) return;
    if (!talkers.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary">No hosts</td></tr>';
        return;
    }

    const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Info'];
    const SEV_COLOR = { Critical: 'var(--nks-critical)', High: 'var(--nks-high)', Medium: 'var(--nks-medium)', Low: 'var(--nks-low)', Info: 'var(--nks-info)' };
    const alertsByIp = {};
    (_allAlerts || []).forEach(a => {
        [(a.details || {}).src_ip, (a.details || {}).dst_ip].forEach(ip => {
            if (!ip) return;
            if (!alertsByIp[ip]) alertsByIp[ip] = { count: 0, worst: null };
            alertsByIp[ip].count++;
            const cur = alertsByIp[ip].worst;
            if (!cur || SEV_ORDER.indexOf(a.severity) < SEV_ORDER.indexOf(cur)) alertsByIp[ip].worst = a.severity;
        });
    });

    const ipv4 = talkers.filter(h => !h.ip.includes(':'));
    const ipv6 = talkers.filter(h =>  h.ip.includes(':'));

    const rowHtml = h => {
        const hnPart = h.hostname ? ` <span class="nks-hostname">(${escapeHtml(h.hostname)})</span>` : '';
        let geoPart = '';
        if (h.country) {
            const flag  = _flagEmoji(h.country);
            geoPart += `<span class="nks-geo-badge" title="${escapeHtml([h.city, h.country_name || h.country].filter(Boolean).join(', '))}">${flag} ${escapeHtml(h.country_name || h.country)}</span>`;
        }
        const alertInfo = alertsByIp[h.ip];
        const alertCell = alertInfo
            ? `<span class="badge" style="background:${SEV_COLOR[alertInfo.worst] || '#666'};font-size:0.7rem">${alertInfo.count}</span>`
            : `<span class="text-secondary" style="font-size:0.75rem">—</span>`;
        return `<tr>
            <td>
                <div>${escapeHtml(h.ip)}${hnPart}</div>
                ${geoPart ? `<div style="margin-top:2px">${geoPart}</div>` : ''}
            </td>
            <td class="text-end">${formatBytes(h.bytes_sent)}</td>
            <td class="text-end">${formatBytes(h.bytes_received)}</td>
            <td class="text-end d-none d-sm-table-cell">${alertCell}</td>
        </tr>`;
    };

    let html = ipv4.map(rowHtml).join('');
    if (ipv6.length) {
        html += `<tr id="ipv6-toggle-row" onclick="toggleIpv6Rows()" style="cursor:pointer">
            <td colspan="4" class="text-secondary" style="font-size:0.75rem;padding:0.3rem 0.75rem">
                <i class="bi bi-chevron-right" id="ipv6-chevron" style="font-size:0.65rem"></i>
                ${ipv6.length} IPv6 host${ipv6.length > 1 ? 's' : ''} (click to expand)
            </td>
        </tr>
        <tbody id="ipv6-rows" style="display:none">${ipv6.map(rowHtml).join('')}</tbody>`;
    }
    tbody.innerHTML = html;
}

function toggleIpv6Rows() {
    const rows    = document.getElementById('ipv6-rows');
    const chevron = document.getElementById('ipv6-chevron');
    if (!rows) return;
    const hidden = rows.style.display === 'none';
    rows.style.display = hidden ? '' : 'none';
    if (chevron) chevron.className = `bi bi-chevron-${hidden ? 'down' : 'right'}`;
}

// ─── Alert timeline (SVG) ─────────────────────────────────────────────────────

function renderTimeline(alerts) {
    const panel = document.getElementById('timeline-panel');
    if (!panel) return;

    const timed = alerts.filter(a => a.first_seen && a.first_seen > 0);
    if (timed.length < 2) { panel.classList.add('d-none'); return; }
    panel.classList.remove('d-none');

    const LANES    = ['critical', 'high', 'medium', 'low', 'info'];
    const sevColor = { critical: '#ff7b72', high: '#f85149', medium: '#d29922', low: '#58a6ff', info: '#8b949e' };
    const usedLanes = LANES.filter(lane => timed.some(a => sevClass(a.severity) === lane));

    const tsMin = Math.min(...timed.map(a => a.first_seen));
    const tsMax = Math.max(...timed.map(a => a.last_seen || a.first_seen));
    const tspan = tsMax - tsMin || 1;

    const rangeEl = document.getElementById('timeline-range');
    if (rangeEl) rangeEl.textContent = `${formatTs(tsMin)} — ${formatDuration(tspan)}`;

    const svgEl = document.getElementById('timeline-svg');
    if (!svgEl) return;

    const LANE_H = 36, LABEL_W = 58, PAD_R = 12, PAD_T = 4, PAD_B = 4;
    const W      = svgEl.getBoundingClientRect().width || 700;
    const DRAW_W = W - LABEL_W - PAD_R;
    const HEIGHT = PAD_T + usedLanes.length * LANE_H + PAD_B + 12;

    const xOf = ts  => LABEL_W + ((ts - tsMin) / tspan) * DRAW_W;
    const yOf = sev => {
        const idx = usedLanes.indexOf(sevClass(sev));
        return PAD_T + (idx === -1 ? usedLanes.length - 1 : idx) * LANE_H + LANE_H / 2;
    };

    const lineCol = 'rgba(255,255,255,0.05)', tickCol = 'rgba(255,255,255,0.25)';
    let svgContent = '';

    usedLanes.forEach((lane, i) => {
        const y = PAD_T + i * LANE_H + LANE_H / 2;
        svgContent += `<line x1="${LABEL_W}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="${lineCol}" stroke-width="1"/>`;
        svgContent += `<text x="${LABEL_W - 5}" y="${y + 4}" text-anchor="end" font-size="9"
            fill="${sevColor[lane]}" font-family="-apple-system,sans-serif" font-weight="600">${lane}</text>`;
    });

    const axisY = PAD_T + usedLanes.length * LANE_H + 2;
    svgContent += `<text x="${LABEL_W}" y="${axisY + 10}" font-size="8" fill="${tickCol}" font-family="-apple-system,sans-serif">${escapeHtml(formatTs(tsMin) || '')}</text>`;
    svgContent += `<text x="${W - PAD_R}" y="${axisY + 10}" text-anchor="end" font-size="8" fill="${tickCol}" font-family="-apple-system,sans-serif">${escapeHtml(formatTs(tsMax) || '')}</text>`;

    const BUCKET_PX = 10;
    const bucketGroups = {};
    timed.forEach((alert, i) => {
        const lane = sevClass(alert.severity);
        const bx   = Math.round(xOf(alert.first_seen) / BUCKET_PX);
        const key  = `${lane}|${bx}`;
        (bucketGroups[key] = bucketGroups[key] || []).push(i);
    });

    timed.forEach((alert, i) => {
        const x1 = xOf(alert.first_seen), x2 = xOf(alert.last_seen || alert.first_seen);
        const baseCy = yOf(alert.severity);
        const col    = sevColor[sevClass(alert.severity)] || '#8b949e';
        const tip    = escapeHtml(`${alert.category} — ${(alert.message || '').substring(0, 80)}`);
        const lane   = sevClass(alert.severity);
        const bx     = Math.round(x1 / BUCKET_PX);
        const group  = bucketGroups[`${lane}|${bx}`];
        const pos    = group.indexOf(i);
        const n      = group.length;
        const spread = Math.min(n - 1, 5) * 5;
        const cy     = n > 1 ? baseCy + ((pos / (n - 1)) - 0.5) * spread : baseCy;

        if (x2 - x1 > 2) {
            svgContent += `<rect x="${x1.toFixed(1)}" y="${(cy - 2).toFixed(1)}" width="${(x2 - x1).toFixed(1)}" height="4" fill="${col}" opacity="0.25" rx="2"/>`;
        }
        svgContent += `<circle cx="${x1.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="${col}" opacity="0.85"
            style="cursor:pointer" onclick="scrollToAlert(${i})" title="${tip}"/>`;
    });

    svgEl.setAttribute('height', HEIGHT);
    svgEl.innerHTML = svgContent;
}

// ─── Network graph (canvas bipartite) ─────────────────────────────────────────

function renderNetworkGraph(connections, alerts, talkers) {
    const panel     = document.getElementById('graph-panel');
    const canvas    = document.getElementById('network-graph');
    const container = document.getElementById('network-graph-container');
    if (!panel || !canvas || !container) return;
    if (!connections || !connections.length) { panel.classList.add('d-none'); return; }
    panel.classList.remove('d-none');
    void panel.offsetHeight; // force synchronous reflow so clientWidth is correct

    const alertIpSev = {};
    const SEV_RANK   = { Critical: 5, High: 4, Medium: 3, Low: 2, Info: 1 };
    alerts.forEach(a => {
        const d = a.details || {};
        [d.src_ip, d.dst_ip, d.target_ip].filter(Boolean).forEach(ip => {
            if (!alertIpSev[ip] || SEV_RANK[a.severity] > SEV_RANK[alertIpSev[ip]]) alertIpSev[ip] = a.severity;
        });
    });

    const nodeSet  = new Set(connections.flatMap(c => [c.src, c.dst]));
    const countEl  = document.getElementById('graph-node-count');
    if (countEl) countEl.textContent = `${nodeSet.size} hosts · ${connections.length} flows`;

    const topConns = [...connections].sort((a, b) => b.bytes - a.bytes).slice(0, 18);
    const srcBytes = {}, dstBytes = {};
    topConns.forEach(c => {
        srcBytes[c.src] = (srcBytes[c.src] || 0) + c.bytes;
        dstBytes[c.dst] = (dstBytes[c.dst] || 0) + c.bytes;
    });
    const srcList = Object.keys(srcBytes).sort((a, b) => srcBytes[b] - srcBytes[a]);
    const dstList = Object.keys(dstBytes).sort((a, b) => dstBytes[b] - dstBytes[a]);

    const textCol   = '#c9d1d9', mutedCol = '#8b949e';
    const SEV_FILL  = { Critical: '#ff6e40', High: '#f85149', Medium: '#d29922', Low: '#58a6ff', Info: '#3fb950' };
    const DEF_FILL  = '#4d5562';
    const NODE_R    = 6, LANE_PAD = 55;
    const W         = canvas.parentElement.clientWidth
                      || canvas.closest('.col-12')?.clientWidth
                      || canvas.closest('.card-body')?.clientWidth
                      || (window.innerWidth - 40);
    const ROWS      = Math.max(srcList.length, dstList.length);
    const ROW_H     = Math.max(22, Math.min(32, (280 - 30) / Math.max(ROWS, 1)));
    const H         = Math.max(80, 30 + ROWS * ROW_H + 10);

    canvas.width = W; canvas.height = H; canvas.style.height = H + 'px';

    const SRC_X = LANE_PAD, DST_X = W - LANE_PAD;
    const yOf = (list, i) => 26 + (i + 0.5) * ((H - 36) / list.length);
    const srcPos = {}, dstPos = {};
    srcList.forEach((ip, i) => { srcPos[ip] = { x: SRC_X, y: yOf(srcList, i), ip, side: 'src' }; });
    dstList.forEach((ip, i) => { dstPos[ip] = { x: DST_X, y: yOf(dstList, i), ip, side: 'dst' }; });
    const allNodes = [...Object.values(srcPos), ...Object.values(dstPos)];
    const maxBytes = Math.max(...topConns.map(c => c.bytes), 1);
    let _hovered = null;

    function _drawGraph() {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        ctx.font = `bold 8px -apple-system, sans-serif`;
        ctx.fillStyle = mutedCol;
        ctx.textAlign = 'center';
        ctx.fillText('SOURCE', SRC_X, 11);
        ctx.fillText('DESTINATION', DST_X, 11);

        topConns.forEach(c => {
            const a = srcPos[c.src], b = dstPos[c.dst];
            if (!a || !b) return;
            const isHov = _hovered && (_hovered.ip === c.src || _hovered.ip === c.dst);
            if (isHov) return;
            const alpha = 0.12 + (c.bytes / maxBytes) * 0.35;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.bezierCurveTo(a.x + (DST_X - SRC_X) * 0.38, a.y, a.x + (DST_X - SRC_X) * 0.62, b.y, b.x, b.y);
            ctx.strokeStyle = c.has_alert ? `rgba(248,81,73,${alpha})` : `rgba(139,148,158,${alpha})`;
            ctx.lineWidth = 0.5 + (c.bytes / maxBytes) * 2.5;
            ctx.stroke();
        });
        topConns.forEach(c => {
            const a = srcPos[c.src], b = dstPos[c.dst];
            if (!a || !b || !(_hovered && (_hovered.ip === c.src || _hovered.ip === c.dst))) return;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.bezierCurveTo(a.x + (DST_X - SRC_X) * 0.38, a.y, a.x + (DST_X - SRC_X) * 0.62, b.y, b.x, b.y);
            ctx.strokeStyle = c.has_alert ? 'rgba(248,81,73,0.85)' : 'rgba(139,148,158,0.75)';
            ctx.lineWidth = 1.5 + (c.bytes / maxBytes) * 2.5;
            ctx.stroke();
        });

        allNodes.forEach(n => {
            const fill = SEV_FILL[alertIpSev[n.ip]] || DEF_FILL;
            ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2);
            ctx.fillStyle = fill; ctx.fill();
            if (alertIpSev[n.ip]) {
                ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R + 2, 0, Math.PI * 2);
                ctx.strokeStyle = fill; ctx.lineWidth = 1; ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1;
            }
            const hn  = _hostnames[n.ip];
            const label = hn || n.ip;
            ctx.font = `${_hovered && _hovered.ip === n.ip ? 'bold ' : ''}9px -apple-system, sans-serif`;
            ctx.fillStyle = _hovered && _hovered.ip === n.ip ? textCol : mutedCol;
            if (n.side === 'src') { ctx.textAlign = 'right'; ctx.fillText(label, n.x - NODE_R - 3, n.y + 3); }
            else                  { ctx.textAlign = 'left';  ctx.fillText(label, n.x + NODE_R + 3, n.y + 3); }
        });
    }

    _drawGraph();
    canvas.onmousemove = (e) => {
        const r = canvas.getBoundingClientRect();
        const mx = (e.clientX - r.left) * (W / r.width), my = (e.clientY - r.top) * (H / r.height);
        const hit = allNodes.find(n => Math.hypot(n.x - mx, n.y - my) < NODE_R + 5);
        if (hit !== _hovered) { _hovered = hit || null; canvas.style.cursor = hit ? 'pointer' : 'default'; _drawGraph(); }
    };
    canvas.onmouseleave = () => { if (_hovered) { _hovered = null; _drawGraph(); } };
    canvas.onclick = (e) => {
        const r = canvas.getBoundingClientRect();
        const mx = (e.clientX - r.left) * (W / r.width), my = (e.clientY - r.top) * (H / r.height);
        const hit = allNodes.find(n => Math.hypot(n.x - mx, n.y - my) < NODE_R + 4);
        if (!hit) return;
        const inp = document.getElementById('alert-ip-search');
        if (inp) { inp.value = hit.ip; onIpSearchInput(hit.ip); }
    };

    const tableRows = topConns.map(c => {
        const alertDot = c.has_alert ? `<span class="ms-1" style="color:var(--nks-high);font-size:0.6rem">&#9679;</span>` : '';
        return `<tr>
            <td class="text-nowrap" style="font-size:0.78rem">${escapeHtml(c.src)}</td>
            <td class="text-center text-secondary px-1" style="font-size:0.7rem">→</td>
            <td class="text-nowrap" style="font-size:0.78rem">${escapeHtml(c.dst)}${alertDot}</td>
            <td class="text-end text-secondary text-nowrap" style="font-size:0.78rem">${formatBytes(c.bytes)}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `<div class="table-responsive" style="border-top:1px solid var(--nks-border)">
        <table class="table table-sm mb-0 nks-table" style="font-size:0.78rem">
            <thead><tr><th>Source</th><th></th><th>Destination</th><th class="text-end">Bytes</th></tr></thead>
            <tbody>${tableRows}</tbody>
        </table></div>`;
}

// ─── Geo map (Leaflet) ────────────────────────────────────────────────────────

let _geoMap = null;
let _lastGeoMapArgs = null;

function renderGeoMap(hosts, alerts) {
    const panel = document.getElementById('geo-map-panel');
    const mapEl = document.getElementById('geo-map');
    if (!panel || !mapEl) return;
    _lastGeoMapArgs = [hosts, alerts];

    panel.classList.remove('d-none');

    if (typeof L === 'undefined') {
        mapEl.innerHTML = '<div class="text-center text-secondary p-4 small"><i class="bi bi-globe" style="font-size:1.5rem"></i><br>Map library unavailable</div>';
        return;
    }

    const mappable = hosts.filter(h =>
        h.latitude != null && h.longitude != null && isFinite(h.latitude) && isFinite(h.longitude)
    );
    if (!mappable.length) {
        mapEl.innerHTML = '<div class="text-center text-secondary p-4 small"><i class="bi bi-globe" style="font-size:1.5rem"></i><br>No geo data — add a MaxMind license key on the server to enable IP geolocation.</div>';
        return;
    }

    const countEl = document.getElementById('geo-map-count');
    if (countEl) countEl.textContent = `${mappable.length} host${mappable.length !== 1 ? 's' : ''}`;

    const alertIps = new Set();
    alerts.forEach(a => {
        const d = a.details || {};
        [d.src_ip, d.dst_ip, d.target_ip].filter(Boolean).forEach(ip => alertIps.add(ip));
    });

    if (_geoMap) { _geoMap.remove(); _geoMap = null; }

    const tileUrl  = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
    const tileAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

    _geoMap = L.map(mapEl, { zoomControl: true, attributionControl: true });
    L.tileLayer(tileUrl, { attribution: tileAttr, maxZoom: 10 }).addTo(_geoMap);

    const markers = [];
    mappable.forEach(h => {
        const hasAlert = alertIps.has(h.ip);
        const color    = hasAlert ? '#f85149' : '#58a6ff';
        const marker   = L.circleMarker([h.latitude, h.longitude], {
            radius: hasAlert ? 8 : 6,
            fillColor: color, color: 'rgba(255,255,255,0.2)', weight: 1, opacity: 1, fillOpacity: 0.85,
        });
        const hn    = _hostnames[h.ip];
        const geo   = _geoInfo[h.ip] || h;
        const flag  = _flagEmoji(geo.country || h.country || '');
        const where = [geo.city || h.city, geo.country_name || h.country_name].filter(Boolean).join(', ');
        let tip = `<strong>${escapeHtml(h.ip)}</strong>`;
        if (hn)           tip += `<br><span style="color:#8b949e">${escapeHtml(hn)}</span>`;
        if (where)        tip += `<br>${flag} ${escapeHtml(where)}`;
        if (geo.org)      tip += `<br>${escapeHtml(geo.org)}`;
        if (hasAlert)     tip += `<br><span style="color:#f85149">⚠ Has alerts</span>`;
        marker.bindTooltip(tip, { sticky: true, className: 'nks-map-tooltip' });
        marker.on('click', () => {
            const inp = document.getElementById('alert-ip-search');
            if (inp) { inp.value = h.ip; onIpSearchInput(h.ip); inp.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        });
        marker.addTo(_geoMap);
        markers.push(marker);
    });

    _geoMap.invalidateSize();
    if (markers.length === 1) {
        _geoMap.setView([mappable[0].latitude, mappable[0].longitude], 4);
    } else {
        _geoMap.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
    }
    setTimeout(() => { if (_geoMap) _geoMap.invalidateSize(); }, 200);
}


// ─── Guest banner ─────────────────────────────────────────────────────────────

function showGuestBanner(expiresAt) {
    const banner = document.getElementById('guest-banner');
    if (!banner) return;
    let expMsg = '';
    if (expiresAt) {
        const exp = new Date(expiresAt);
        const expStr = escapeHtml(exp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        expMsg = ` <span class="text-secondary small">(expires ${expStr})</span>`;
    }
    banner.innerHTML = `<i class="bi bi-stars"></i> <strong>Want more?</strong> Persistent results, saved history, suppression rules &amp; team features available on the full platform. Contact <a href="mailto:nirkacher@gmail.com" class="alert-link fw-semibold">nirkacher@gmail.com</a> to request access.${expMsg}`;
    banner.classList.remove('d-none');
}


// ─── Auto-init (no inline scripts in HTML needed) ─────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    initConnectionBar();

    // index.html — upload zone present
    if (document.getElementById('upload-zone')) {
        initUpload();
        loadRecentResults();
        var resetBtn = document.getElementById('reset-upload-btn');
        if (resetBtn) resetBtn.addEventListener('click', resetUpload);
    }

    // results.html — loading-state container present
    if (document.getElementById('loading-state')) {
        var params = new URLSearchParams(window.location.search);
        var analysisId = params.get('id');
        if (analysisId) {
            loadResults(analysisId);
        } else {
            document.getElementById('loading-state').classList.add('d-none');
            document.getElementById('error-state').classList.remove('d-none');
            var errEl = document.getElementById('results-error-message');
            if (errEl) errEl.textContent = 'No analysis ID in URL.';
        }
    }
});
