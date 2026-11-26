# NKS0 — PCAP Analyzer

A web-based network packet capture analyzer built from a **defender's perspective**.

Drop a `.pcap` or `.pcapng` file and get a security analysis — severity-ranked alerts, protocol breakdown, top talkers, and a network graph. Built with a **zero-noise philosophy**: 37 detection rules tuned to surface real findings, not drown you in false positives.

🔗 **Live app:** https://0nks0.github.io/nks0-analyzer/

---

## What it does

- **37 detection rules** covering port scanning, brute force, cleartext credential exposure, data exfiltration, DNS tunneling and other suspicious DNS, beaconing, covert tunnels, lateral movement, and unexpected HTTP services
- **Severity-ranked alerts** (Critical / High / Medium / Low / Info) with supporting evidence for each finding
- **Protocol distribution** and traffic charts
- **Top host breakdown** by traffic volume, with IPv4/IPv6 toggle
- **Interactive timeline** — click an event to jump to the related alert
- **Network graph** visualizing host-to-host communication
- **Credential exposure detection** — cleartext credentials are kept in memory only, revealed on demand, never written to the DOM by default
- **Export results** as JSON, CSV, or a self-contained HTML report (the results page can also print / save as PDF)
- **Recent analyses** stored locally on your device (localStorage)

---

## How it works (concept)

1. You drop a `.pcap` or `.pcapng` in the browser. It checks the file type and rejects anything over **100 MB**, then uploads the capture.
2. The service accepts the file and returns a job id while analysis is still running. Parsing and the detection rules run in the background.
3. The page polls that job until analysis finishes, then opens the results.

The frontend is **fully static** — no build step, no framework. Just open `index.html`.

---

## Privacy

PCAP files can contain sensitive data (credentials, internal IPs, real traffic). Please note:

- Uploads are processed to generate analysis and are **not kept for long-term storage**. A guest result includes an expiry time, set to one hour after upload. Expired guest analyses are removed when the service starts and about once an hour after that. The recent-analyses list in the browser stays on your device only.
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

---

## File Limits

- Supported formats: `.pcap`, `.pcapng`
- Maximum upload size: **100 MB** (100 × 1024 × 1024 bytes), the default guest upload cap (`NKS0_GUEST_MAX_UPLOAD_MB`). The browser rejects a larger file before upload, and the service rejects it as well.
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

## Support the project

[Sponsor on GitHub](https://github.com/sponsors/0nks0)
