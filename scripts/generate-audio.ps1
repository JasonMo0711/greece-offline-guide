$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$textDir = Join-Path $root "assets\audio\narration-text"
$audioDir = Join-Path $root "assets\audio\paragraphs-v2"
$voice = New-Object -ComObject SAPI.SpVoice
$voice.Voice = $voice.GetVoices().Item(0)
$voice.Rate = 0
$voice.Volume = 100
$files = Get-ChildItem -LiteralPath $textDir -Recurse -Filter "*.txt" | Sort-Object FullName
$count = 0
foreach ($file in $files) {
  $relative = $file.FullName.Substring($textDir.Length).TrimStart("\")
  $output = Join-Path $audioDir ([IO.Path]::ChangeExtension($relative, ".wav"))
  $parent = Split-Path -Parent $output
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  $text = (Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8) -replace "\r?\n+", " "
  $stream = New-Object -ComObject SAPI.SpFileStream
  $stream.Format.Type = 6
  $stream.Open($output, 3, $false)
  $voice.AudioOutputStream = $stream
  [void]$voice.Speak($text, 0)
  $stream.Close()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($stream) | Out-Null
  $count++
  if ($count % 20 -eq 0) { Write-Output ("[{0}/{1}]" -f $count, $files.Count) }
}
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($voice) | Out-Null
Write-Output ("逐站离线中文音频生成完成：{0} 个文件。" -f $count)


