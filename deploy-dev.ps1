# Deployment script for dev.kleexck.com
$ftpUser = "dev-kleexck-ftp-svc@dev.kleexck.com"
$ftpPass = "kldhjvsdso5348097FADSAFS523b"
$ftpHost = "ftp.jhrivnak.com"
$remotePath = ""

function Upload-File {
    param($localPath, $remotePath)
    Write-Host "Uploading $localPath to $remotePath..." -ForegroundColor Yellow
    
    # Check if local file exists
    if (-not (Test-Path $localPath)) {
        Write-Host "Local file not found: $localPath" -ForegroundColor Red
        return
    }
    
    try {
        # Read file content
        $content = [System.IO.File]::ReadAllBytes($localPath)
        
        # Create FTP request
        $uri = "ftp://$ftpHost$remotePath"
        Write-Host "Attempting upload to: $uri" -ForegroundColor Yellow
        
        $request = [System.Net.FtpWebRequest]::Create($uri)
        $request.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
        $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
        $request.UsePassive = $true
        $request.UseBinary = $true
        $request.KeepAlive = $false

        # Upload file
        $stream = $request.GetRequestStream()
        $stream.Write($content, 0, $content.Length)
        $stream.Close()
        $stream.Dispose()

        Write-Host "Uploaded successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to upload: $_" -ForegroundColor Red
        Write-Host "Full error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test connection first
Write-Host "Testing FTP connection..." -ForegroundColor Cyan
try {
    $testRequest = [System.Net.FtpWebRequest]::Create("ftp://$ftpHost/")
    $testRequest.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
    $testRequest.Method = [System.Net.WebRequestMethods+Ftp]::ListDirectory
    $response = $testRequest.GetResponse()
    Write-Host "Connection successful!" -ForegroundColor Green
    $response.Close()
} catch {
    Write-Host "Connection failed: $_" -ForegroundColor Red
    exit
}

# Create and upload simpledcver.txt
Write-Host "`nCreating simpledcver.txt..." -ForegroundColor Cyan
$simpledcverContent = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJkb21haW4iOiJkZXYua2xlZXhjay5jb20iLCJleHAiOjE3MzcxNTg0MDB9.QnalljlbIjUtu1t5J8PIomHu_Tivngj502zcrgXmrOU"
$tempFile = "simpledcver.txt"
Set-Content -Path $tempFile -Value $simpledcverContent
Upload-File $tempFile "/simpledcver.txt"
Remove-Item $tempFile

# Upload backend files
Write-Host "`nUploading backend files..." -ForegroundColor Cyan
if (Test-Path "server/package.json") {
    Upload-File "server/package.json" "/package.json"
} else {
    Write-Host "package.json not found in server directory" -ForegroundColor Yellow
}

if (Test-Path "server/server.js") {
    Upload-File "server/server.js" "/server.js"
} else {
    Write-Host "server.js not found in server directory" -ForegroundColor Yellow
}

# Upload frontend files from dist to root
Write-Host "`nUploading frontend files..." -ForegroundColor Cyan
if (Test-Path "dist/kleexck") {
    Get-ChildItem "dist/kleexck" | ForEach-Object {
        Upload-File $_.FullName "/$($_.Name)"
    }
} else {
    Write-Host "dist/kleexck directory not found" -ForegroundColor Yellow
}

Write-Host "`nDeployment complete!" -ForegroundColor Green 