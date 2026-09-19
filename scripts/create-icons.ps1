Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "assets\icons"
New-Item -ItemType Directory -Force -Path $out | Out-Null
function New-GuideIcon([int]$size, [string]$name, [bool]$maskable) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(18,76,90))
  $scale = $size / 512.0
  $safe = if ($maskable) { 72 * $scale } else { 26 * $scale }
  $seaBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(207,230,224))
  $sunBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(240,202,111))
  $stoneBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(247,239,215))
  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40,20,45,48))
  $graphics.FillEllipse($sunBrush, 338 * $scale, 94 * $scale, 104 * $scale, 104 * $scale)
  $graphics.FillRectangle($shadowBrush, $safe, 386 * $scale, ($size - 2 * $safe), 22 * $scale)
  $graphics.FillPolygon($stoneBrush, [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(($size * .5), 110 * $scale),
    [System.Drawing.PointF]::new(($size * .88), 186 * $scale),
    [System.Drawing.PointF]::new(($size * .12), 186 * $scale)
  ))
  $graphics.FillRectangle($stoneBrush, 134 * $scale, 178 * $scale, 244 * $scale, 24 * $scale)
  foreach ($x in @(150,216,282,348)) {
    $graphics.FillRectangle($stoneBrush, $x * $scale, 198 * $scale, 34 * $scale, 164 * $scale)
  }
  $graphics.FillRectangle($stoneBrush, 124 * $scale, 356 * $scale, 264 * $scale, 22 * $scale)
  $wavePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(184,224,219), 14 * $scale)
  $wavePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $wavePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  foreach ($y in @(420,456)) {
    $graphics.DrawArc($wavePen, 112 * $scale, $y * $scale, 288 * $scale, 42 * $scale, 200, 140)
  }
  $bitmap.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $wavePen.Dispose(); $seaBrush.Dispose(); $sunBrush.Dispose(); $stoneBrush.Dispose(); $shadowBrush.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
New-GuideIcon 192 "icon-192.png" $false
New-GuideIcon 512 "icon-512.png" $false
New-GuideIcon 512 "maskable-512.png" $true
Write-Output "PWA 图标已生成。"

