# Darts Master Arena — buduje plik do pobrania ze strony (DartsMasterArena.html) z aktualnego app.html
# Pliki z folderu media (dźwięki, filmy, grafiki) zostają wbudowane w jeden plik HTML.
# Uruchom: dwuklik na zbuduj-strone.bat (w tym samym folderze).
$ErrorActionPreference = 'Stop'
$tools = Split-Path -Parent $MyInvocation.MyCommand.Path
$app   = Join-Path $tools '..\app.html'
$media = Join-Path $tools '..\media'
$out   = Join-Path $tools '..\..\strona-darts-master-arena\DartsMasterArena.html'
$mime  = @{ '.mp3'='audio/mpeg'; '.mp4'='video/mp4'; '.png'='image/png'; '.webp'='image/webp'; '.jpg'='image/jpeg' }
$utf8  = New-Object System.Text.UTF8Encoding($false)
$html  = [System.IO.File]::ReadAllText((Resolve-Path $app), $utf8)
$rx    = [regex]'(["''])media/([A-Za-z0-9_-]+\.(?:mp3|mp4|png|webp|jpg))(?:\?[^"'']*)?\1'
$count = 0
$eval  = [System.Text.RegularExpressions.MatchEvaluator]{
  param($m)
  $q = $m.Groups[1].Value; $name = $m.Groups[2].Value
  $path = Join-Path $media $name
  $ext = [System.IO.Path]::GetExtension($name).ToLower()
  $script:count++
  return $q + 'data:' + $mime[$ext] + ';base64,' + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Resolve-Path $path))) + $q
}
$result = $rx.Replace($html, $eval)
$outFull = [System.IO.Path]::GetFullPath($out)
[System.IO.File]::WriteAllText($outFull, $result, $utf8)
Write-Host ("Gotowe: wbudowano {0} plikow multimediow" -f $count)
Write-Host ("Zapisano: {0} ({1:N1} MB)" -f $outFull, ((Get-Item $outFull).Length / 1MB))
