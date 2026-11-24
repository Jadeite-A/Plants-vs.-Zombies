Add-Type -AssemblyName System.Drawing
$f2 = 'C:\Users\22283\.cursor\projects\d-PVZ\assets\image-ec7dfab1-6382-4d52-baac-5099a5be6d15.png'
$bmp = [System.Drawing.Bitmap]::FromFile($f2)
$rect = New-Object System.Drawing.Rectangle(220, 510, 420, 117)
$crop = $bmp.Clone($rect, $bmp.PixelFormat)
$big = New-Object System.Drawing.Bitmap(1260, 351)
$g = [System.Drawing.Graphics]::FromImage($big)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.DrawImage($crop, 0, 0, 1260, 351)
# 每 30 像素画一条竖线刻度（对应原图 10px），每 150 像素画一条横线
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 255, 0, 0), 1)
for ($i = 0; $i -le 14; $i += 1) { $g.DrawLine($pen, ($i * 90), 0, ($i * 90), 351) }
$g.Dispose()
$big.Save('D:\PVZ\tools\ruler.png', [System.Drawing.Imaging.ImageFormat]::Png)
$big.Dispose(); $crop.Dispose(); $bmp.Dispose()
Write-Output "saved (红竖线间隔=原图10px，起点 x=220)"
