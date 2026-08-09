# NKS0 Analyzer — Results Page QA Checklist

Use this when you want to verify the results page end-to-end.
Pick a small `.pcap`/`.pcapng` file (under 20 MB) for the upload tests.

---

## 1. Upload flow
- [ ] Open `index.html` — page title, stats bar, navbar all load
- [ ] Backend status badge shows **Online** within a few seconds
- [ ] `Drop a PCAP file here` zone visible + clickable
- [ ] Drag-and-drop highlights the drop zone
- [ ] Selecting a non-`.pcap`/`.pcapng` file shows a client-side error
- [ ] Selecting an empty file shows a client-side error
- [ ] Selecting a file > 150 MB shows a size-limit error
- [ ] Upload progress bar moves (0 → 40 %) during upload
- [ ] After upload: status switches to `Analyzing…`, progress climbs toward 100 %
- [ ] After completion: automatic redirect to `results.html?id=<id>`

---

## 2. Results page — general
- [ ] Page title and navbar render
- [ ] **Loading** spinner appears briefly, then results render
- [ ] Top stat cards show real values:
  - file name
  - total packets
  - capture duration
  - analysis time
  - total alerts count
  - critical + high count with hover tooltip
- [ ] Risk verdict banner renders with correct icon/text
- [ ] API status badge updates every ~30 s and stays **Online**

---

## 3. Severity tabs & filters
- [ ] Severity badges render: All / Critical / High / Medium / Low / Info (with counts)
- [ ] Clicking a badge filters the alerts list to that severity
- [ ] “All” clears the filter
- [ ] IP/hostname search field filters alerts as you type
- [ ] Clear-search button appears when the field has text

---

## 4. Alerts list
- [ ] Alerts render in severity order
- [ ] Each alert card shows severity color, category, confidence, message, timestamps
- [ ] Expand/collapse all buttons work
- [ ] Alerts count footer updates with visible range / total

---

## 5. Charts & viz
- [ ] Protocol Distribution horizontal bar chart renders with entries
- [ ] Alert Breakdown severity bar chart renders
- [ ] Top Hosts table shows hosts, sent/recv bytes, alert badges
- [ ] Geo Map renders with markers for hosts that have geo data
- [ ] Network Flow renders when data exists (`graph-panel` becomes visible)
- [ ] Alert Timeline renders and slider endpoints are draggable
- [ ] Evidence Chain table renders with source/hash/verified columns
- [ ] MITRE ATT&CK heatmap/canvas renders when MITRE data exists

---

## 6. Export & print
- [ ] `JSON` exports a `.json` file with `meta`, `evidence_chain`, and raw `results`
- [ ] `CSV` exports a `.csv` with headers: Severity, Category, Confidence, Message, Source IP, Dest IP, First Seen, Tags
- [ ] `PDF` opens the browser print dialog

---

## 7. Error handling
- [ ] Opening `results.html` without `?id=` shows the **No analysis ID in URL** error
- [ ] Opening `results.html?id=does-not-exist` shows **Analysis not found** with retry button
- [ ] Retry button re-attempts the same `id`
- [ ] Back button returns to upload page
- [ ] “Try again” on upload errors resets the upload zone

---

## 8. Responsive & polish
- [ ] Layout collapses cleanly on mobile widths (≤ 768 px)
- [ ] No horizontal scroll on small screens
- [ ] Navbar, stat cards, charts, and tables remain readable
- [ ] Demo mode: `results.html?demo` renders synthetic results without backend

---

## 9. Security / static checks
- [ ] CSP meta tag is present in both `index.html` and `results.html`
- [ ] `connect-src` allows only `'self'` and `https://nks0-api.onrender.com`
- [ ] `js/app.js` is included **once** per page (no duplicate `<script>`)
- [ ] `referrer` is `no-referrer`
- [ ] No inline event handlers in the HTML itself

---

## 10. Performance / quick checks
- [ ] Landing page loads in < 2 s on a clean connection
- [ ] Results page loads and renders charts in < 3 s after data fetch
- [ ] Console shows no red errors during any of the above
- [ ] LocalStorage “Recent Analyses” appears after the first successful analysis
- [ ] Clear recent button wipes the recents list

---

## 11. cross-linking
- [ ] `New analysis` button returns to `index.html`
- [ ] Logo/brand links back to `index.html`
- [ ] GitHub button opens in a new tab

---

## Quick triage shortcuts
If anything fails, run these first:
- `curl -I https://nks0-api.onrender.com/api/health` — is backend up?
- `curl -I http://<pages-host>/index.html` — is the frontend being served correctly?
- Browser DevTools Console — any CSP or JS errors?
- Network tab — is `results.html` blocking on `/api/results/<id>`?
