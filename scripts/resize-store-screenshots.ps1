Add-Type -AssemblyName System.Drawing

function Resize-StoreScreenshot($srcPath, $destPath) {
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

Resize-StoreScreenshot "C:\Users\mm_al\.gemini\antigravity-ide\brain\81bcc38c-46ea-441c-92e1-4d57ad951177\app_store_screenshot_1_1785490317538.png" "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\store-screenshot-1.png"
Resize-StoreScreenshot "C:\Users\mm_al\.gemini\antigravity-ide\brain\81bcc38c-46ea-441c-92e1-4d57ad951177\app_store_screenshot_2_1785490338052.png" "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\store-screenshot-2.png"
Resize-StoreScreenshot "C:\Users\mm_al\.gemini\antigravity-ide\brain\81bcc38c-46ea-441c-92e1-4d57ad951177\app_store_screenshot_3_1785490357544.png" "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\store-screenshot-3.png"
Resize-StoreScreenshot "C:\Users\mm_al\.gemini\antigravity-ide\brain\81bcc38c-46ea-441c-92e1-4d57ad951177\app_store_screenshot_4_1785490377018.png" "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\store-screenshot-4.png"

Write-Host "All 4 1080x1920 App Store screenshots generated successfully!"
