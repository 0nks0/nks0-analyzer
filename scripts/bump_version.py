#!/usr/bin/env python3
"""
bump_version.py — single source of truth for the app version.

Usage:
    python3 scripts/bump_version.py 1.4.1

Updates every place the version is referenced so they never drift:
  - js/app.js        (APP_VERSION)
  - index.html       (js/app.js?v=...)
  - results.html     (js/app.js?v=...)

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

def main():
    if len(sys.argv) != 2:
        print("usage: bump_version.py NEW_VERSION  (e.g. 1.4.1)")
        sys.exit(2)
    new = sys.argv[1]
    if not re.match(r'^\d+\.\d+\.\d+$', new):
        print("version must look like X.Y.Z")
        sys.exit(2)

    appjs = read('js/app.js')
    m = re.search(r"APP_VERSION = '([^']+)'", appjs)
    if not m:
        print("could not find APP_VERSION in js/app.js")
        sys.exit(1)
    old = m.group(1)
    print(f"bumping {old} -> {new}")

    write('js/app.js', appjs.replace(f"APP_VERSION = '{old}'", f"APP_VERSION = '{new}'"))
    for html in ('index.html', 'results.html'):
        s = read(html)
        s2 = re.sub(r"app\.js\?v=[0-9.]+", f"app.js?v={new}", s)
        write(html, s2)
    print("done — updated js/app.js, index.html, results.html")

if __name__ == '__main__':
    main()
