param(
  [string]$InputDirectory = "src/assets/ui",
  [string]$OutputPath = "tmp/ui-contact.png"
)

Add-Type -AssemblyName System.Drawing

$names = @(
  @("panel-frame", "timer-plate", "ribbon", "primary-button", "secondary-button", "icon-button"),
  @("icon-pause", "icon-settings", "icon-help", "icon-sound-on", "icon-sound-off", "badge-score"),
  @("badge-grail", "badge-chain", "corner-ornament", "divider", "cell-inset", "rotate-hint")
)

$tile = 220
$padding = 12
$sheetWidth = [int](($tile + $padding) * 6)
$sheetHeight = [int](($tile + $padding) * 3)
$sheet = [System.Drawing.Bitmap]::new(
  $sheetWidth,
  $sheetHeight,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
$graphics.Clear([System.Drawing.Color]::FromArgb(255, 42, 26, 54))
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

for ($row = 0; $row -lt 3; $row++) {
  for ($column = 0; $column -lt 6; $column++) {
    $path = Join-Path $InputDirectory ("{0}.png" -f $names[$row][$column])
    $image = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $path).Path)
    $scale = [Math]::Min(($tile - 10) / $image.Width, ($tile - 10) / $image.Height)
    $width = [int]($image.Width * $scale)
    $height = [int]($image.Height * $scale)
    $x = [int]($column * ($tile + $padding) + (($tile - $width) / 2))
    $y = [int]($row * ($tile + $padding) + (($tile - $height) / 2))
    $graphics.DrawImage($image, $x, $y, $width, $height)
    $image.Dispose()
  }
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}
$sheet.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$sheet.Dispose()
