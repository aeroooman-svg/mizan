Add-Type -AssemblyName System.Drawing

function Reencode-Png($filePath) {
    if (Test-Path $filePath) {
        $img = [System.Drawing.Image]::FromFile($filePath)
        $bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.DrawImage($img, 0, 0, $img.Width, $img.Height)
        $img.Dispose()
        $g.Dispose()

        $tempPath = $filePath + ".tmp.png"
        $bmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()

        Remove-Item -Force $filePath
        Move-Item -Force $tempPath $filePath
        Write-Host "Re-encoded cleanly: $filePath"
    } else {
        Write-Host "File not found: $filePath"
    }
}

Reencode-Png "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\icon.png"
Reencode-Png "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\splash-icon.png"
Reencode-Png "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\android-icon-foreground.png"
Reencode-Png "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\android-icon-monochrome.png"
Reencode-Png "c:\Users\mm_al\OneDrive\Desktop\Daily-Expense-Tracker\assets\images\favicon.png"
