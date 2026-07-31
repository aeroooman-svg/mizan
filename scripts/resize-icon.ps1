Add-Type -AssemblyName System.Drawing
$srcPath = "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\icon.png"
$destPath = "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\store-icon-512.png"

$src = [System.Drawing.Image]::FromFile($srcPath)
$bmp = New-Object System.Drawing.Bitmap(512, 512)
$graph = [System.Drawing.Graphics]::FromImage($bmp)

$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$graph.DrawImage($src, 0, 0, 512, 512)

$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graph.Dispose()
$bmp.Dispose()
$src.Dispose()

Write-Host "512x512 icon generated successfully!"
