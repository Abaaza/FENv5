@echo off
:: This batch file makes it easy to run the PowerShell deployment script
:: Just double-click this file to start deployment

powershell -ExecutionPolicy Bypass -File "%~dp0deploy-via-github.ps1" -Watch
pause