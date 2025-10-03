# WearNOW Backend - AWS Amplify Gen 2

Complete AWS Amplify backend for WearNOW Android application with virtual try-on capabilities using Amazon Bedrock Nova Canvas.

## Features

- **Authentication**: AWS Cognito user management
- **User Photos**: Store and manage user profile photos
- **Virtual Try-On**: AI-powered clothing overlay using Amazon Bedrock Nova Canvas
- **Try-On History**: Track and manage past virtual try-on sessions
- **Storage**: Secure S3 storage with user-specific folders
- **Image Processing**: Automatic thumbnail generation

## Project Structure

```
wearnow-backend/
├── amplify/
│   ├── auth/
│   │   └── resource.ts              # Authentication configuration
│   ├── data/
│   │   └── resource.ts              # Data models (UserPhoto, TryOnHistory)
│   ├── storage/
│   │   └── resource.ts              # S3 storage configuration
│   ├── functions/
│   │   ├── virtual-tryon/
│   │   │   ├── handler.ts           # Virtual try-on Lambda handler
│   │   │   ├── bedrock-client.ts    # Bedrock Nova Canvas client
│   │   │   ├── s3-utils.ts          # S3 utility functions
│   │   │   └── resource.ts          # Function definition
│   │   └── image-processor/
│   │       ├── handler.ts           # Thumbnail generation
│   │       └── resource.ts          # Function definition
│   ├── backend.ts                   # Main backend configuration
│   ├── package.json
│   └── tsconfig.json
├── package.json
└── README.md
```

## Data Models

### UserPhoto
```typescript
{
  id: string (auto-generated)
  userId: string (owner)
  photoUrl: string (S3 key)
  thumbnailUrl?: string
  isDefault: boolean
  uploadedAt: AWSDateTime
  createdAt: AWSDateTime
  updatedAt: AWSDateTime
}
```

### TryOnHistory
```typescript
{
  id: string (auto-generated)
  userId: string (owner)
  userPhotoId: string
  userPhotoUrl: string (S3 key)
  garmentPhotoUrl: string (S3 key)
  resultPhotoUrl?: string (S3 key)
  thumbnailUrl?: string
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED'
  errorMessage?: string
  metadata?: JSON
  completedAt?: AWSDateTime
  createdAt: AWSDateTime
  updatedAt: AWSDateTime
}
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- AWS Account with appropriate permissions
- AWS CLI configured with credentials
- Amazon Bedrock access (request access to Nova Canvas model)

### Installation

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure AWS credentials**:
   ```bash
   aws configure
   ```

3. **Enable Amazon Bedrock Nova Canvas**:
   - Go to AWS Console → Amazon Bedrock
   - Request access to `amazon.nova-canvas-v1:0` model
   - Wait for approval (usually instant for most accounts)

### Development

**Start local sandbox**:
```bash
npm run sandbox
```

This will:
- Deploy backend resources to AWS
- Create a local development environment
- Generate `amplify_outputs.json` for Android app integration
- Watch for file changes and auto-deploy

### Production Deployment

**Deploy to production**:
```bash
npm run deploy
```

## Security & Authorization

- **Authentication**: Email/password via AWS Cognito
- **Authorization**: Owner-based access control
  - Users can only access their own photos and history
  - S3 storage uses user-specific paths: `{resource-type}/{userId}/{file}`
- **IAM Permissions**: Lambda functions have minimal required permissions
  - Virtual Try-On function: Bedrock InvokeModel, S3 read/write, DynamoDB read/write
  - Image Processor function: S3 read/write

## Android Integration

### 1. Configure Amplify in Android App

Add `amplify_outputs.json` (generated after deployment) to your Android app's `raw` resources folder.

### 2. Initialize Amplify

```kotlin
// In Application class or MainActivity
Amplify.addPlugin(AWSCognitoAuthPlugin())
Amplify.addPlugin(AWSApiPlugin())
Amplify.addPlugin(AWSS3StoragePlugin())
Amplify.configure(applicationContext)
```

### 3. Example Usage

#### Upload User Photo
```kotlin
// Upload to S3
val uploadedKey = suspendCoroutine { continuation ->
    Amplify.Storage.uploadFile(
        "user-photos/${userId}/original-${System.currentTimeMillis()}.jpg",
        File(photoPath),
        { result -> continuation.resume(result.key) },
        { error -> continuation.resumeWithException(error) }
    )
}

// Create database record
val userPhoto = UserPhoto.builder()
    .userId(userId)
    .photoUrl(uploadedKey)
    .isDefault(true)
    .uploadedAt(Temporal.DateTime.now())
    .build()

