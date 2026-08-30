#!/usr/bin/env bash
# Drive the K2 manual run's on-device steps with adb only.
#
# Why this exists: on this Vivo device sh.paseo.debug is intermittently flipped to
# COMPONENT_ENABLED_STATE_DISABLED_USER (enabled=3) and other apps steal the
# foreground. Maestro's interactive commands also hang after a tap on Android 16.
# So the steps run in one fast pass, re-enabling the package before each stage
# instead of pausing between them.
#
# Usage: drive-k2-manual.sh <serial> <daemon-port> <artifacts-dir>
# It does NOT create the continue file; the caller decides that after reviewing
# the dumps, so an empty pass cannot be mistaken for a real verification.
set -uo pipefail

SERIAL="${1:?serial required}"
PORT="${2:?daemon port required}"
OUT="${3:?artifacts dir required}"
ADB=(adb -s "$SERIAL")
XML=/sdcard/k2.xml
LOG="$OUT/drive.log"

log() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }

ensure_enabled() {
  local st
  st=$("${ADB[@]}" shell "pm dump sh.paseo.debug 2>/dev/null | grep -m1 -oE 'enabled=[0-9]'" 2>/dev/null | grep -oE '[0-9]$')
  if [ "$st" != "1" ]; then
    "${ADB[@]}" shell pm enable sh.paseo.debug >/dev/null 2>&1
    log "re-enabled package (was enabled=$st)"
  fi
}

dump() {
  ensure_enabled
  timeout 8 "${ADB[@]}" shell uiautomator dump "$XML" >/dev/null 2>&1 || true
  timeout 5 "${ADB[@]}" shell cat "$XML" 2>/dev/null || true
}

# Tap the centre of the first node whose serialised attributes match $1.
tap_match() {
  local needle="$1" label="$2" xml b n cx cy
  xml=$(dump)
  b=$(printf '%s' "$xml" | tr '<' '\n' | grep -- "$needle" | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | head -1)
  if [ -z "$b" ]; then
    log "MISS $label ($needle)"
    return 1
  fi
  n=$(printf '%s' "$b" | grep -oE '[0-9]+')
  cx=$(( ( $(printf '%s' "$n" | sed -n 1p) + $(printf '%s' "$n" | sed -n 3p) ) / 2 ))
  cy=$(( ( $(printf '%s' "$n" | sed -n 2p) + $(printf '%s' "$n" | sed -n 4p) ) / 2 ))
  "${ADB[@]}" shell input tap "$cx" "$cy" >/dev/null 2>&1
  log "TAP  $label at ($cx,$cy)"
  return 0
}

present() { dump | grep -q -- "$1"; }

shot() { "${ADB[@]}" exec-out screencap -p >"$OUT/$1.png" 2>/dev/null; }

save_dump() {
  local name="$1"
  dump >"$OUT/${name}.xml" 2>/dev/null || true
}

wait_present() {
  local needle="$1" label="$2" tries="${3:-20}" i
  for i in $(seq 1 "$tries"); do
    ensure_enabled
    if present "$needle"; then
      log "SEEN $label"
      return 0
    fi
    sleep 1
  done
  log "MISS wait $label ($needle)"
  return 1
}

swipe_up() {
  ensure_enabled
  "${ADB[@]}" shell input swipe 630 1900 630 900 300 >/dev/null 2>&1
  log "SWIPE up"
}

# KEYCODE_0=7 … KEYCODE_9=16. Number-pad IMEs often swallow `input text`.
type_digits() {
  local d
  for d in $(printf '%s' "$1" | fold -w1); do
    "${ADB[@]}" shell input keyevent $((7 + d)) >/dev/null 2>&1
  done
}

clear_focused() {
  "${ADB[@]}" shell input keyevent KEYCODE_MOVE_END >/dev/null 2>&1
  local i
  for i in $(seq 1 12); do
    "${ADB[@]}" shell input keyevent KEYCODE_DEL >/dev/null 2>&1
  done
}

# Host and port are separate fields. Putting host:port into Host yields
# Invalid URL: tcp://[127.0.0.1:PORT]:6767. Keyboard shifts bounds, so
# re-dump before the port tap.
fill_direct_connection() {
  if ! present 'add-host-modal'; then
    log "MISS add-host-modal"
    return 1
  fi
  log "add-host-modal opened"
  tap_match 'direct-host-input' 'direct-host-input' || return 1
  sleep 1
  clear_focused
  "${ADB[@]}" shell input text '127.0.0.1' >/dev/null 2>&1
  sleep 1
  tap_match 'direct-port-input' 'direct-port-input' || return 1
  sleep 1
  clear_focused
  type_digits "$PORT"
  sleep 1
  shot manual-host-filled
  tap_match 'direct-host-submit' 'direct-host-submit' || return 1
  sleep 18
}

