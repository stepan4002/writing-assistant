# Writing Assistant - one-line installer for Windows 10/11
#
#   irm https://raw.githubusercontent.com/stepan4002/writing-assistant/main/install.ps1 | iex
#
# Downloads the latest WritingAssistant-Setup.exe from GitHub Releases, installs it
# silently for the current user (no admin rights), and starts the app.
#
# Optional environment variables:
#   WA_NO_START=1    do not launch the app after installing
#   WA_UNINSTALL=1   uninstall instead (your saved text in %APPDATA%\Writing Assistant is kept)
#   WA_SETUP=<path>  install from a local setup .exe instead of downloading
#
# This file is ASCII-only on purpose so Windows PowerShell 5.1 parses it correctly.

function Install-WritingAssistant {
    $ErrorActionPreference = 'Stop'
    $Url = 'https://github.com/stepan4002/writing-assistant/releases/latest/download/WritingAssistant-Setup.exe'
    $Name = 'Writing Assistant'

    function Find-Uninstaller {
        $keys = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
        Get-ItemProperty $keys -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -like "$Name*" } |
            Select-Object -First 1
    }

    if ($env:WA_UNINSTALL -eq '1') {
        $entry = Find-Uninstaller
        if (-not $entry) { Write-Host "$Name is not installed for this user." -ForegroundColor Yellow; return }
        Get-Process -Name $Name -ErrorAction SilentlyContinue | Stop-Process -Force
        $cmd = ($entry.QuietUninstallString, $entry.UninstallString | Where-Object { $_ } | Select-Object -First 1)
        $exe = ($cmd -replace '^"([^"]+)".*$', '$1')
        Write-Host "==> Uninstalling $Name" -ForegroundColor Cyan
        Start-Process -FilePath $exe -ArgumentList '/S', '/currentuser' -Wait
        Write-Host "$Name was uninstalled." -ForegroundColor Green
        return
    }

    $setup = $env:WA_SETUP
    $downloaded = $false
    if (-not $setup) {
        $setup = Join-Path ([IO.Path]::GetTempPath()) 'WritingAssistant-Setup.exe'
        Write-Host "==> Downloading $Name (~120 MB)" -ForegroundColor Cyan
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $setup
        $downloaded = $true
    }

    try {
        Get-Process -Name $Name -ErrorAction SilentlyContinue | Stop-Process -Force
        Write-Host "==> Installing for this user (no admin needed)" -ForegroundColor Cyan
        $p = Start-Process -FilePath $setup -ArgumentList '/S', '/currentuser' -Wait -PassThru
        if ($p.ExitCode -ne 0) { throw "The installer exited with code $($p.ExitCode)." }
    } finally {
        if ($downloaded) { Remove-Item $setup -Force -ErrorAction SilentlyContinue }
    }

    $entry = Find-Uninstaller
    $exePath = $null
    if ($entry -and $entry.InstallLocation) { $exePath = Join-Path $entry.InstallLocation "$Name.exe" }
    if (-not $exePath -or -not (Test-Path $exePath)) { $exePath = Join-Path $env:LOCALAPPDATA "Programs\writing-assistant\$Name.exe" }

    Write-Host ''
    Write-Host "$Name is installed. Find it in the Start menu or on your desktop." -ForegroundColor Green
    Write-Host '  - Spelling and grammar work offline right away.'
    Write-Host '  - Optional AI style suggestions: install Ollama (https://ollama.com) - the app guides you.'
    if ($env:WA_NO_START -ne '1' -and (Test-Path $exePath)) {
        Start-Process -FilePath $exePath
    }
}

try {
    Install-WritingAssistant
} catch {
    Write-Host "Writing Assistant install failed: $($_.Exception.Message)" -ForegroundColor Red
}
