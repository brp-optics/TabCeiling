#!/usr/bin/bash
# Verify every function and constant called across the extension's scripts is
# actually defined somewhere in the set. node --check only validates syntax and
# will happily pass a file that calls a function nobody defines.
set -uo pipefail

BROWSER_GLOBALS="browser console setTimeout clearTimeout Date Math Number Array JSON Promise String Object parseInt document window Set Map"

defined=$(cat settings.js background.js popup.js 2>/dev/null \
  | grep -oE '^[[:space:]]*(async )?function [A-Za-z_]+|^[[:space:]]*(const|let) [A-Za-z_]+' \
  | grep -oE '[A-Za-z_]+$' | sort -u)

called=$(cat settings.js background.js popup.js 2>/dev/null \
  | grep -oE '\b[A-Za-z_]{3,}\(' | tr -d '(' | sort -u)

fail=0
for name in $called; do
  echo "$BROWSER_GLOBALS" | grep -qw "$name" && continue
  echo "$defined" | grep -qx "$name" && continue
  # method calls and built-ins we don't track
  echo "$name" | grep -qE '^(then|catch|filter|map|find|push|slice|split|join|test|toggle|add|remove|get|set|has|delete|log|warn|error|isInteger|isArray|min|max|round|parse|stringify|entries|values|keys|querySelectorAll|getElementById|addEventListener|removeEventListener|closest|createElement|appendChild|setAttribute|getPlatformInfo|textContent|includes|replace|resolve|reject|now|from|assign|addListener|removeListener|query|update|open|finish|create|discard)$' && continue
  echo "UNDEFINED: $name"
  fail=1
done

[ $fail -eq 0 ] && echo "All referenced names are defined."

# Call sites that must exist. The name check above only proves that everything
# called is defined — it cannot notice a call that has been deleted. Both of
# these have been lost to careless edits before.
required=(
  "background.js:await consumeGrant()"
  "background.js:probeTab(tab.id, RESTORE_PROBE_MS)"
  "background.js:deferClose(tab.id)"
  "background.js:recordActivity(+1)"
  "background.js:breakerAllows()"
)
for entry in "${required[@]}"; do
  file="${entry%%:*}"; needle="${entry#*:}"
  if ! grep -qF "$needle" "$file"; then
    echo "MISSING CALL: $needle in $file"
    fail=1
  fi
done
[ "${fail:-0}" -eq 0 ] || exit 1
echo "All required call sites present."
