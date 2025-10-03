# Deployment Guide - WearNOW Backend

## Prerequisites Checklist

Before deploying, ensure you have:

- [ ] AWS Account with appropriate permissions
- [ ] AWS CLI installed and configured
- [ ] Node.js 18+ installed
- [ ] npm installed
- [ ] Git installed (optional)
- [ ] Amazon Bedrock access to Nova Canvas model

## Step-by-Step Deployment

### 1. Request Amazon Bedrock Access

1. Log in to AWS Console
2. Navigate to **Amazon Bedrock** service
3. Go to **Model access** in the left sidebar
4. Click **Request model access**
5. Find **Amazon Nova Canvas** and request access
6. Wait for approval (usually instant)

### 2. Configure AWS Credentials

```bash
aws configure
```

Enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `us-east-1` (recommended for Bedrock)
- Default output format: `json`

### 3. Install Dependencies

```bash
cd wearnow-backend
npm install
```

### 4. Deploy to Sandbox (Development)

For development and testing:

```bash
npm run sandbox
```

This will:
- Create a CloudFormation stack
- Deploy all resources (Auth, Data, Storage, Functions)
- Generate `amplify_outputs.json` file
- Start watching for changes

**Important**: Keep the sandbox running during development. Press `Ctrl+C` to stop and clean up resources.

### 5. Deploy to Production

For production deployment:

```bash
npx ampx deploy --branch main
```

Or if you want to specify a different branch:

```bash
npx ampx deploy --branch production
```

This creates a permanent deployment that persists after the terminal closes.

## Post-Deployment Steps

### 1. Verify Deployment

Check that all resources were created:

```bash
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE
```

Look for stacks with names containing `amplify-wearnow`.

### 2. Test Lambda Functions

Test the virtual-tryon function:

```bash
aws lambda invoke \
  --function-name <your-function-name> \
  --payload '{"userId":"test","userPhotoUrl":"test.jpg","garmentPhotoUrl":"test.jpg","historyId":"test123"}' \
  response.json
```

### 3. Check CloudWatch Logs

```bash
aws logs tail /aws/lambda/virtual-tryon --follow
```

### 4. Configure Android App

1. Copy the generated `amplify_outputs.json` file
2. Place it in your Android project: `app/src/main/res/raw/amplify_outputs.json`
3. Update your Android app configuration

## Environment-Specific Configuration

### Development Environment

- **Purpose**: Testing and development
- **Deployment**: Sandbox (temporary)
- **Cost**: Minimal (deleted when stopped)
- **Command**: `npm run sandbox`

### Staging Environment

- **Purpose**: Pre-production testing
- **Deployment**: Permanent
- **Branch**: `staging`
- **Command**: `npx ampx deploy --branch staging`

### Production Environment

- **Purpose**: Live application
- **Deployment**: Permanent
- **Branch**: `main` or `production`
- **Command**: `npx ampx deploy --branch main`

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy WearNOW Backend

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to Amplify
        run: npx ampx deploy --branch main
```

## Monitoring & Maintenance

### CloudWatch Dashboards

1. Go to AWS CloudWatch Console
2. Create a dashboard for WearNOW
3. Add widgets for:
   - Lambda function invocations
   - Lambda errors
   - Lambda duration
   - DynamoDB read/write capacity
   - S3 storage metrics

### Set Up Alarms

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name wearnow-lambda-errors \
  --alarm-description "Alert on high error rate" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold

# High cost alarm
aws cloudwatch put-metric-alarm \
  --alarm-name wearnow-high-cost \
  --alarm-description "Alert on high AWS costs" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold
```

### Logging

Enable detailed logging for debugging:

```typescript
// In handler.ts files, ensure console.log statements are present
console.log('Processing virtual try-on:', JSON.stringify(event));
```

View logs:
```bash
aws logs tail /aws/lambda/virtual-tryon --follow --format short
```

## Scaling Considerations

### Lambda Functions

- **Concurrency**: Default is 1000 concurrent executions
- **Reserved Concurrency**: Set if needed for predictable performance
- **Provisioned Concurrency**: Use for low-latency requirements (additional cost)

```bash
# Set reserved concurrency
aws lambda put-function-concurrency \
  --function-name virtual-tryon \
  --reserved-concurrent-executions 100
```

### DynamoDB

Auto-scaling is enabled by default in Amplify Gen 2.

### S3

S3 automatically scales. Consider:
- **Transfer Acceleration**: For global users
- **CloudFront CDN**: For faster image delivery

## Cost Optimization

### 1. S3 Lifecycle Policies

Already configured in `storage/resource.ts`, but you can customize:

