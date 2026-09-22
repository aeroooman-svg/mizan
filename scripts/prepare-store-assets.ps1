Add-Type -AssemblyName System.Drawing

$destDir = "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\store-assets"
if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

$files = @(
    @{ Src = "C:\Users\mm_al\.gemini\antigravity-ide\brain\620e0551-5018-4129-836e-e7f08230be73\mizan_app_store_1_1790117345507.jpg"; Dest = "$destDir\1_Home_and_Wallets.jpg" },
    @{ Src = "C:\Users\mm_al\.gemini\antigravity-ide\brain\620e0551-5018-4129-836e-e7f08230be73\mizan_app_store_2_1790117372791.jpg"; Dest = "$destDir\2_Smart_Bank_SMS.jpg" },
    @{ Src = "C:\Users\mm_al\.gemini\antigravity-ide\brain\620e0551-5018-4129-836e-e7f08230be73\mizan_app_store_3_1790117404098.jpg"; Dest = "$destDir\3_Analytics_and_Heatmap.jpg" },
    @{ Src = "C:\Users\mm_al\.gemini\antigravity-ide\brain\620e0551-5018-4129-836e-e7f08230be73\mizan_app_store_4_1790117437935.jpg"; Dest = "$destDir\4_Zakat_Calculator.jpg" },
    @{ Src = "C:\Users\mm_al\.gemini\antigravity-ide\brain\620e0551-5018-4129-836e-e7f08230be73\mizan_app_store_5_1790117474870.jpg"; Dest = "$destDir\5_Gamification_and_Goals.jpg" }
)

foreach ($f in $files) {
    Copy-Item -Path $f.Src -Destination $f.Dest -Force
    Write-Host "Copied: $($f.Dest)"
}

# Resize Feature Graphic to exact 1024x500 for Google Play
$bannerSrc = "C:\Users\mm_al\.gemini\antigravity-ide\brain\620e0551-5018-4129-836e-e7f08230be73\mizan_store_banner_pro_1790117516495.jpg"
$bannerDest = "$destDir\Feature_Graphic_1024x500.png"

$orig = [System.Drawing.Image]::FromFile($bannerSrc)
$resized = New-Object System.Drawing.Bitmap 1024, 500
$graph = [System.Drawing.Graphics]::FromImage($resized)
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graph.DrawImage($orig, 0, 0, 1024, 500)
$orig.Dispose()
$graph.Dispose()
$resized.Save($bannerDest, [System.Drawing.Imaging.ImageFormat]::Png)
$resized.Dispose()

Write-Host "Feature Graphic generated at: $bannerDest (1024x500 PNG)"
