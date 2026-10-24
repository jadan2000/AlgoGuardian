$ErrorActionPreference = "Stop"
$BridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $BridgeDir ".venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
    $Python = $VenvPython
} else {
    $Python = (Get-Command python.exe -ErrorAction Stop).Source
}
$Startup = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $Startup "AlgoGuardian Bridge.lnk"
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Python
$Shortcut.Arguments = "`"$BridgeDir\bridge.py`""
$Shortcut.WorkingDirectory = $BridgeDir
$Shortcut.Description = "AlgoGuardian local MT5 bridge"
$Shortcut.Save()
Write-Host "Startup shortcut created: $ShortcutPath"
Write-Host "Prototype requires Python and bridge dependencies to be installed."
