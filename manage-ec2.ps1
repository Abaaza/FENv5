# EC2 Management Script for Windows PowerShell
# Manage your EC2 deployment

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("status", "start", "stop", "restart", "logs", "ssh", "update", "costs", "terminate")]
    [string]$Command,
    
    [string]$Additional
)

function Get-InstanceInfo {
    $instances = aws ec2 describe-instances `
        --filters "Name=tag:Name,Values=BOQ-Matching-Server" `
        --query 'Reservations[*].Instances[*]' `
        --output json | ConvertFrom-Json
    
    return $instances
}

function Get-RunningInstance {
    $instances = Get-InstanceInfo
    $running = $instances | Where-Object { $_.State.Name -eq "running" } | Select-Object -First 1
    return $running
}

function Show-Status {
    Write-Host "`nEC2 Instance Status:" -ForegroundColor Cyan
    Write-Host "===================" -ForegroundColor Cyan
    
    $instances = Get-InstanceInfo
    
    if ($instances.Count -eq 0) {
        Write-Host "No instances found" -ForegroundColor Yellow
        return
    }
    
    foreach ($instance in $instances) {
        Write-Host "`nInstance ID: $($instance.InstanceId)" -ForegroundColor Green
        Write-Host "State: $($instance.State.Name)" -ForegroundColor $(if($instance.State.Name -eq "running"){"Green"}else{"Yellow"})
        Write-Host "Type: $($instance.InstanceType)"
        Write-Host "Public IP: $($instance.PublicIpAddress)"
        Write-Host "Launch Time: $($instance.LaunchTime)"
        
        # Show if it's a spot instance
        if ($instance.InstanceLifecycle -eq "spot") {
            Write-Host "Instance Type: SPOT (Cost Optimized)" -ForegroundColor Cyan
        }
    }
}

function Start-Instances {
    Write-Host "Starting instances..." -ForegroundColor Cyan
    
    $instances = Get-InstanceInfo | Where-Object { $_.State.Name -eq "stopped" }
    
    if ($instances.Count -eq 0) {
        Write-Host "No stopped instances found" -ForegroundColor Yellow
        return
    }
    
    $instanceIds = $instances | ForEach-Object { $_.InstanceId }
    aws ec2 start-instances --instance-ids $instanceIds | Out-Null
    Write-Host "✅ Instances starting..." -ForegroundColor Green
}

function Stop-Instances {
    Write-Host "Stopping instances..." -ForegroundColor Cyan
    
    $instances = Get-InstanceInfo | Where-Object { $_.State.Name -eq "running" }
    
    if ($instances.Count -eq 0) {
        Write-Host "No running instances found" -ForegroundColor Yellow
        return
    }
    
    $instanceIds = $instances | ForEach-Object { $_.InstanceId }
    aws ec2 stop-instances --instance-ids $instanceIds | Out-Null
    Write-Host "✅ Instances stopping..." -ForegroundColor Green
    Write-Host "💡 Tip: Stopped instances don't incur compute charges" -ForegroundColor Yellow
}

function Restart-Application {
    $instance = Get-RunningInstance
    if (!$instance) {
        Write-Host "❌ No running instance found" -ForegroundColor Red
        return
    }
    
    $keyFile = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1
    if (!$keyFile) {
        Write-Host "❌ No .pem key file found" -ForegroundColor Red
        return
    }
    
    Write-Host "Restarting application on $($instance.PublicIpAddress)..." -ForegroundColor Cyan
    ssh -o StrictHostKeyChecking=no -i $keyFile.Name "ec2-user@$($instance.PublicIpAddress)" "cd /home/ec2-user/app && pm2 restart all"
    Write-Host "✅ Application restarted" -ForegroundColor Green
}

function Show-Logs {
    $instance = Get-RunningInstance
    if (!$instance) {
        Write-Host "❌ No running instance found" -ForegroundColor Red
        return
    }
    
    $keyFile = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1
    if (!$keyFile) {
        Write-Host "❌ No .pem key file found" -ForegroundColor Red
        return
    }
    
    Write-Host "Streaming logs from $($instance.PublicIpAddress) (Ctrl+C to exit)..." -ForegroundColor Cyan
    ssh -o StrictHostKeyChecking=no -i $keyFile.Name "ec2-user@$($instance.PublicIpAddress)" "cd /home/ec2-user/app && pm2 logs"
}

