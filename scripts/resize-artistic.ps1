Add-Type -AssemblyName System.Drawing

function Resize-Feature($srcPath, $destPath) {
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
}

Resize-Feature "C:\Users\mm_al\.gemini\antigravity-ide\brain\81bcc38c-46ea-441c-92e1-4d57ad951177\artistic_feature_graphic_v1_1785487704696.png" "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\feature-artistic-1.png"
Resize-Feature "C:\Users\mm_al\.gemini\antigravity-ide\brain\81bcc38c-46ea-441c-92e1-4d57ad951177\artistic_feature_graphic_v2_1785487724285.png" "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\feature-artistic-2.png"

Write-Host "Both 1024x500 artistic banners generated!"
