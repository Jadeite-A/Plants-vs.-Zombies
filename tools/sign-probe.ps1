Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('D:\PVZ\assets\images\ad\pvz_goty_02.jpg')
# 全图缩到 1:1 已看过，这次在图上叠加网格线（每 50px 一条），便于目测四角坐标
$g = [System.Drawing.Graphics]::FromImage($bmp)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 255, 0, 255), 1)
for ($x = 50; $x -lt 800; $x += 50) { $g.DrawLine($pen, $x, 0, $x, 600) }
for ($y = 50; $y -lt 600; $y += 50) { $g.DrawLine($pen, 0, $y, 800, $y) }
$g.Dispose()
$bmp.Save('D:\PVZ\tools\grid.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "saved"
