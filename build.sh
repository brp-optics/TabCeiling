#!/usr/bin/bash
set -euo pipefail
mkdir -p build
rm -f "build/$1.zip"
zip "build/$1.zip" *.js manifest.json *.html *.svg
