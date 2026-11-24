# measure2.ps1 - safe-name pixel measurement for original screenshots.
# -Path <png> [-Clip "gx0,gy0,gx1,gy1"] [-HLines "y,y,.."] [-VLines "x,x,.."]
# Prints color-run segments (S=stone G=green D=dark .=other) in GAME coords,
# plus color-class bboxes and clusters inside the clip.
param([string]$Path, [string]$Clip = "", [string]$HLines = "", [string]$VLines = "")

Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap($Path)
$W = $bmp.Width; $H = $bmp.Height
$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = New-Object byte[] ($data.Stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$stride = $data.Stride
$bmp.UnlockBits($data); $bmp.Dispose()

function Kind($rr, $gg, $bb) {
  if ($gg -gt 150 -and $gg -gt $rr + 60) { return "G" }
  if ($rr -gt 85 -and $rr -lt 215 -and $gg -gt 80 -and $bb -gt 100 -and ($bb - $gg) -gt 6) { return "S" }
  if ([Math]::Max($rr, [Math]::Max($gg, $bb)) -lt 78) { return "D" }
  return "."
}

# ---- client area ----
$cntX = New-Object int[] $W
$cntY = New-Object int[] $H
for ($iy = 0; $iy -lt $H; $iy++) {
  $base = $iy * $stride
  for ($ix = 0; $ix -lt $W; $ix++) {
    $i = $base + $ix * 4
    $rr = [int]$bytes[$i + 2]; $gg = [int]$bytes[$i + 1]; $bb = [int]$bytes[$i]
    $mx = [Math]::Max($rr, [Math]::Max($gg, $bb))
    $mn = [Math]::Min($rr, [Math]::Min($gg, $bb))
    if (($mx - $mn -gt 40) -or ($mx -lt 60)) { $cntX[$ix]++; $cntY[$iy]++ }
  }
}
$cL = 0; while ($cL -lt $W -and $cntX[$cL] -lt $H * 0.5) { $cL++ }
$cR = $W - 1; while ($cR -gt 0 -and $cntX[$cR] -lt $H * 0.5) { $cR-- }
$cT = 0; while ($cT -lt $H -and $cntY[$cT] -lt $W * 0.5) { $cT++ }
$cB = $H - 1; while ($cB -gt 0 -and $cntY[$cB] -lt $W * 0.5) { $cB-- }
$scale = ($cR - $cL + 1.0) / 800.0
Write-Output ("content L={0} T={1} R={2} B={3} scale={4:N4}" -f $cL, $cT, $cR, $cB, ($cR - $cL + 1), ($cB - $cT + 1), $scale)

# ---- clip ----
$cx0 = 0.0; $cy0 = 0.0; $cx1 = 800.0; $cy1 = 600.0
if ($Clip -ne "") {
  $pp = $Clip.Split(",")
  $cx0 = [double]$pp[0]; $cy0 = [double]$pp[1]; $cx1 = [double]$pp[2]; $cy1 = [double]$pp[3]
}
$qx0 = [int][math]::Floor($cL + $cx0 * $scale)
$qy0 = [int][math]::Floor($cT + $cy0 * $scale)
$qx1 = [int][math]::Ceiling($cL + $cx1 * $scale)
$qy1 = [int][math]::Ceiling($cT + $cy1 * $scale)

# ---- classify inside clip ----
$stoneX = New-Object System.Collections.Generic.List[double]; $stoneY = New-Object System.Collections.Generic.List[double]
$blackX = New-Object System.Collections.Generic.List[double]; $blackY = New-Object System.Collections.Generic.List[double]
$greenX = New-Object System.Collections.Generic.List[double]; $greenY = New-Object System.Collections.Generic.List[double]
$goldX = New-Object System.Collections.Generic.List[double]; $goldY = New-Object System.Collections.Generic.List[double]
for ($iy = $qy0; $iy -le $qy1; $iy++) {
  $base = $iy * $stride
  for ($ix = $qx0; $ix -le $qx1; $ix++) {
    $i = $base + $ix * 4
    $rr = [int]$bytes[$i + 2]; $gg = [int]$bytes[$i + 1]; $bb = [int]$bytes[$i]
    $gx = ($ix - $cL) / $scale; $gy = ($iy - $cT) / $scale
    if ($gg -gt 170 -and $rr -lt 140 -and $bb -lt 160) { $greenX.Add($gx); $greenY.Add($gy); continue }
    if ($rr -gt 190 -and $gg -gt 150 -and $bb -lt 120) { $goldX.Add($gx); $goldY.Add($gy); continue }
    $mx = [Math]::Max($rr, [Math]::Max($gg, $bb))
    if ($mx -lt 70) { $blackX.Add($gx); $blackY.Add($gy); continue }
    if ($rr -gt 95 -and $rr -lt 200 -and $gg -gt 90 -and $bb -gt 120 -and ($bb - $gg) -gt 10) { $stoneX.Add($gx); $stoneY.Add($gy) }
  }
}
function BBox($xs, $ys, $tag) {
  if ($xs.Count -eq 0) { Write-Output ("{0,-6}: none" -f $tag); return }
  $x0 = ($xs | Measure-Object -Min).Minimum; $xx = ($xs | Measure-Object -Max).Maximum
  $y0 = ($ys | Measure-Object -Min).Minimum; $yy = ($ys | Measure-Object -Max).Maximum
  Write-Output ("{0,-6}: x {1}..{2}  y {3}..{4}  (w={5} h={6}) n={7}" -f $tag, [math]::Round($x0, 1), [math]::Round($xx, 1), [math]::Round($y0, 1), [math]::Round($yy, 1), [math]::Round($xx - $x0, 1), [math]::Round($yy - $y0, 1), $xs.Count)
}
BBox $stoneX $stoneY "STONE"
BBox $blackX $blackY "BLACK"
BBox $greenX $greenY "GREEN"
BBox $goldX $goldY "GOLD"

# ---- clusters ----
function Cluster($xs, $ys, $gapX, $gapY, $tag) {
  if ($xs.Count -eq 0) { return }
  $pairs = New-Object System.Collections.Generic.List[object]
  for ($ii = 0; $ii -lt $xs.Count; $ii++) { $pairs.Add([pscustomobject]@{ x = $xs[$ii]; y = $ys[$ii] }) }
  $sorted = $pairs | Sort-Object x
  $cols = New-Object System.Collections.Generic.List[object]
  $cur = $null
  foreach ($p in $sorted) {
    if ($null -eq $cur -or ($p.x - $cur.x1) -gt $gapX) {
      $cur = [pscustomobject]@{ x0 = $p.x; x1 = $p.x; pts = New-Object System.Collections.Generic.List[object] }
      $cols.Add($cur)
    }
    if ($p.x -gt $cur.x1) { $cur.x1 = $p.x }
    $cur.pts.Add($p)
  }
  $n = 0
  foreach ($c in $cols) {
    $n++
    if ($c.pts.Count -lt 10) { continue }
    $byY = $c.pts | Sort-Object y
    $rows = New-Object System.Collections.Generic.List[object]
    $rw = $null
    foreach ($p in $byY) {
      if ($null -eq $rw -or ($p.y - $rw.y1) -gt $gapY) {
        $rw = [pscustomobject]@{ y0 = $p.y; y1 = $p.y; n = 0 }
        $rows.Add($rw)
      }
      if ($p.y -gt $rw.y1) { $rw.y1 = $p.y }
      $rw.n++
    }
    $desc = ($rows | ForEach-Object { "y {0}..{1}({2})" -f [math]::Round($_.y0, 1), [math]::Round($_.y1, 1), $_.n }) -join " | "
    Write-Output ("{0} col{1}: x {2}..{3} (w={4})  rows: {5}" -f $tag, $n, [math]::Round($c.x0, 1), [math]::Round($c.x1, 1), [math]::Round($c.x1 - $c.x0, 1), $desc)
  }
}
Cluster $greenX $greenY 40 12 "GREEN"
Cluster $goldX $goldY 25 10 "GOLD"

# ---- run scans ----
function ScanRuns([double]$fixed, [bool]$isH) {
  $segs = New-Object System.Collections.Generic.List[string]
  $curKind = ""; $curStart = 0
  $lim = 800; if (-not $isH) { $lim = 600 }
  for ($tt = 0; $tt -lt $lim; $tt++) {
    if ($isH) { $sx = $cL + [int]($tt * $scale); $sy = $cT + [int]($fixed * $scale) }
    else { $sx = $cL + [int]($fixed * $scale); $sy = $cT + [int]($tt * $scale) }
    if ($sx -lt 0 -or $sx -gt $W - 1 -or $sy -lt 0 -or $sy -gt $H - 1) { $kk = "." }
    else {
      $i = $sy * $stride + $sx * 4
      $kk = Kind ([int]$bytes[$i + 2]) ([int]$bytes[$i + 1]) ([int]$bytes[$i])
    }
    if ($kk -ne $curKind) {
      if ($curKind -ne "" -and $curKind -ne "." -and ($tt - 1 - $curStart) -ge 5) {
        $segs.Add(("{0} {1}..{2}" -f $curKind, $curStart, ($tt - 1)))
      }
      $curKind = $kk; $curStart = $tt
    }
  }
  if ($curKind -ne "" -and $curKind -ne ".") { $segs.Add(("{0} {1}..{2}" -f $curKind, $curStart, ($lim - 1))) }
  $lbl = "row y=" + $fixed; if (-not $isH) { $lbl = "col x=" + $fixed }
  Write-Output ("{0}:  {1}" -f $lbl, ($segs -join "  "))
}
foreach ($v in $HLines.Split(",")) { if ($v -ne "") { ScanRuns ([double]$v) $true } }
foreach ($v in $VLines.Split(",")) { if ($v -ne "") { ScanRuns ([double]$v) $false } }
