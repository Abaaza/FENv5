@echo off
echo ==========================================
echo   GitHub Deployment Setup
echo ==========================================
echo.

:: Check if GitHub CLI is installed
where gh >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ GitHub CLI is already installed
    goto :CHECK_AUTH
)

echo GitHub CLI is not installed.
echo.
echo Installing GitHub CLI...

:: Try winget first (Windows 11 / updated Windows 10)
where winget >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Using winget to install...
    winget install --id GitHub.cli --accept-package-agreements --accept-source-agreements
    if %ERRORLEVEL% EQU 0 (
        echo ✓ GitHub CLI installed successfully
        goto :CHECK_AUTH
    )
)

:: Fallback to manual download
echo.
echo Please download and install GitHub CLI manually from:
echo https://cli.github.com/
echo.
echo After installation, run this script again.
pause
exit /b 1

:CHECK_AUTH
echo.
echo Checking GitHub authentication...
gh auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo You need to authenticate with GitHub.
    echo This will open your browser for authentication.
    echo.
    pause
    gh auth login --web
    if %ERRORLEVEL% NEQ 0 (
        echo ✗ Authentication failed
        exit /b 1
    )
)

echo ✓ GitHub CLI is authenticated
echo.

:: Set up GitHub secrets
echo ==========================================
echo   Setting up GitHub Secrets
echo ==========================================
echo.
echo This will help you set up the required secrets for deployment.
echo.
echo You'll need:
echo - AWS Access Key ID
echo - AWS Secret Access Key
echo.

set /p SETUP_SECRETS="Do you want to set up GitHub secrets now? (y/n): "
if /i "%SETUP_SECRETS%"=="y" (
    echo.
    
    :: Get repository name
    for /f "tokens=*" %%i in ('gh repo view --json nameWithOwner -q .nameWithOwner') do set REPO=%%i
    echo Repository: %REPO%
    echo.
    
    :: AWS Credentials
    set /p AWS_KEY_ID="Enter AWS_ACCESS_KEY_ID: "
    gh secret set AWS_ACCESS_KEY_ID --body="%AWS_KEY_ID%"
    
    set /p AWS_SECRET="Enter AWS_SECRET_ACCESS_KEY: "
    gh secret set AWS_SECRET_ACCESS_KEY --body="%AWS_SECRET%"
    
    :: JWT Secrets (using predefined values)
    echo.
    echo Setting JWT secrets...
    gh secret set JWT_SECRET --body="8aApS-a1qfwfZOFai7QwrRq10XwhbCgbsxECg_PWV97agiiLwb_GkB_-ZCsMeKe3"
    gh secret set JWT_REFRESH_SECRET --body="cSmmxIRoS2JIGaY6v_vF2bl309IdlqNdOW15PasVAURjuI7QkqGzqSwM_HNxDk-R"
    
    :: Convex URL
    gh secret set CONVEX_URL --body="https://good-dolphin-454.convex.cloud"
    
    :: Frontend URL
    gh secret set FRONTEND_URL --body="https://main.d3j084kic0l1ff.amplifyapp.com"
    
    echo.
    echo ✓ GitHub secrets configured!
)

echo.
echo ==========================================
echo   Setup Complete!
echo ==========================================
echo.
echo You can now use the deployment scripts:
echo.
echo 1. deploy-via-github.bat - Interactive deployment menu
echo 2. deploy-via-github.ps1 - PowerShell version with more features
echo.
echo Usage examples:
echo   deploy-via-github.bat
echo   powershell -ExecutionPolicy Bypass .\deploy-via-github.ps1
echo   powershell .\deploy-via-github.ps1 -Action backend -Watch
echo.
pause