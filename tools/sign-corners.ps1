Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('D:\PVZ\assets\images\ad\pvz_goty_02.jpg')
# 四角各裁 140x140 放大 3 倍，拼成一张 2x2 便于一次看全
$corners = @(@(70, 60), @(580, 30), @(590, 440), @(90, 470))
$big = New-Object System.Drawing.Bitmap(840, 440)
$g = [System.Drawing.Graphics]::FromImage($big)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
for ($i = 0; $i -lt 4; $i++) {
  $cx = $corners[$i][0]; $cy = $corners[$i][1]
  $rect = New-Object System.Drawing.Rectangle($cx, $cy, 140, 140)
  $crop = $bmp.Clone($rect, $bmp.PixelFormat)
  $dx = ($i % 2) * 420; $dy = [Math]::Floor($i / 2) * 220
  $g.DrawImage($crop, $dx, $dy, 420, 420)
  $crop.Dispose()
}
$g.Dispose()
$big.Save('D:\PVZ\tools\corners.png', [System.Drawing.Imaging.ImageFormat]::Png)
$big.Dispose(); $bmp.Dispose()
Write-Output "saved"
