$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$outputDir = Join-Path $projectRoot "frontend\public\images\listings"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function New-Brush($hex) {
  return New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function Draw-WindowGrid($graphics, $x, $y, $w, $h, $cols, $rows, $color) {
  $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($color), 4)
  for ($i = 1; $i -lt $cols; $i++) {
    $px = $x + ($w / $cols) * $i
    $graphics.DrawLine($pen, $px, $y, $px, $y + $h)
  }
  for ($i = 1; $i -lt $rows; $i++) {
    $py = $y + ($h / $rows) * $i
    $graphics.DrawLine($pen, $x, $py, $x + $w, $py)
  }
  $pen.Dispose()
}

function Save-ListingPhoto($fileName, $kind, $title, $accent, $accentDark) {
  $width = 1200
  $height = 760
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
  $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.ColorTranslator]::FromHtml("#f8fafc"),
    [System.Drawing.ColorTranslator]::FromHtml("#dbeafe"),
    35
  )
  $graphics.FillRectangle($background, $rect)
  $background.Dispose()

  $floor = New-Brush "#d9e2ec"
  $wall = New-Brush "#eef2f7"
  $graphics.FillRectangle($wall, 0, 0, $width, 510)
  $graphics.FillPolygon($floor, @(
    [System.Drawing.Point]::new(0, 520),
    [System.Drawing.Point]::new($width, 470),
    [System.Drawing.Point]::new($width, $height),
    [System.Drawing.Point]::new(0, $height)
  ))
  $floor.Dispose()
  $wall.Dispose()

  $accentBrush = New-Brush $accent
  $accentDarkBrush = New-Brush $accentDark
  $whiteBrush = New-Brush "#ffffff"
  $inkBrush = New-Brush "#1e293b"
  $mutedBrush = New-Brush "#64748b"
  $glassBrush = New-Brush "#c7dff7"
  $shadowBrush = New-Brush "#334155"
  $shadowBrush.Color = [System.Drawing.Color]::FromArgb(45, $shadowBrush.Color)

  switch ($kind) {
    "shop" {
      $graphics.FillRectangle($accentDarkBrush, 80, 110, 1040, 380)
      $graphics.FillRectangle($whiteBrush, 118, 158, 964, 292)
      $graphics.FillRectangle($glassBrush, 145, 185, 610, 238)
      Draw-WindowGrid $graphics 145 185 610 238 3 2 "#ffffff"
      $graphics.FillRectangle($accentBrush, 780, 185, 250, 238)
      $graphics.FillRectangle($inkBrush, 820, 250, 170, 28)
      $graphics.FillRectangle($inkBrush, 820, 306, 170, 28)
      $graphics.FillRectangle($shadowBrush, 160, 560, 880, 48)
    }
    "interior" {
      $graphics.FillRectangle($whiteBrush, 120, 120, 960, 385)
      $graphics.FillRectangle($accentBrush, 150, 150, 300, 320)
      $graphics.FillRectangle($glassBrush, 490, 150, 520, 190)
      Draw-WindowGrid $graphics 490 150 520 190 4 2 "#ffffff"
      $graphics.FillRectangle($accentDarkBrush, 510, 418, 350, 52)
      $graphics.FillRectangle($inkBrush, 200, 560, 260, 70)
      $graphics.FillRectangle($mutedBrush, 520, 560, 260, 34)
      $graphics.FillRectangle($mutedBrush, 830, 560, 160, 34)
    }
    "isp" {
      $graphics.FillRectangle($inkBrush, 160, 130, 320, 470)
      for ($i = 0; $i -lt 7; $i++) {
        $graphics.FillRectangle($accentBrush, 200, 170 + ($i * 54), 240, 34)
        $graphics.FillEllipse($whiteBrush, 220, 178 + ($i * 54), 16, 16)
        $graphics.FillEllipse($whiteBrush, 250, 178 + ($i * 54), 16, 16)
      }
      $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($accentDark), 8)
      $graphics.DrawBezier($pen, 470, 210, 650, 150, 730, 280, 900, 220)
      $graphics.DrawBezier($pen, 470, 315, 650, 430, 760, 260, 930, 355)
      $graphics.DrawBezier($pen, 470, 430, 650, 520, 820, 470, 990, 585)
      $pen.Dispose()
      $graphics.FillRectangle($glassBrush, 705, 150, 300, 440)
    }
    "office" {
      $graphics.FillRectangle($whiteBrush, 100, 110, 1000, 390)
      $graphics.FillRectangle($glassBrush, 140, 145, 360, 280)
      Draw-WindowGrid $graphics 140 145 360 280 3 3 "#ffffff"
      for ($i = 0; $i -lt 4; $i++) {
        $x = 570 + ($i * 120)
        $graphics.FillRectangle($accentBrush, $x, 360, 85, 55)
        $graphics.FillRectangle($inkBrush, $x + 34, 415, 18, 78)
      }
      $graphics.FillRectangle($accentDarkBrush, 520, 510, 470, 56)
      $graphics.FillRectangle($shadowBrush, 110, 620, 980, 52)
    }
    "electric" {
      $graphics.FillRectangle($whiteBrush, 130, 120, 900, 400)
      $graphics.FillRectangle($glassBrush, 170, 170, 300, 250)
      Draw-WindowGrid $graphics 170 170 300 250 2 2 "#ffffff"
      $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($accentDark), 12)
      $graphics.DrawLine($pen, 560, 190, 860, 190)
      $graphics.DrawLine($pen, 560, 245, 910, 245)
      $graphics.DrawLine($pen, 560, 300, 820, 300)
      $graphics.DrawLine($pen, 560, 355, 930, 355)
      $pen.Dispose()
      $graphics.FillRectangle($accentBrush, 620, 500, 170, 115)
      $graphics.FillRectangle($inkBrush, 820, 500, 170, 115)
    }
    default {
      $graphics.FillRectangle($whiteBrush, 120, 120, 960, 390)
      $graphics.FillRectangle($glassBrush, 160, 160, 430, 260)
      $graphics.FillRectangle($accentBrush, 640, 180, 330, 220)
      $graphics.FillRectangle($inkBrush, 250, 555, 700, 52)
    }
  }

  $font = New-Object System.Drawing.Font("Segoe UI", 28, [System.Drawing.FontStyle]::Bold)
  $smallFont = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
  $captionBox = New-Object System.Drawing.RectangleF(52, 40, 760, 70)
  $graphics.DrawString($title, $font, $inkBrush, $captionBox)
  $graphics.DrawString("OfficeKhoj BD verified listing photo", $smallFont, $mutedBrush, 56, 94)

  $qualityParam = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 88L)
  $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $encoderParams.Param[0] = $qualityParam
  $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
  $path = Join-Path $outputDir $fileName
  $bitmap.Save($path, $jpegCodec, $encoderParams)

  $font.Dispose()
  $smallFont.Dispose()
  $accentBrush.Dispose()
  $accentDarkBrush.Dispose()
  $whiteBrush.Dispose()
  $inkBrush.Dispose()
  $mutedBrush.Dispose()
  $glassBrush.Dispose()
  $shadowBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Save-ListingPhoto "retail-front.jpg" "shop" "Roadside Retail Shop" "#d4b466" "#8d6129"
Save-ListingPhoto "retail-floor.jpg" "shop" "Retail Floor View" "#d4b466" "#8d6129"
Save-ListingPhoto "portfolio-1.jpg" "interior" "Interior Fit-Out Package" "#8db7a5" "#42685c"
Save-ListingPhoto "portfolio-2.jpg" "interior" "Workspace Design Preview" "#8db7a5" "#42685c"
Save-ListingPhoto "isp-rack.jpg" "isp" "Business Internet Setup" "#4c6f8f" "#243244"
Save-ListingPhoto "office-floor.jpg" "office" "Small Office Floor" "#6f9fd1" "#243244"
Save-ListingPhoto "electric-team.jpg" "electric" "Electrical Setup Team" "#f0bd37" "#9b4d15"
Save-ListingPhoto "uploaded-photo.jpg" "default" "New Listing Preview" "#6f9fd1" "#243244"

Write-Output "Generated listing photos in $outputDir"
