Add-Type -AssemblyName System.Drawing
$f1 = 'C:\Users\22283\.cursor\projects\d-PVZ\assets\image-ec7dfab1-6382-4d52-baac-5099a5be6d15.png'
$f2 = 'C:\Users\22283\.cursor\projects\d-PVZ\assets\image-21d5962c-0387-4fa4-98b2-198df5497b00.png'
$f3 = 'C:\Users\22283\.cursor\projects\d-PVZ\assets\image-bd346379-aff6-43b6-8349-832e6ac0d5c7.png'
foreach ($f in @($f1, $f2, $f3)) {
  $bmp = [System.Drawing.Bitmap]::FromFile($f)
  Write-Output ("== {0} ({1}x{2})" -f (Split-Path $f -Leaf), $bmp.Width, $bmp.Height)
  foreach ($y in @(545, 555, 565, 575, 585, 595)) {
    $run = 0; $best = 0; $bestStart = -1; $start = 0
    for ($x = 100; $x -lt 750; $x += 1) {
      $c = $bmp.GetPixel($x, $y)
      $brown = ($c.R -ge 100) -and ($c.R -le 205) -and ($c.G -ge 50) -and ($c.G -le 130) -and ($c.B -ge 10) -and ($c.B -le 90) -and ($c.R -gt $c.G) -and ($c.G -gt $c.B)
      if ($brown) {
        if ($run -eq 0) { $start = $x }
        $run = $run + 1
        if ($run -gt $best) { $best = $run; $bestStart = $start }
      } else { $run = 0 }
    }
    Write-Output ("y={0}  x {1}..{2}  len {3}" -f $y, $bestStart, ($bestStart + $best), $best)
  }
  $bmp.Dispose()
}
