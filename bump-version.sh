#!/bin/sh
# Bump Charge's version so every phone picks up the update by itself.
# Run this before you commit and push any change:   sh bump-version.sh
set -e
cd "$(dirname "$0")"
OLD=$(grep -o '[0-9]\+' version.json)
NEW=$((OLD + 1))
echo "{ \"version\": $NEW }" > version.json
sed -i.bak -E "s/\?v=[0-9]+/?v=$NEW/g" index.html sw.js app.js
sed -i.bak -E "s/charge-v[0-9]+/charge-v$NEW/" sw.js
sed -i.bak -E "s/APP_VERSION = [0-9]+/APP_VERSION = $NEW/" app.js
rm -f index.html.bak sw.js.bak app.js.bak
echo "Charge is now version $NEW. Commit and push."
