Add-Type -AssemblyName System.Drawing

function Resize-Image916($srcPath, $destPath) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $bmp = New-Object System.Drawing.Bitmap(1080, 1920)
    $graph = [System.Drawing.Graphics]::FromImage($bmp)

    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $graph.DrawImage($src, 0, 0, 1080, 1920)

    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $graph.Dispose()
    $bmp.Dispose()
    $src.Dispose()
}

Resize-Image916 "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\screenshot-1.png" "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\screenshot-1-1080x1920.png"
Resize-Image916 "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\screenshot-2.png" "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\screenshot-2-1080x1920.png"

Write-Host "1080x1920 9:16 screenshots generated successfully!"
