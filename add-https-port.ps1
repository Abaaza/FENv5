# Add HTTPS Port 443 to EC2 Security Group
param([string]$IP = "13.218.146.247")

Write-Host "Adding HTTPS (port 443) to EC2 Security Group" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Get instance ID
Write-Host "`nStep 1: Getting EC2 instance information..." -ForegroundColor Cyan
$instanceId = aws ec2 describe-instances `
    --filters "Name=ip-address,Values=$IP" `
    --query "Reservations[0].Instances[0].InstanceId" `
    --output text

if ($instanceId -eq "None" -or !$instanceId) {
    Write-Host "Error: Could not find instance with IP $IP" -ForegroundColor Red
    exit
}

Write-Host "Instance ID: $instanceId" -ForegroundColor Yellow

# Get security group ID
Write-Host "`nStep 2: Getting Security Group..." -ForegroundColor Cyan
$securityGroupId = aws ec2 describe-instances `
    --instance-ids $instanceId `
    --query "Reservations[0].Instances[0].SecurityGroups[0].GroupId" `
    --output text

Write-Host "Security Group ID: $securityGroupId" -ForegroundColor Yellow

# Check if port 443 already exists
Write-Host "`nStep 3: Checking if port 443 is already open..." -ForegroundColor Cyan
$existingRule = aws ec2 describe-security-groups `
    --group-ids $securityGroupId `
    --query "SecurityGroups[0].IpPermissions[?FromPort==``443``]" `
    --output json | ConvertFrom-Json

if ($existingRule.Count -gt 0) {
    Write-Host "Port 443 is already open!" -ForegroundColor Green
} else {
    # Add HTTPS rule
    Write-Host "`nStep 4: Adding HTTPS (port 443) rule..." -ForegroundColor Cyan
    
    $result = aws ec2 authorize-security-group-ingress `
        --group-id $securityGroupId `
        --protocol tcp `
        --port 443 `
        --cidr 0.0.0.0/0 `
        --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Successfully added HTTPS (port 443) rule!" -ForegroundColor Green
    } else {
        Write-Host "Error adding rule: $result" -ForegroundColor Red
    }
}

# Display all current rules
Write-Host "`nStep 5: Current Security Group rules:" -ForegroundColor Cyan
aws ec2 describe-security-groups `
    --group-ids $securityGroupId `
    --query "SecurityGroups[0].IpPermissions[*].[IpProtocol,FromPort,ToPort,IpRanges[0].CidrIp]" `
    --output table

Write-Host "`n✅ Done! Your EC2 instance now accepts HTTPS traffic on port 443" -ForegroundColor Green
Write-Host "`nYour API is now accessible via:" -ForegroundColor Yellow
Write-Host "https://$IP/api/health" -ForegroundColor Cyan
Write-Host "`n⚠️  Remember to update Amplify environment variable:" -ForegroundColor Yellow
Write-Host "REACT_APP_API_URL=https://$IP/api" -ForegroundColor Cyan