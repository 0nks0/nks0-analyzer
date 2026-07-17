# NKS0 — PCAP Analyzer

A web-based network packet capture analyzer built from a **defender's perspective**.

Drop a `.pcap` or `.pcapng` file and get an instant security analysis — severity-ranked alerts, protocol breakdown, top talkers, and a network graph. Built with a **zero-noise philosophy**: 36 detection rules tuned to surface real findings, not drown you in false positives.

🔗 **Live app:** https://0nks0.github.io/nks0-analyzer/

---

## Features

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

## How It Works

```
┌─────────────────────┐         ┌──────────────────────────┐
│  Static frontend    │  HTTPS  │  Analysis backend        │
│  (GitHub Pages)     │ ──────► │  nks0-api.onrender.com   │
│  HTML/CSS/JS        │ ◄────── │  PCAP parsing + rules    │
└─────────────────────┘  JSON   └──────────────────────────┘
```

1. You drop a PCAP in the browser — it's validated client-side (type + size) and uploaded to the guest analysis endpoint.
2. The backend parses the capture, runs the detection rules, and returns a job ID.
3. The frontend polls the job until analysis completes, then renders the results page.

The frontend is **fully static** — no build step, no framework. Just open `index.html`.

---

## Privacy

PCAP files can contain sensitive data (credentials, internal IPs, real traffic). Please note:

- Uploads are processed by the backend to generate analysis and are **not intended for long-term storage** — results expire with the server session.
- Detected cleartext credentials are held in browser memory only and are not persisted to disk or the DOM unless you explicitly reveal them.
- **Do not upload captures containing data you are not authorized to share.** Sanitize sensitive traffic first (e.g. with `tcprewrite` / `editcap`) when in doubt.

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

The frontend points at the hosted backend (`nks0-api.onrender.com`) by default. Note the backend runs on a free tier and may cold-start (~50s) after inactivity.

---

## File Limits

- Supported formats: `.pcap`, `.pcapng`
- Maximum upload size: **150 MB** (validated client-side before upload)
- Large captures may take a few minutes to analyze

---

## Tech Stack

- **Frontend:** vanilla JS, Bootstrap 5, Chart.js (all pinned with Subresource Integrity)
- **Hosting:** GitHub Pages (frontend) + Render (backend API)
- **Security headers:** Content-Security-Policy, `no-referrer`, clickjacking protection

---

## Status

Active development — more detection rules and visualizations on the way.

## License

[MIT](LICENSE) © Nir Kacher

## Contact

Enquiries • donations • collaborations — **nirkacher@gmail.com**
