$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = if ($env:WEBFERRO_PREVIEW_PORT) { [int] $env:WEBFERRO_PREVIEW_PORT } else { 5173 }
$prefix = "http://localhost:$port/"

$contentTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.svg' = 'image/svg+xml'
  '.ico' = 'image/x-icon'
}

function Resolve-PreviewPath {
  param([string] $UrlPath)

  $relativePath = [Uri]::UnescapeDataString($UrlPath.TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($relativePath)) {
    $relativePath = 'preview.html'
  }

  $candidate = [IO.Path]::GetFullPath((Join-Path $root $relativePath))
  if (-not $candidate.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  if (Test-Path -LiteralPath $candidate -PathType Container) {
    $candidate = Join-Path $candidate 'preview.html'
  }

  return $candidate
}

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
$listener.Start()
Write-Host "Vista rapida disponible en $prefix"

function Write-Response {
  param(
    [Net.Sockets.NetworkStream] $Stream,
    [int] $StatusCode,
    [string] $StatusText,
    [byte[]] $Body,
    [string] $ContentType
  )

  $headers = @(
    "HTTP/1.1 $StatusCode $StatusText",
    "Content-Type: $ContentType",
    "Content-Length: $($Body.Length)",
    "Connection: close",
    "Cache-Control: no-store",
    '',
    ''
  ) -join "`r`n"

  $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  $Stream.Write($Body, 0, $Body.Length)
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 2000
      $client.SendTimeout = 5000
      $stream = $client.GetStream()
      $stream.ReadTimeout = 2000
      $stream.WriteTimeout = 5000
      $buffer = New-Object byte[] 4096
      $read = $stream.Read($buffer, 0, $buffer.Length)
      if ($read -le 0) {
        continue
      }

      $request = [Text.Encoding]::ASCII.GetString($buffer, 0, $read)
      $requestLine = ($request -split "`r?`n")[0]
      $parts = $requestLine -split ' '
      $requestPath = if ($parts.Length -ge 2) { ($parts[1] -split '\?')[0] } else { '/' }
      $filePath = Resolve-PreviewPath $requestPath

      if (-not $filePath -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        $body = [Text.Encoding]::UTF8.GetBytes('Archivo no encontrado')
        Write-Response $stream 404 'Not Found' $body 'text/plain; charset=utf-8'
        continue
      }

      $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = if ($contentTypes.ContainsKey($extension)) { $contentTypes[$extension] } else { 'application/octet-stream' }
      $body = [IO.File]::ReadAllBytes($filePath)
      Write-Response $stream 200 'OK' $body $contentType
    }
    catch {
      Write-Host "Solicitud ignorada: $($_.Exception.Message)"
    }
    finally {
      $client.Close()
    }
  }
}
finally {
  $listener.Stop()
}
