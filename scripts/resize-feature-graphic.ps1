Add-Type -AssemblyName System.Drawing
$srcPath = "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\feature-graphic.png"
$destPath = "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\feature-graphic-1024x500.png"

$src = [System.Drawing.Image]::FromFile($srcPath)
$bmp = New-Object System.Drawing.Bitmap(1024, 500)
$graph = [System.Drawing.Graphics]::FromImage($bmp)

$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$graph.DrawImage($src, 0, 0, 1024, 500)

$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graph.Dispose()
$bmp.Dispose()
$src.Dispose()

Write-Host "1024x500 Feature Graphic generated successfully!"