Amplify.API.mutate(ModelMutation.create(userPhoto))
```

#### Start Virtual Try-On
```kotlin
// 1. Upload garment photo
val garmentKey = uploadGarmentPhoto(garmentFile)

// 2. Create history record
val history = TryOnHistory.builder()
    .userId(userId)
    .userPhotoId(selectedUserPhotoId)
    .userPhotoUrl(userPhotoUrl)
    .garmentPhotoUrl(garmentKey)
    .status(TryOnStatus.PROCESSING)
    .build()

val createdHistory = Amplify.API.mutate(ModelMutation.create(history))

// 3. Invoke Lambda function
val request = JSONObject().apply {
    put("userId", userId)
    put("userPhotoUrl", userPhotoUrl)
    put("garmentPhotoUrl", garmentKey)
    put("historyId", createdHistory.id)
    put("options", JSONObject().apply {
        put("garmentClass", "UPPER_BODY")
        put("mergeStyle", "BALANCED")
    })
}

Amplify.API.mutate(
    "invokeVirtualTryOn",
    request.toString(),
    // ... handle response
)

// 4. Poll for completion
while (status == TryOnStatus.PROCESSING) {
    delay(2000)
    val updated = Amplify.API.query(ModelQuery.get(TryOnHistory::class.java, historyId))
    status = updated.status
}

// 5. Download result
val resultFile = Amplify.Storage.downloadFile(updated.resultPhotoUrl)
```

## Virtual Try-On Configuration

### Supported Garment Classes
- `UPPER_BODY`: Shirts, t-shirts, jackets, sweaters
- `LOWER_BODY`: Pants, shorts, skirts
- `FULL_BODY`: Dresses, jumpsuits, full outfits
- `FOOTWEAR`: Shoes, boots, sandals

### Merge Styles
- `BALANCED`: Default, good balance between realism and garment visibility
- `SEAMLESS`: More natural blending with user photo
- `DETAILED`: Preserves more garment details

### Image Requirements
- **Format**: JPEG or PNG
- **Max Size**: 10MB
- **Recommended Resolution**: 1024x1024 or higher
- **User Photo**: Clear, full-body or upper-body shot with visible pose
- **Garment Photo**: Clean product image on plain background (preferred)

## Performance & Costs

### Processing Time
- Virtual Try-On: 10-30 seconds (depends on image size and Bedrock load)
- Thumbnail Generation: 1-3 seconds
- API Queries: < 200ms

### Cost Estimates (USD)
- **Amazon Bedrock Nova Canvas**: ~$0.04 per image generation
- **Lambda Functions**: Free tier covers most usage, ~$0.20 per million requests after
- **S3 Storage**: ~$0.023 per GB/month
- **DynamoDB**: Free tier covers moderate usage
- **API Gateway**: ~$1.00 per million requests

**Example**: 1000 try-ons/month ≈ $40-50/month

### Cost Optimization
- Implement S3 lifecycle policies (auto-delete old results after 30 days)
- Limit user photo storage (e.g., max 10 photos per user)
- Use S3 Intelligent-Tiering for infrequent access
- Cache results on mobile device

## Testing

### Manual Testing Checklist
- [ ] User signup and login
- [ ] Upload user photo
- [ ] List user photos
- [ ] Delete user photo
- [ ] Upload garment and start try-on
- [ ] Monitor try-on processing status
- [ ] View completed try-on result
- [ ] Browse try-on history
- [ ] Delete history item
- [ ] Test with different garment classes
- [ ] Test error scenarios (invalid images, network failures)

### Lambda Function Testing
```bash
# Test virtual-tryon function locally
aws lambda invoke \
  --function-name virtual-tryon \
  --payload file://test-payload.json \
  output.json
```

## Troubleshooting

### "Access Denied" errors on Bedrock
- Ensure you've requested and received access to Nova Canvas model
- Check IAM permissions for Lambda execution role
- Verify region is set to `us-east-1` (or region where model is available)

### "Image too large" errors
- Compress images before upload (mobile side)
- Check MAX_IMAGE_SIZE environment variable

### Try-on stuck in "PROCESSING" status
- Check Lambda function logs in CloudWatch
- Verify Bedrock API limits haven't been exceeded
- Check Lambda timeout settings (should be 300s)

### S3 upload failures
- Verify IAM permissions for authenticated users
- Check CORS configuration on S3 bucket
- Ensure file paths follow the required pattern

## Additional Resources

- [AWS Amplify Gen 2 Documentation](https://docs.amplify.aws/gen2/)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Nova Canvas Model Card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-nova.html)
- [Amplify Android Documentation](https://docs.amplify.aws/android/)

## License

This library is licensed under the MIT-0 License. See the LICENSE file.