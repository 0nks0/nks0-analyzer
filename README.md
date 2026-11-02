# NKS0 — PCAP Analyzer

A web-based network packet capture analyzer built from a **defender's perspective**.

Drop a `.pcap` or `.pcapng` file and get an instant security analysis — severity-ranked alerts, protocol breakdown, top talkers, and a network graph. Built with a **zero-noise philosophy**: 36 detection rules tuned to surface real findings, not drown you in false positives.

🔗 **Live app:** https://0nks0.github.io/nks0-analyzer/

---

## What it does

- **36 detection rules** covering port scanning, brute force, data exfiltration, DNS tunneling, credential exposure, suspicious HTTP services, and more
- **Severity-ranked alerts** (High / Medium / Low / Info) with supporting evidence for each finding
- **Protocol distribution** and traffic charts
- **Top host breakdown** by traffic volume, with IPv4/IPv6 toggle
- **Interactive timeline** — click an event to jump to the related alert
- **Network graph** visualizing host-to-host communication
- **Credential exposure detection** — cleartext credentials are kept in memory only, revealed on demand, never written to the DOM by default
- **Export results as JSON**
- **Recent analyses** stored locally on your device (localStorage)

---

## How it works (concept)

1. You drop a PCAP in the browser — it's validated client-side (type + size) and sent securely for analysis.
2. The backend parses the capture, runs the detection rules, and returns a job ID.
3. The frontend polls the job until analysis completes, then renders the results page.

The frontend is **fully static** — no build step, no framework. Just open `index.html`.

---

## Privacy

PCAP files can contain sensitive data (credentials, internal IPs, real traffic). Please note:

- Uploads are processed to generate analysis and are **not intended for long-term storage** — results expire with the session.
- Detected cleartext credentials are held in browser memory only and are not persisted to disk or the DOM unless you explicitly reveal them.
- **Do not upload captures containing data you are not authorized to share.** Sanitize sensitive traffic first (e.g. with `tcprewrite` / `editcap`) when in doubt.

### Usage counts

Page views and analyses started can be counted. This is **off** unless `ANALYTICS_PATH` in `js/app.js` is set to a path on the existing API, such as `/api/usage`. An empty value, or any value that is not a plain path, means the browser makes no analytics request.

When it is on, each count is a POST to that path on `https://nks0-api.onrender.com` (already allowed by the page Content-Security-Policy). The body is JSON text with one of these two shapes and no other fields:

- `{"event":"pageview"}` — one per load of `index.html` or `results.html`
- `{"event":"analysis_run","mode":"guest"}` — once, when a guest upload is accepted. `guest` is the only mode: there is no signed-in upload

The request does not include the capture, its filename, file size, hashes, packet contents, alerts, findings, or the analysis id. The page does not set an analytics cookie, does not store an analytics id in `localStorage`, and sends the POST with cookies omitted and no referrer. If Do Not Track is `1` or `yes` (`navigator.doNotTrack` or `window.doNotTrack`), or Global Privacy Control is on (`navigator.globalPrivacyControl === true`), nothing is sent.

The counter is expected to store aggregate totals only and not to record IP addresses. Until `ANALYTICS_PATH` is set, nothing is collected.

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

---

## Running Locally

No dependencies — it's a static site.

```bash
git clone https://github.com/0nks0/nks0-analyzer.git
cd nks0-analyzer
python3 -m http.server 8000
# open http://127.0.0.1:8000
```

---

## File Limits

- Supported formats: `.pcap`, `.pcapng`
- Maximum upload size: **150 MB** (validated client-side before upload)
- Large captures may take a few minutes to analyze

---

## Tech Stack

- **Frontend:** vanilla JS, Bootstrap 5, Chart.js (all pinned with Subresource Integrity)
- **Security headers:** Content-Security-Policy, `no-referrer`, clickjacking protection

---

## Status

Active development — more detection rules and visualizations on the way.

## License

[MIT](LICENSE) © Nir Kacher

## Contact

Enquiries • donations • collaborations — **nirkacher@gmail.com**