function Connect-SSH {
    $instance = Get-RunningInstance
    if (!$instance) {
        Write-Host "❌ No running instance found" -ForegroundColor Red
        return
    }
    
    $keyFile = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1
    if (!$keyFile) {
        Write-Host "❌ No .pem key file found" -ForegroundColor Red
        return
    }
    
    Write-Host "Connecting to $($instance.PublicIpAddress)..." -ForegroundColor Cyan
    ssh -o StrictHostKeyChecking=no -i $keyFile.Name "ec2-user@$($instance.PublicIpAddress)"
}

function Update-Deployment {
    $instance = Get-RunningInstance
    if (!$instance) {
        Write-Host "❌ No running instance found" -ForegroundColor Red
        return
    }
    
    Write-Host "Deploying latest code to $($instance.PublicIpAddress)..." -ForegroundColor Cyan
    & ".\deploy-to-ec2.ps1" $instance.PublicIpAddress
}

function Show-Costs {
    Write-Host "`nCost Optimization Summary" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    
    $instances = Get-InstanceInfo
    $runningInstances = $instances | Where-Object { $_.State.Name -eq "running" }
    
    Write-Host "`nCurrent Usage:" -ForegroundColor Green
    Write-Host "- Total instances: $($instances.Count)"
    Write-Host "- Running instances: $($runningInstances.Count)"
    
    foreach ($instance in $runningInstances) {
        $isSpot = $instance.InstanceLifecycle -eq "spot"
        $hourlyRate = switch($instance.InstanceType) {
            "t3.micro" { if($isSpot) { 0.0031 } else { 0.0104 } }
            "t3.small" { if($isSpot) { 0.0062 } else { 0.0208 } }
            "t3.medium" { if($isSpot) { 0.0125 } else { 0.0416 } }
            default { 0.0104 }
        }
        
        $monthlyRate = $hourlyRate * 24 * 30
        Write-Host "`n$($instance.InstanceType) $(if($isSpot){'(SPOT)'}else{'(On-Demand)'}): ~`$$($monthlyRate.ToString('F2'))/month"
    }
    
    Write-Host "`nCost Saving Tips:" -ForegroundColor Yellow
    Write-Host "1. Stop instances when not in use (saves 100% during stopped time)"
    Write-Host "2. Use spot instances (saves ~70%)"
    Write-Host "3. Use t3.micro instead of larger instances"
    Write-Host "4. Consider Reserved Instances for long-term use (saves 50-70%)"
    Write-Host "5. Use AWS Free Tier if eligible (t2.micro free for 12 months)"
    
    Write-Host "`nEstimated Monthly Costs:" -ForegroundColor Cyan
    Write-Host "- t3.micro on-demand: ~`$7.49/month"
    Write-Host "- t3.micro spot: ~`$2.23/month"
    Write-Host "- Storage (30GB): ~`$3.00/month"
    Write-Host "- Data transfer: Variable (first 1GB free)"
}

function Terminate-Instances {
    Write-Host "`n⚠️  WARNING: This will PERMANENTLY DELETE all instances!" -ForegroundColor Red
    Write-Host "Type 'yes' to confirm: " -NoNewline
    $confirm = Read-Host
    
    if ($confirm -ne "yes") {
        Write-Host "Cancelled" -ForegroundColor Yellow
        return
    }
    
    $instances = Get-InstanceInfo
    if ($instances.Count -eq 0) {
        Write-Host "No instances found" -ForegroundColor Yellow
        return
    }
    
    $instanceIds = $instances | ForEach-Object { $_.InstanceId }
    aws ec2 terminate-instances --instance-ids $instanceIds | Out-Null
    Write-Host "✅ Instances terminating..." -ForegroundColor Green
}

# Main command execution
switch ($Command) {
    "status" { Show-Status }
    "start" { Start-Instances }
    "stop" { Stop-Instances }
    "restart" { Restart-Application }
    "logs" { Show-Logs }
    "ssh" { Connect-SSH }
    "update" { Update-Deployment }
    "costs" { Show-Costs }
    "terminate" { Terminate-Instances }
}