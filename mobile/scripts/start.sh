#!/usr/bin/env bash
# Start the Expo dev server, making sure a phone on the same WiFi can reach it.
#
# On WSL2 with default NAT networking, `expo start` cannot find a routable LAN
# address and advertises 127.0.0.1 in its manifest and QR code — the phone then
# tries to connect to itself and shows "Network error". The reachable address is
# the Windows host's LAN IP, with netsh portproxy forwarding 8081/4000 into WSL
# (see ../../scripts/portproxy.ps1).
#
# Outside WSL this is a plain `expo start`.
set -euo pipefail

PORT=8081

is_wsl() { grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; }

# A leftover dev server silently wins the port race and serves the *old*
# config, which looks exactly like "my fix didn't work".
if command -v ss >/dev/null && ss -tln 2>/dev/null | grep -q ":$PORT "; then
  echo "Port $PORT is already in use by another Expo dev server." >&2
  echo "Stop it first:  pkill -f 'expo start'" >&2
  exit 1
fi

if ! is_wsl; then
  exec npx expo start "$@"
fi

PS='/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'

win_lan_ip() {
  [[ -x "$PS" ]] || return 0
  "$PS" -NoProfile -Command \
    "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.InterfaceAlias -notlike '*WSL*' -and \$_.InterfaceAlias -notlike '*Loopback*' -and \$_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress" \
    2>/dev/null | tr -d '\r\n'
}

HOST_IP="${REACT_NATIVE_PACKAGER_HOSTNAME:-$(win_lan_ip)}"

if [[ -z "$HOST_IP" ]]; then
  echo "Could not detect the Windows LAN IP." >&2
  echo "Set it manually:  REACT_NATIVE_PACKAGER_HOSTNAME=<your-ip> npm start" >&2
  exit 1
fi

# The portproxy rules target a specific WSL IP, which changes on restart.
WSL_IP="$(hostname -I | awk '{print $1}')"
PROXY_TARGET="$("$PS" -NoProfile -Command "netsh interface portproxy show v4tov4" 2>/dev/null \
  | tr -d '\r' | awk -v p="$PORT" '$2 == p {print $3}' || true)"

if [[ -z "$PROXY_TARGET" ]]; then
  echo "WARNING: no portproxy rule for port $PORT. Phones will not be able to connect."
  echo "         In an elevated PowerShell: scripts\\portproxy.ps1 -WslIp $WSL_IP"
elif [[ "$PROXY_TARGET" != "$WSL_IP" ]]; then
  echo "WARNING: portproxy sends port $PORT to $PROXY_TARGET, but this WSL instance is $WSL_IP."
  echo "         In an elevated PowerShell: scripts\\portproxy.ps1 -WslIp $WSL_IP"
fi

echo "Advertising Expo dev server as $HOST_IP:$PORT"
export REACT_NATIVE_PACKAGER_HOSTNAME="$HOST_IP"
exec npx expo start "$@"
