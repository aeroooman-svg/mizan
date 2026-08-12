Add-Type -AssemblyName System.Drawing

function Make-FloodFillSeamlessIcon($srcPath) {
    if (-not (Test-Path $srcPath)) { return }

    $srcBmp = New-Object System.Drawing.Bitmap($srcPath)
    $w = $srcBmp.Width
    $h = $srcBmp.Height

    # Create a 2D boolean array to track visited background pixels
    $visited = New-Object 'Boolean[,]' $w, $h
    $bgCol = $srcBmp.GetPixel(0, 0)
    $bgR = [int]$bgCol.R
    $bgG = [int]$bgCol.G
    $bgB = [int]$bgCol.B

    $queue = New-Object System.Collections.Generic.Queue[System.Drawing.Point]

    # Add 4 corners and outer edges to queue
    for ($x = 0; $x -lt $w; $x++) {
        $queue.Enqueue((New-Object System.Drawing.Point($x, 0)))
        $queue.Enqueue((New-Object System.Drawing.Point($x, $h - 1)))
    }
    for ($y = 0; $y -lt $h; $y++) {
        $queue.Enqueue((New-Object System.Drawing.Point(0, $y)))
        $queue.Enqueue((New-Object System.Drawing.Point($w - 1, $y)))
    }

    $dx = @(0, 0, 1, -1)
    $dy = @(1, -1, 0, 0)

    while ($queue.Count -gt 0) {
        $pt = $queue.Dequeue()
        $px = $pt.X
        $py = $pt.Y

        if ($px -lt 0 -or $px -ge $w -or $py -lt 0 -or $py -ge $h) { continue }
        if ($visited[$px, $py]) { continue }

        $curCol = $srcBmp.GetPixel($px, $py)
        $diffR = [Math]::Abs([int]$curCol.R - $bgR)
        $diffG = [Math]::Abs([int]$curCol.G - $bgG)
        $diffB = [Math]::Abs([int]$curCol.B - $bgB)
        $dist = [Math]::Sqrt($diffR*$diffR + $diffG*$diffG + $diffB*$diffB)

        # Flood fill only outer dark background pixels
        if ($dist -lt 30.0) {
            $visited[$px, $py] = $true

            for ($i = 0; $i -lt 4; $i++) {
                $nx = $px + $dx[$i]
                $ny = $py + $dy[$i]
                if ($nx -ge 0 -and $nx -lt $w -and $ny -ge 0 -and $ny -lt $h) {
                    if (-not $visited[$nx, $ny]) {
                        $queue.Enqueue((New-Object System.Drawing.Point($nx, $ny)))
                    }
                }
            }
        }
    }

    # Now create clean transparent graphic
    $cleanBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            if ($visited[$x, $y]) {
                $cleanBmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
            } else {
                $cleanBmp.SetPixel($x, $y, $srcBmp.GetPixel($x, $y))
            }
        }
    }
    $srcBmp.Dispose()

    # Function to output seamless icons with 100% uniform dark navy background (#0A1D30)
    function Output-Icon($scaleFactor, $outPath, $useDarkBg = $true) {
        $finalBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($finalBmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        if ($useDarkBg) {
            # 100% uniform dark navy background matching app theme (#0A1D30)
            $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 29, 48))
            $g.FillRectangle($bgBrush, 0, 0, $w, $h)
            $bgBrush.Dispose()
        }

        $targetW = [int]($w * $scaleFactor)
        $targetH = [int]($h * $scaleFactor)
        $offsetX = [int](($w - $targetW) / 2)
        $offsetY = [int](($h - $targetH) / 2)

        $g.DrawImage($cleanBmp, $offsetX, $offsetY, $targetW, $targetH)
        $g.Dispose()

        $tmpPath = $outPath + ".tmp.png"
        $finalBmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $finalBmp.Dispose()

        if (Test-Path $outPath) { Remove-Item -Force $outPath }
        Move-Item -Force $tmpPath $outPath
        Write-Host "Generated seamless icon: $outPath"
    }

    $cleanBmp.Save("c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\transparent-logo-clean.png", [System.Drawing.Imaging.ImageFormat]::Png)

    Output-Icon 0.76 "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\icon.png" $true
    Output-Icon 0.76 "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\splash-icon.png" $true
    Output-Icon 0.76 "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\store-icon-512.png" $true
    Output-Icon 0.70 "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\android-icon-foreground.png" $false
    Output-Icon 0.76 "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\favicon.png" $true

    $cleanBmp.Dispose()
}

Make-FloodFillSeamlessIcon "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\icon-original.png"
