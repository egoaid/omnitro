#!/usr/bin/env python3
"""omnitro: bump the app version in every place that must stay in sync.

Usage:  python3 tools/bump-version.py 1.5.49

Updates:
  js/version.js     APP_VERSION
  version.json      {"version": ...}
  sw.js             CACHE_NAME and ?vNN cache-busting query strings
  index.html        ?vNN cache-busting query strings (and the static version labels, which JS overwrites at load)

The ?vNN number is the patch component (1.5.49 -> v49).
Run from the repository root, then commit and deploy ALL files together.
"""
import json, re, sys, pathlib

if len(sys.argv) != 2 or not re.fullmatch(r"\d+\.\d+\.\d+", sys.argv[1]):
    sys.exit("usage: python3 tools/bump-version.py MAJOR.MINOR.PATCH   (e.g. 1.5.49)")
ver = sys.argv[1]
q = "v" + ver.split(".")[2]
root = pathlib.Path(__file__).resolve().parent.parent

def edit(rel, fn):
    p = root / rel
    s = p.read_text(encoding="utf-8")
    t = fn(s)
    if t == s:
        print(f"  (no change) {rel}")
    else:
        p.write_text(t, encoding="utf-8")
        print(f"  updated     {rel}")

edit("js/version.js", lambda s: re.sub(r"(const APP_VERSION = ')[^']*(';)", rf"\g<1>{ver}\g<2>", s))
(root / "version.json").write_text(json.dumps({"version": ver}, indent=2) + "\n", encoding="utf-8")
print("  updated     version.json")
edit("sw.js", lambda s: re.sub(r"\?v\d+", "?" + q,
     re.sub(r"(const CACHE_NAME = 'omnitro-cache-)[^']*(';)", rf"\g<1>{ver}\g<2>", s)))
edit("index.html", lambda s: re.sub(r'(id="settings-version">omnitro v)[^<]*', rf"\g<1>{ver}",
     re.sub(r'(id="settings-header-version">v)[^<]*', rf"\g<1>{ver}",
     re.sub(r"\?v\d+", "?" + q, s))))
print(f"done: version {ver}, query {q}")
