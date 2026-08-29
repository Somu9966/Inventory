WSL Testing Guide (run the app on a physical phone)
===================================================

When the backend and Expo run inside WSL2, a phone on the same WiFi cannot
reach them directly: WSL2's default NAT networking gives the distro a private
IP (e.g. `172.26.x.x`) that only the Windows host can route to.

Two things have to be true for the phone to work.

1. Windows must forward the ports into WSL
-------------------------------------------

Get your WSL IP (inside WSL):

```bash
hostname -I | awk '{print $1}'
```

Then, in an **elevated** PowerShell on Windows:

```powershell
cd C:\path\to\tyre-inventory\scripts
.\portproxy.ps1 -WslIp <that-ip>
```

**The WSL IP changes on most restarts,** so stale portproxy rules are a common
cause of "it worked yesterday". `npm start` (below) checks for this
mismatch and tells you when to re-run the script.

2. Expo must advertise the *Windows* LAN IP, not WSL's
-------------------------------------------------------

This is the failure that shows up as **"Network error" on the phone**. Plain
`npx expo start` under WSL cannot find a routable LAN address and falls back to
advertising `127.0.0.1:8081` in its manifest and QR code — so Expo Go tries to
connect to the phone itself and fails immediately.

`npm start` handles this: it detects WSL, finds the Windows LAN IP, exports
`REACT_NATIVE_PACKAGER_HOSTNAME`, and prints what it is advertising. Outside WSL
it is a plain `expo start`.

```bash
cd mobile
npm start
```

It also refuses to start if port 8081 is already taken. A leftover dev server
otherwise wins the port race and keeps serving the old config, which looks
exactly like a fix that didn't work — if you see that, run
`pkill -f 'expo start'` first.

Confirm the advertised host is your LAN IP, not `127.0.0.1`:

```bash
curl -s localhost:8081 -H 'Accept: multipart/mixed' \
  -H 'expo-platform: android' -H 'expo-protocol-version: 1' \
  | grep -o '"hostUri":"[^"]*"'
```

The app derives its API base URL from that same host (see
`mobile/src/api/client.ts`), so once Expo advertises the right address the
backend calls follow automatically — there is no IP to hardcode.

Verifying the path
------------------

From Windows (PowerShell), both should return 200:

```powershell
Invoke-WebRequest http://<WINDOWS_LAN_IP>:8081/status -UseBasicParsing
Invoke-WebRequest http://<WINDOWS_LAN_IP>:4000/health -UseBasicParsing
```

If those pass but the phone still fails, the problem is between the phone and
the router, not WSL:

- Make sure the phone is on the **same SSID/subnet** — a guest network or a
  separate band SSID often has client isolation that blocks phone→PC traffic.
- Windows marks a network as Public or Private; the `portproxy.ps1` firewall
  rules apply to any profile, but corporate/VPN policy can still override them.

Alternative: WSL mirrored networking
------------------------------------

WSL 2.0+ on Windows 11 can share the Windows network interfaces instead of
NATing, which removes the need for portproxy *and* for
`REACT_NATIVE_PACKAGER_HOSTNAME` — WSL simply has the LAN IP. Create
`C:\Users\<you>\.wslconfig`:

```ini
[wsl2]
networkingMode=mirrored
```

Then `wsl --shutdown` and reopen your terminal. You also need to allow inbound
traffic to the VM once, in elevated PowerShell:

```powershell
Set-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -DefaultInboundAction Allow
```

Mirrored mode is cleaner but can interfere with some VPN clients and Docker
setups, so it is opt-in. If you switch, remove the old rules:

```powershell
netsh interface portproxy reset
Remove-NetFirewallRule -DisplayName "WSL Forward 8081" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "WSL Forward 4000" -ErrorAction SilentlyContinue
```
