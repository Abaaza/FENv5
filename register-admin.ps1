Write-Host "Registering admin user via API..." -ForegroundColor Yellow

$body = @{
    email = "admin@mjd.com"
    password = "admin123"
    name = "Admin User"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://13.218.146.247/api/auth/register" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -SkipCertificateCheck
    
    Write-Host "✓ Admin user registered successfully!" -ForegroundColor Green
    Write-Host "User ID: $($response.user._id)" -ForegroundColor Gray
    Write-Host "Email: $($response.user.email)" -ForegroundColor Gray
    Write-Host "Token received: $(if($response.accessToken) {'Yes'} else {'No'})" -ForegroundColor Gray
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "User already exists - trying to login..." -ForegroundColor Yellow
        
        # Try login instead
        try {
            $loginResponse = Invoke-RestMethod -Uri "https://13.218.146.247/api/auth/login" `
                -Method POST `
                -Body $body `
                -ContentType "application/json" `
                -SkipCertificateCheck
            
            Write-Host "✓ Login successful!" -ForegroundColor Green
            Write-Host "User: $($loginResponse.user.email)" -ForegroundColor Gray
        } catch {
            Write-Host "✗ Login failed: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ Registration failed: $_" -ForegroundColor Red
    }
}

Write-Host "`nYou can now login at: https://main.d3j084kic0l1ff.amplifyapp.com/login" -ForegroundColor Cyan
Write-Host "Email: admin@mjd.com" -ForegroundColor White
Write-Host "Password: admin123" -ForegroundColor White