```typescript
// In storage/resource.ts
bucket.addLifecycleRule({
  id: 'DeleteOldTryOnResults',
  prefix: 'tryon-results/',
  expiration: Duration.days(30),
});
```

### 2. DynamoDB On-Demand vs Provisioned

Amplify uses on-demand by default, which is cost-effective for variable workloads.

### 3. Lambda Memory Optimization

Monitor and adjust Lambda memory settings:

```bash
aws lambda update-function-configuration \
  --function-name virtual-tryon \
  --memory-size 512
```

### 4. CloudWatch Logs Retention

Set log retention to avoid indefinite storage:

```bash
aws logs put-retention-policy \
  --log-group-name /aws/lambda/virtual-tryon \
  --retention-in-days 7
```

## Backup & Disaster Recovery

### DynamoDB Backups

Enable point-in-time recovery:

```bash
aws dynamodb update-continuous-backups \
  --table-name UserPhoto \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

### S3 Versioning

Enable versioning for important data:

```bash
aws s3api put-bucket-versioning \
  --bucket your-bucket-name \
  --versioning-configuration Status=Enabled
```

## Troubleshooting Deployment Issues

### Issue: "Stack already exists"

**Solution**: 
```bash
# Delete the existing stack
npx ampx sandbox delete
# Then redeploy
npm run sandbox
```

### Issue: "Insufficient permissions"

**Solution**: Ensure your IAM user/role has these policies:
- AWSCloudFormationFullAccess
- AWSLambdaFullAccess
- AmazonS3FullAccess
- AmazonDynamoDBFullAccess
- IAMFullAccess
- AmazonBedrockFullAccess

### Issue: "Model access denied" (Bedrock)

**Solution**: 
1. Go to Bedrock Console
2. Request model access for Nova Canvas
3. Wait for approval
4. Redeploy

### Issue: "Function timeout"

**Solution**: Increase Lambda timeout in `resource.ts`:
```typescript
timeoutSeconds: 600, // 10 minutes
```

### Issue: "Out of memory"

**Solution**: Increase Lambda memory in `resource.ts`:
```typescript
memoryMB: 2048,
```

## Health Checks

Create a simple health check script:

```bash
#!/bin/bash
# health-check.sh

echo "Checking Lambda functions..."
aws lambda get-function --function-name virtual-tryon > /dev/null 2>&1 && echo "✓ Virtual Try-On function" || echo "✗ Virtual Try-On function"
aws lambda get-function --function-name image-processor > /dev/null 2>&1 && echo "✓ Image Processor function" || echo "✗ Image Processor function"

echo "Checking DynamoDB tables..."
aws dynamodb describe-table --table-name UserPhoto > /dev/null 2>&1 && echo "✓ UserPhoto table" || echo "✗ UserPhoto table"
aws dynamodb describe-table --table-name TryOnHistory > /dev/null 2>&1 && echo "✓ TryOnHistory table" || echo "✗ TryOnHistory table"

echo "Checking S3 bucket..."
aws s3 ls s3://your-bucket-name > /dev/null 2>&1 && echo "✓ S3 bucket" || echo "✗ S3 bucket"
```

## Rollback Procedure

If deployment fails or introduces issues:

```bash
# For sandbox
npx ampx sandbox delete
npm run sandbox

# For production - rollback CloudFormation stack
aws cloudformation rollback-stack --stack-name <stack-name>
```

## Security Hardening

### 1. Enable MFA Delete on S3

```bash
aws s3api put-bucket-versioning \
  --bucket your-bucket-name \
  --versioning-configuration Status=Enabled,MFADelete=Enabled \
  --mfa "arn:aws:iam::123456789:mfa/root-account-mfa-device 123456"
```

### 2. Enable Encryption

S3 encryption is enabled by default in Amplify. Verify:

```bash
aws s3api get-bucket-encryption --bucket your-bucket-name
```

### 3. Restrict IAM Permissions

Use least-privilege principle. Review and tighten IAM policies after deployment.

## Next Steps After Deployment

1. ✅ Test all API endpoints
2. ✅ Upload sample photos and test virtual try-on
3. ✅ Configure monitoring and alarms
4. ✅ Set up backup procedures
5. ✅ Document API endpoints for mobile team
6. ✅ Conduct security review
7. ✅ Perform load testing
8. ✅ Set up CI/CD pipeline
9. ✅ Train team on monitoring and troubleshooting

## Support Resources

- **AWS Support**: Create a support ticket in AWS Console
- **Amplify Discord**: https://discord.gg/amplify
- **Amplify Documentation**: https://docs.amplify.aws/gen2/
- **Bedrock Documentation**: https://docs.aws.amazon.com/bedrock/

