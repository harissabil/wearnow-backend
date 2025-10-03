# Quick Start Guide - WearNOW Backend

## 🚀 Get Started in 5 Minutes

### Prerequisites Check ✅
Run the automated check:
```bash
npm run check
```

All checks passed! Your environment is ready.

---

## Step 1: Request Amazon Bedrock Access

**Important**: Do this BEFORE deploying!

1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **Amazon Bedrock** service
3. Click **Model access** in left sidebar
4. Click **Request model access** button
5. Find **Amazon Nova Canvas** → Click **Request access**
6. Wait for approval (usually instant)

---

## Step 2: Deploy the Backend

### Option A: Development (Recommended for Testing)

```bash
npm run sandbox
```

This will:
- ✅ Deploy all resources to AWS
- ✅ Create a development environment
- ✅ Generate `amplify_outputs.json` file
- ✅ Watch for code changes and auto-redeploy
- ⚠️ **Keep terminal open** - resources are cleaned up when you stop it

**When done testing**: Press `Ctrl+C` to clean up resources

### Option B: Production Deployment

```bash
npm run deploy
```

This creates a permanent deployment that stays active.

---

## Step 3: Get the Configuration File

After deployment completes, you'll see:
```
✅ Successfully generated outputs at: amplify_outputs.json
```

**Copy this file** to your Android project:
```
wearnow-backend/amplify_outputs.json
    ↓
android-app/app/src/main/res/raw/amplify_outputs.json
```

---

## Step 4: Test the Backend

### Using AWS Console

1. Go to **AWS Lambda** console
2. Find function: `virtual-tryon`
3. Click **Test** tab
4. Create test event:
```json
{
  "userId": "test-user-123",
  "userPhotoUrl": "user-photos/test-user-123/photo.jpg",
  "garmentPhotoUrl": "garment-photos/test-user-123/garment.jpg",
  "historyId": "test-history-123",
  "options": {
    "garmentClass": "UPPER_BODY",
    "mergeStyle": "BALANCED"
  }
}
```

### Using Android App

Integrate the SDK and start testing! See `API_DOCUMENTATION.md` for complete examples.

---

## What Was Deployed?

### ✅ Authentication (Cognito)
- User signup/login with email & password
- Secure user sessions

### ✅ Database (DynamoDB)
- **UserPhoto** table - stores user profile photos
- **TryOnHistory** table - tracks virtual try-on sessions

### ✅ Storage (S3)
- Organized folders for user photos, garments, and results
- Automatic thumbnail generation

### ✅ Functions (Lambda)
- **virtual-tryon** - Processes AI try-on using Bedrock
- **image-processor** - Creates thumbnails automatically

### ✅ API (AppSync/GraphQL)
- Complete CRUD operations for photos and history
- Secure owner-based authorization

---

## Monitoring Your Deployment

### View Logs
```bash
# Virtual try-on function logs
aws logs tail /aws/lambda/virtual-tryon --follow

# Image processor logs
aws logs tail /aws/lambda/image-processor --follow
```

### Check Resources
```bash
# List all deployed stacks
aws cloudformation list-stacks --query "StackSummaries[?contains(StackName, 'amplify')]"

# Check DynamoDB tables
aws dynamodb list-tables

# Check S3 buckets
aws s3 ls
```

---

## Understanding Costs

For **1,000 virtual try-ons per month**:
- Amazon Bedrock Nova Canvas: ~$40
- Lambda executions: ~$1 (mostly free tier)
- S3 storage: ~$1-2
- DynamoDB: Free tier covers it
- **Total: ~$40-45/month**

💡 **Tip**: Set up a billing alarm!
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name wearnow-budget-alert \
  --alarm-description "Alert when costs exceed $50" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold
```

---

## Common First-Time Issues

### ❌ "Access Denied" when calling Bedrock
**Solution**: Request model access (Step 1 above)

### ❌ Deployment hangs or fails
**Solution**: 
1. Check AWS credentials: `aws sts get-caller-identity`
2. Ensure you have proper IAM permissions
3. Try restarting: Press `Ctrl+C`, then `npm run sandbox` again

### ❌ Can't find `amplify_outputs.json`
**Solution**: File is created in project root after successful deployment

### ❌ Lambda timeout errors
**Solution**: Normal for first run (cold start). Subsequent calls will be faster.

---

## Next Steps

### 1. Read the Documentation
- 📖 **README.md** - Complete overview
- 📋 **API_DOCUMENTATION.md** - API reference with Android examples
- 🚀 **DEPLOYMENT.md** - Advanced deployment options
- ✅ **IMPLEMENTATION_SUMMARY.md** - What's been built

### 2. Integrate with Android
Follow the Android examples in `API_DOCUMENTATION.md`

### 3. Test Virtual Try-On
1. Upload a user photo via Android app
2. Take/upload a garment photo
3. Start virtual try-on
4. Wait 10-30 seconds
5. View the result!

### 4. Set Up Monitoring
- Enable CloudWatch dashboards
- Set up cost alerts
- Configure error notifications

---

## Support & Resources

### Documentation
- [AWS Amplify Gen 2 Docs](https://docs.amplify.aws/gen2/)
- [Amazon Bedrock Docs](https://docs.aws.amazon.com/bedrock/)
- [Amplify Android SDK](https://docs.amplify.aws/android/)

### Commands Reference
```bash
npm run check      # Pre-deployment verification
npm run sandbox    # Start development environment
npm run deploy     # Deploy to production
npm install        # Install/update dependencies
```

### File Structure
```
wearnow-backend/
├── amplify/              # Backend code
├── README.md             # Main documentation
├── API_DOCUMENTATION.md  # API reference
├── DEPLOYMENT.md         # Deployment guide
├── QUICK_START.md        # This file!
└── package.json          # Dependencies
```

---

## 🎉 You're All Set!

Your WearNOW backend is ready to power amazing virtual try-on experiences!

**Questions?** Check the documentation files or review the CloudWatch logs for detailed information.

**Happy coding!** 👔👗👠

