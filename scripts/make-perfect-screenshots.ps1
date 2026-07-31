$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Drawing

function Build-AestheticScreenshot {
    param (
        [string]$realScreenshotPath,
        [string]$outputPath,
        [string]$titleText,
        [string]$subtitleText
    )

    $canvasWidth = 1080
    $canvasHeight = 1920

    # 1. Create Bitmap Canvas
    $bmp = New-Object System.Drawing.Bitmap($canvasWidth, $canvasHeight)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Enable High Quality Rendering
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # 2. Fill luxury dark background (#090E17)
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#090E17"))
    $g.FillRectangle($bgBrush, 0, 0, $canvasWidth, $canvasHeight)
    $bgBrush.Dispose()

    # Draw subtle emerald radial glow circle in background
    $glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(35, 16, 185, 129))
    $g.FillEllipse($glowBrush, 140, 200, 800, 800)
    $glowBrush.Dispose()

    # 3. Render Top Title Header
    $titleFont = New-Object System.Drawing.Font("Segoe UI", 36, [System.Drawing.FontStyle]::Bold)
    $subFont = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Regular)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FFFFFF"))
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#10B981"))

    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    $g.DrawString($titleText, $titleFont, $titleBrush, (New-Object System.Drawing.RectangleF(40, 80, 1000, 90)), $format)
    $g.DrawString($subtitleText, $subFont, $subBrush, (New-Object System.Drawing.RectangleF(40, 180, 1000, 60)), $format)

    # 4. Load REAL App Screenshot without stretching (maintain exact aspect ratio)
    $realImg = [System.Drawing.Image]::FromFile($realScreenshotPath)
    
    $targetFrameWidth = 920
    $aspectRatio = $realImg.Height / $realImg.Width
    $targetFrameHeight = [int]($targetFrameWidth * $aspectRatio)

    $frameX = [int](($canvasWidth - $targetFrameWidth) / 2)
    $frameY = 280

    # Draw subtle device shadow/border card
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(80, 0, 0, 0))
    $g.FillRectangle($shadowBrush, $frameX - 10, $frameY - 10, $targetFrameWidth + 20, $targetFrameHeight + 20)
    $shadowBrush.Dispose()

    # Outer phone bezel border (#1F293D)
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#1F293D"), 6)
    $g.DrawRectangle($borderPen, $frameX - 3, $frameY - 3, $targetFrameWidth + 6, $targetFrameHeight + 6)
    $borderPen.Dispose()

    # Draw REAL screenshot UN-STRETCHED
    $g.DrawImage($realImg, $frameX, $frameY, $targetFrameWidth, $targetFrameHeight)

    # 5. Cleanup & Save
    $realImg.Dispose()
    $titleFont.Dispose()
    $subFont.Dispose()
    $titleBrush.Dispose()
    $subBrush.Dispose()
    $g.Dispose()

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "Generated perfect screenshot: $outputPath"
}

Build-AestheticScreenshot `
    "C:\Users\mm_al\.gemini\antigravity-ide\brain\81bcc38c-46ea-441c-92e1-4d57ad951177\screenshot_three_1785491073511.png" `
    "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\perfect-screenshot-3.png" `
    "Comprehensive Financial Planning" `
    "Real App Interface - Financial Plan & Wealth Targets"

Build-AestheticScreenshot `
    "C:\Users\mm_al\.gemini\antigravity-ide\brain\81bcc38c-46ea-441c-92e1-4d57ad951177\screenshot_four_1785491093141.png" `
    "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\perfect-screenshot-4.png" `
    "Detailed Transactions History" `
    "Real App Interface - Transactions & Search Records"
