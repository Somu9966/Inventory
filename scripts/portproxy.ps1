<#
PowerShell script to forward ports from Windows host to WSL IP.
Run this in an elevated PowerShell (Run as Administrator).

Usage (replace <WSL_IP>):
  .\portproxy.ps1 -WslIp 172.26.x.x

This will forward ports 8081 (Expo) and 4000 (backend) from the Windows host
to the WSL IP so physical devices on the LAN can reach them via the Windows
machine IP.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$WslIp
)

Write-Host "Setting up portproxy to forward to WSL IP: $WslIp"

function Add-ProxyRule($listenPort, $connectPort) {
    Write-Host "Adding proxy: 0.0.0.0:$listenPort -> $WslIp:$connectPort"
    netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$listenPort connectaddress=$WslIp connectport=$connectPort
    New-NetFirewallRule -DisplayName "WSL Forward $listenPort" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $listenPort -ErrorAction SilentlyContinue | Out-Null
}

Add-ProxyRule -listenPort 8081 -connectPort 8081
Add-ProxyRule -listenPort 4000 -connectPort 4000

Write-Host "Done. You can now use your Windows LAN IP on phones to reach Expo (8081) and backend (4000)."
