#!/usr/bin/env python3
"""
bump_version.py — single source of truth for the app version.

Usage:
    python3 scripts/bump_version.py 1.4.1     # rewrite every reference
    python3 scripts/bump_version.py --check   # verify they agree (CI gate)

Updates every place the version is referenced so they never drift:
  - js/app.js        (APP_VERSION)
  - index.html       (js/app.js?v=...  and  css/style.css?v=...)
  - results.html     (js/app.js?v=...  and  css/style.css?v=...)

The stylesheet is included deliberately: it was previously left out, which is
how the deployed site ended up serving app.js?v=1.4.0 alongside
style.css?v=1.4.7 — a returning visitor got new markup with stale styles.

The old version is auto-detected from js/app.js.
"""
import sys, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()

def write(p, s):
    with open(os.path.join(ROOT, p), 'w', encoding='utf-8') as f:
        f.write(s)

HTML_FILES = ('index.html', 'results.html')
ASSET_RE = re.compile(r"(js/app\.js|css/style\.css)\?v=([0-9.]+)")


def current_version():
    m = re.search(r"APP_VERSION = '([^']+)'", read('js/app.js'))
    if not m:
        print("could not find APP_VERSION in js/app.js")
        sys.exit(1)
    return m.group(1)


def check():
    """Exit non-zero if any asset reference disagrees with APP_VERSION."""
    version = current_version()
    ok = True
    for html in HTML_FILES:
        found = ASSET_RE.findall(read(html))
        if not found:
            print(f"{html}: no versioned asset references found")
            ok = False
        for asset, ver in found:
            if ver != version:
                print(f"{html}: {asset}?v={ver} does not match APP_VERSION {version}")
                ok = False
    print("versions consistent" if ok else "VERSION MISMATCH")
    sys.exit(0 if ok else 1)


def bump(new):
    if not re.match(r'^\d+\.\d+\.\d+$', new):
        print("version must look like X.Y.Z")
        sys.exit(2)

    old = current_version()
    print(f"bumping {old} -> {new}")

    write('js/app.js', read('js/app.js').replace(
        f"APP_VERSION = '{old}'", f"APP_VERSION = '{new}'"))
    for html in HTML_FILES:
        write(html, ASSET_RE.sub(lambda m: f"{m.group(1)}?v={new}", read(html)))
    print("done — updated js/app.js, index.html, results.html (js + css)")


def main():
    if len(sys.argv) != 2:
        print("usage: bump_version.py NEW_VERSION | --check")
        sys.exit(2)
    if sys.argv[1] == '--check':
        check()
    else:
        bump(sys.argv[1])


if __name__ == '__main__':
    main()
