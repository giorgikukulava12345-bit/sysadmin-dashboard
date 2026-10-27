$ErrorActionPreference='Stop'
$cache=Join-Path $PSScriptRoot '../data/mikrotik-source'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
$groups=@('ethernet-routers','indoor-wireless','switches','lte-5g-products')
$urls=@{}
foreach($group in $groups){
 foreach($status in @('c','a')){
  $url="https://mikrotik.com/products/group/$($group)?f%5B0%5D=s%3A$status"
  $file=Join-Path $cache "$group-$status.html"
  Invoke-WebRequest -Uri $url -OutFile $file
  $html=[IO.File]::ReadAllText($file)
  foreach($match in [regex]::Matches($html,'href="(/product/[^"?#]+)"')){
   $path=$match.Groups[1].Value
   if(-not $urls.ContainsKey($path)){$urls[$path]=@{url="https://mikrotik.com$path";group=$group;status=$status}}
  }
 }
}
$urls.Values | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $cache 'index.json')
$urls.Keys | ForEach-Object -Parallel {
 $folder=$using:cache
 $slug=$_ -replace '/product/',''
 $target=Join-Path $folder "$slug.html"
 if(-not(Test-Path -LiteralPath $target)){
  try{Invoke-WebRequest -Uri "https://mikrotik.com$_" -OutFile $target}catch{Write-Output "FAILED $_"}
 }
} -ThrottleLimit 5
Write-Output "Downloaded $($urls.Count) official product pages."
