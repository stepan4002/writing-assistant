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

    # Windows may briefly refuse to run a brand-new unsigned .exe ("Access is denied")
    # while antivirus scans it on first launch. Retry a few times before giving up.
    function Start-WithRetry([string]$File, [string[]]$Arguments, [switch]$Wait) {
        for ($i = 1; $i -le 6; $i++) {
            try {
                $params = @{ FilePath = $File; ErrorAction = 'Stop' }
                if ($Arguments) { $params.ArgumentList = $Arguments }
                if ($Wait) { $params.Wait = $true; $params.PassThru = $true }
                return Start-Process @params
            } catch {
                if ($i -eq 6) { throw }
                Write-Host "    Windows is still checking the file, retrying in 5 s ($i/5)..." -ForegroundColor DarkGray
                Start-Sleep -Seconds 5
            }
        }
    }

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
        $p = Start-WithRetry -File $setup -Arguments '/S', '/currentuser' -Wait
        if ($p.ExitCode -ne 0) { throw "The installer exited with code $($p.ExitCode)." }
    } finally {
        if ($downloaded) { Remove-Item $setup -Force -ErrorAction SilentlyContinue }
    }

    # The uninstaller sits in the install folder, next to the app's .exe.
    $entry = Find-Uninstaller
    $exePath = $null
    if ($entry -and $entry.UninstallString) {
        $uninstaller = ($entry.UninstallString -replace '^"([^"]+)".*$', '$1')
        $exePath = Join-Path (Split-Path $uninstaller -Parent) "$Name.exe"
    }

    Write-Host ''
    Write-Host "$Name is installed. Find it in the Start menu or on your desktop." -ForegroundColor Green
    Write-Host '  - Spelling and grammar work offline right away.'
    Write-Host '  - Optional AI style suggestions: install Ollama (https://ollama.com) - the app guides you.'
    if ($env:WA_NO_START -ne '1' -and $exePath -and (Test-Path $exePath)) {
        try {
            Start-WithRetry -File $exePath | Out-Null
        } catch {
            Write-Host "  - Could not start it automatically; open Writing Assistant from the Start menu." -ForegroundColor Yellow
        }
    }
}

try {
    Install-WritingAssistant
} catch {
    Write-Host "Writing Assistant install failed: $($_.Exception.Message)" -ForegroundColor Red
}