log "=== drive start: serial=$SERIAL port=$PORT ==="
"${ADB[@]}" reverse "tcp:$PORT" "tcp:$PORT" >/dev/null 2>&1
"${ADB[@]}" reverse tcp:8081 tcp:8081 >/dev/null 2>&1
log "reverse: $("${ADB[@]}" reverse --list 2>/dev/null | tr '\n' ' ')"

ensure_enabled
"${ADB[@]}" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1
"${ADB[@]}" shell am start -W -n sh.paseo.debug/.MainActivity >/dev/null 2>&1
sleep 12

# Stage 1: leave Expo DevLauncher. Tapping the 8081 TextView (clickable=false)
# or Connect without a selected URL yields Invalid URL host: "".
# expo-dev-launcher:// does not load the bundle; this development-client URL does.
if present 'DEVELOPMENT SERVERS' || present 'localhost:8081'; then
  log "DEVLAUNCHER deep-link exp+voice-mobile"
  "${ADB[@]}" shell am start -a android.intent.action.VIEW \
    -d 'exp+voice-mobile://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' \
    sh.paseo.debug >/dev/null 2>&1
  wait_present 'welcome-screen' 'welcome-screen' 40 || wait_present 'menu-button' 'menu-button' 20
fi

# Stage 2: connect to the isolated daemon.
if present 'welcome-direct-connection' && ! present 'menu-button'; then
  tap_match 'welcome-direct-connection' 'welcome-direct-connection'
  sleep 4
fi
if present 'add-host-method-direct'; then
  tap_match 'add-host-method-direct' 'add-host-method-direct'
  sleep 4
fi
if present 'add-host-modal'; then
  fill_direct_connection
fi

shot manual-after-connect
save_dump after-connect
log "post-connect ids: $(dump | tr '<' '\n' | grep -oE 'resource-id="[a-z][a-z0-9-]{5,34}"' | sort -u | tr '\n' ' ')"

# Stage 3: Settings > Providers > custom-provider form > Cancel.
# Maestro is not used (blocker A). Each step re-enables the package first.
if present 'welcome-open-settings' && ! present 'menu-button' && ! present 'message-input-root'; then
  tap_match 'welcome-open-settings' 'welcome-open-settings'
  sleep 4
fi

if present 'menu-button'; then
  tap_match 'menu-button' 'menu-button'
  sleep 3
fi

if wait_present 'sidebar-settings' 'sidebar-settings' 12; then
  tap_match 'sidebar-settings' 'sidebar-settings'
  sleep 4
fi

if ! present 'settings-host-section-providers'; then
  for _swipe in $(seq 1 8); do
    present 'settings-host-section-providers' && break
    swipe_up
    sleep 1
  done
fi

if wait_present 'settings-host-section-providers' 'settings-host-section-providers' 8; then
  tap_match 'settings-host-section-providers' 'settings-host-section-providers'
  sleep 4
fi

shot providers-list
save_dump providers-list

if wait_present 'custom-provider-add' 'custom-provider-add' 12; then
  tap_match 'custom-provider-add' 'custom-provider-add'
  sleep 4
fi

form_open=0
if wait_present 'custom-provider-edit-sheet' 'custom-provider-edit-sheet' 8; then
  form_open=1
elif wait_present 'custom-provider-base-url' 'custom-provider-base-url' 8; then
  form_open=1
fi
if [ "$form_open" -eq 1 ]; then
  log "custom provider form opened"
  shot custom-provider-form
  save_dump custom-provider-form
else
  log "MISS custom provider form"
  shot custom-provider-form-miss
  save_dump custom-provider-form-miss
fi

if present 'custom-provider-cancel'; then
  tap_match 'custom-provider-cancel' 'custom-provider-cancel'
  sleep 3
  log "cancelled custom provider form"
else
  log "MISS custom-provider-cancel"
fi

shot after-cancel
save_dump after-cancel
log "post-cancel ids: $(dump | tr '<' '\n' | grep -oE 'resource-id="[a-z][a-z0-9-]{5,34}"' | sort -u | tr '\n' ' ')"
log "=== drive end ==="
