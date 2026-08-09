# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in NKS0 PCAP Analyzer, please report it
responsibly:

- **Email:** nirkacher@gmail.com
- Include a clear description, reproduction steps, and impact assessment.
- Please **do not** open a public GitHub issue for security-sensitive reports.

You can expect an initial acknowledgement within a few days. Verified issues
will be addressed as a priority, and credit will be given to reporters who wish
to be named.

## Scope

This repository contains the **static frontend** (GitHub Pages). The analysis
backend (`nks0-api.onrender.com`) is a separate component. Reports for either
are welcome via the contact above.

## Handling of Uploaded Data

NKS0 analyzes user-supplied packet captures, which may contain sensitive data:

- Uploads are processed to produce analysis results and are **not intended for
  long-term storage** — results expire with the server session.
- Detected cleartext credentials are held in browser memory only and are not
  written to the DOM or disk unless the user explicitly reveals them.
- Users are responsible for ensuring they are authorized to analyze any capture
  they upload, and are encouraged to sanitize sensitive traffic beforehand.

## Frontend Hardening

The frontend ships with several defensive measures:

- **Content-Security-Policy** restricting script/style/connect sources
- **Subresource Integrity (SRI)** on all third-party CDN assets
- **`referrer: no-referrer`** to avoid leaking analysis URLs
- **Clickjacking protection** (frame-busting)
- **Client-side input validation** (file type and size) before upload
- HTML output is escaped to mitigate XSS from parsed capture contents
