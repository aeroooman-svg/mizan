Add-Type -AssemblyName System.Drawing

function ZoomOut-Icon($srcPath, $destPath, $scaleFactor = 0.76) {
    if (Test-Path $srcPath) {
        $src = [System.Drawing.Image]::FromFile($srcPath)
        $w = $src.Width
        $h = $src.Height

        $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        # Sample background color from top-left pixel of original image
        $srcBmp = New-Object System.Drawing.Bitmap($src)
        $bgColor = $srcBmp.GetPixel(5, 5)
        $srcBmp.Dispose()

        # Fill background with exact background color
        $brush = New-Object System.Drawing.SolidBrush($bgColor)
        $g.FillRectangle($brush, 0, 0, $w, $h)
        $brush.Dispose()

        # Calculate target scaled width & height with margin/padding
        $targetW = [int]($w * $scaleFactor)
        $targetH = [int]($h * $scaleFactor)
        $offsetX = [int](($w - $targetW) / 2)
        $offsetY = [int](($h - $targetH) / 2)

        # Draw scaled icon graphic centered
        $g.DrawImage($src, $offsetX, $offsetY, $targetW, $targetH)

        $src.Dispose()
        $g.Dispose()

        $tempPath = $destPath + ".tmp.png"
        $bmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()

        if (Test-Path $destPath) {
            Remove-Item -Force $destPath
        }
        Move-Item -Force $tempPath $destPath
        Write-Host "Zoomed out icon saved cleanly to $destPath (Scale: $scaleFactor)"
    } else {
        Write-Host "Source file not found: $srcPath"
    }
}

# Run for icon.png as source
$iconPath = "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\icon.png"

# First backup original if not already backed up
$backupPath = "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\icon-original.png"
if (-not (Test-Path $backupPath)) {
    Copy-Item $iconPath $backupPath
}

ZoomOut-Icon $backupPath "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\icon.png" 0.74
ZoomOut-Icon $backupPath "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\splash-icon.png" 0.74
ZoomOut-Icon $backupPath "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\store-icon-512.png" 0.74
ZoomOut-Icon $backupPath "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\android-icon-foreground.png" 0.70
ZoomOut-Icon $backupPath "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\favicon.png" 0.74
