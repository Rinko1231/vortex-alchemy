param(
  [string]$InputPath = "sheet_ui.png",
  [string]$OutputDirectory = "src/assets/ui"
)

Add-Type -AssemblyName System.Drawing

$names = @(
  @("panel-frame", "timer-plate", "ribbon", "primary-button", "secondary-button", "icon-button"),
  @("icon-pause", "icon-settings", "icon-help", "icon-sound-on", "icon-sound-off", "badge-score"),
  @("badge-grail", "badge-chain", "corner-ornament", "divider", "cell-inset", "rotate-hint")
)

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$source = [System.Drawing.Bitmap]::FromFile($resolvedInput)

try {
  $columns = 6
  $rows = 3

  for ($row = 0; $row -lt $rows; $row++) {
    for ($column = 0; $column -lt $columns; $column++) {
      $left = [int][Math]::Round(($column * $source.Width) / $columns)
      $right = [int][Math]::Round((($column + 1) * $source.Width) / $columns)
      $top = [int][Math]::Round(($row * $source.Height) / $rows)
      $bottom = [int][Math]::Round((($row + 1) * $source.Height) / $rows)

      $cellWidth = $right - $left
      $cellHeight = $bottom - $top
      $cell = New-Object System.Drawing.Bitmap($cellWidth, $cellHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $graphics = [System.Drawing.Graphics]::FromImage($cell)
      $graphics.DrawImage(
        $source,
        (New-Object System.Drawing.Rectangle(0, 0, $cellWidth, $cellHeight)),
        (New-Object System.Drawing.Rectangle($left, $top, $cellWidth, $cellHeight)),
        [System.Drawing.GraphicsUnit]::Pixel
      )
      $graphics.Dispose()

      $minX = $cellWidth
      $minY = $cellHeight
      $maxX = -1
      $maxY = -1
      $horizontalInset = 16
      $topInset = if ($row -eq 1) { 44 } else { 16 }
      $bottomInset = 12

      for ($y = $topInset; $y -lt ($cellHeight - $bottomInset); $y++) {
        for ($x = $horizontalInset; $x -lt ($cellWidth - $horizontalInset); $x++) {
          if ($cell.GetPixel($x, $y).A -gt 4) {
            if ($x -lt $minX) { $minX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -gt $maxY) { $maxY = $y }
          }
        }
      }

      if ($maxX -ge $minX -and $maxY -ge $minY) {
        $padding = 6
        $cropLeft = [Math]::Max(0, $minX - $padding)
        $cropTop = [Math]::Max(0, $minY - $padding)
        $cropRight = [Math]::Min($cellWidth - 1, $maxX + $padding)
        $cropBottom = [Math]::Min($cellHeight - 1, $maxY + $padding)
        $cropWidth = $cropRight - $cropLeft + 1
        $cropHeight = $cropBottom - $cropTop + 1

        $result = New-Object System.Drawing.Bitmap($cropWidth, $cropHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $resultGraphics = [System.Drawing.Graphics]::FromImage($result)
        $resultGraphics.DrawImage(
          $cell,
          (New-Object System.Drawing.Rectangle(0, 0, $cropWidth, $cropHeight)),
          (New-Object System.Drawing.Rectangle($cropLeft, $cropTop, $cropWidth, $cropHeight)),
          [System.Drawing.GraphicsUnit]::Pixel
        )
        $resultGraphics.Dispose()

        $name = $names[$row][$column]
        $outputPath = Join-Path $OutputDirectory "$name.png"
        $result.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $result.Dispose()
      }

      $cell.Dispose()
    }
  }
}
finally {
  $source.Dispose()
}
