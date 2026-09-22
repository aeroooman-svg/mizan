Add-Type -AssemblyName System.Drawing

$targetDir = "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\store-assets"
if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$brainDir = "C:\Users\mm_al\.gemini\antigravity-ide\brain\620e0551-5018-4129-836e-e7f08230be73"

Copy-Item (Join-Path $brainDir "mizan_store_screen_1_1790037410812.jpg") (Join-Path $targetDir "1_Home_and_Wallets.jpg") -Force
Copy-Item (Join-Path $brainDir "mizan_store_screen_2_1790037426647.jpg") (Join-Path $targetDir "2_Smart_Bank_SMS.jpg") -Force
Copy-Item (Join-Path $brainDir "mizan_store_screen_3_1790037442580.jpg") (Join-Path $targetDir "3_Analytics_and_Heatmap.jpg") -Force
Copy-Item (Join-Path $brainDir "mizan_store_screen_4_1790037458865.jpg") (Join-Path $targetDir "4_Cashflow_Forecast.jpg") -Force
Copy-Item (Join-Path $brainDir "mizan_store_screen_5_1790037477999.jpg") (Join-Path $targetDir "5_Savings_and_Debts.jpg") -Force

# Resize Feature Graphic to exact 1024x500 (Google Play requirement)
$srcFg = Join-Path $brainDir "mizan_feature_graphic_1790037494364.jpg"
$img = [System.Drawing.Image]::FromFile($srcFg)
$bmp = New-Object System.Drawing.Bitmap(1024, 500)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($img, 0, 0, 1024, 500)
$img.Dispose()
$g.Dispose()

$outFg = Join-Path $targetDir "Feature_Graphic_1024x500.png"
$bmp.Save($outFg, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "SUCCESS: All 5 Screenshots and Feature Graphic ready in assets\store-assets!"
