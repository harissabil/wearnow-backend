# API Documentation - WearNOW Backend

## GraphQL API Overview

The WearNOW backend provides a GraphQL API for managing user photos and virtual try-on history.

## Authentication

All API requests require authentication using AWS Cognito user pool tokens.

```kotlin
// Android example
Amplify.Auth.signIn(username, password)
```

## Data Models

### UserPhoto

Stores user profile photos for virtual try-on.

**Fields:**
- `id`: ID! (auto-generated)
- `userId`: String! (owner)
- `photoUrl`: String! (S3 key)
- `thumbnailUrl`: String (auto-generated)
- `isDefault`: Boolean (default: false)
- `uploadedAt`: AWSDateTime!
- `createdAt`: AWSDateTime!
- `updatedAt`: AWSDateTime!

**Operations:**

#### Create UserPhoto
```graphql
mutation CreateUserPhoto($input: CreateUserPhotoInput!) {
  createUserPhoto(input: $input) {
    id
    userId
    photoUrl
    thumbnailUrl
    isDefault
    uploadedAt
    createdAt
  }
}
```

#### List User Photos
```graphql
query ListUserPhotos($filter: ModelUserPhotoFilterInput, $limit: Int, $nextToken: String) {
  listUserPhotos(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      photoUrl
      thumbnailUrl
      isDefault
      uploadedAt
    }
    nextToken
  }
}
```

#### Update UserPhoto
```graphql
mutation UpdateUserPhoto($input: UpdateUserPhotoInput!) {
  updateUserPhoto(input: $input) {
    id
    isDefault
    updatedAt
  }
}
```

#### Delete UserPhoto
```graphql
mutation DeleteUserPhoto($input: DeleteUserPhotoInput!) {
  deleteUserPhoto(input: $input) {
    id
  }
}
```

### TryOnHistory

Tracks virtual try-on sessions and results.

**Fields:**
- `id`: ID! (auto-generated)
- `userId`: String! (owner)
- `userPhotoId`: String!
- `userPhotoUrl`: String! (S3 key)
- `garmentPhotoUrl`: String! (S3 key)
- `resultPhotoUrl`: String (S3 key, set when completed)
- `thumbnailUrl`: String (auto-generated)
- `status`: TryOnStatus! (PROCESSING | COMPLETED | FAILED)
- `errorMessage`: String
- `metadata`: AWSJSON
- `completedAt`: AWSDateTime
- `createdAt`: AWSDateTime!
- `updatedAt`: AWSDateTime!

**Operations:**

#### Create TryOnHistory
```graphql
mutation CreateTryOnHistory($input: CreateTryOnHistoryInput!) {
  createTryOnHistory(input: $input) {
    id
    userId
    userPhotoId
    userPhotoUrl
    garmentPhotoUrl
    status
    createdAt
  }
}
```

#### Get TryOnHistory
```graphql
query GetTryOnHistory($id: ID!) {
  getTryOnHistory(id: $id) {
    id
    userPhotoId
    userPhotoUrl
    garmentPhotoUrl
    resultPhotoUrl
    thumbnailUrl
    status
    errorMessage
    metadata
    completedAt
    createdAt
  }
}
```

#### List TryOnHistory
```graphql
query ListTryOnHistory($filter: ModelTryOnHistoryFilterInput, $limit: Int, $nextToken: String) {
  listTryOnHistory(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      userPhotoUrl
      garmentPhotoUrl
      resultPhotoUrl
      thumbnailUrl
      status
      createdAt
      completedAt
    }
    nextToken
  }
}
```

#### Update TryOnHistory (for Lambda to update status)
```graphql
mutation UpdateTryOnHistory($input: UpdateTryOnHistoryInput!) {
  updateTryOnHistory(input: $input) {
    id
    resultPhotoUrl
    status
    errorMessage
    completedAt
    updatedAt
  }
}
```

#### Delete TryOnHistory
```graphql
mutation DeleteTryOnHistory($input: DeleteTryOnHistoryInput!) {
  deleteTryOnHistory(input: $input) {
    id
  }
}
```

## Storage API

### Upload Files

**User Photos:**
```kotlin
val key = "user-photos/${userId}/original-${System.currentTimeMillis()}.jpg"
Amplify.Storage.uploadFile(key, file, options)
```

**Garment Photos:**
```kotlin
val key = "garment-photos/${userId}/garment-${System.currentTimeMillis()}.jpg"
Amplify.Storage.uploadFile(key, file, options)
```

### Download Files

```kotlin
Amplify.Storage.downloadFile(key, localFile)
```

### Delete Files

```kotlin
Amplify.Storage.remove(key)
```

## Lambda Functions

### Virtual Try-On Function

**Invocation:** Automatically triggered when TryOnHistory status is PROCESSING

**Input:**
```json
{
  "userId": "user-123",
  "userPhotoId": "photo-456",
  "userPhotoUrl": "user-photos/user-123/original-123.jpg",
  "garmentPhotoUrl": "garment-photos/user-123/garment-456.jpg",
  "historyId": "history-789",
  "options": {
    "garmentClass": "UPPER_BODY",
    "mergeStyle": "BALANCED"
  }
}
```

**Output:**
```json
{
  "success": true,
  "historyId": "history-789",
  "resultUrl": "tryon-results/user-123/result-history-789.jpg",
  "processingTime": 15432
}
```

## Complete Workflow Example (Android/Kotlin)

### 1. User Onboarding - Upload First Photo

```kotlin
suspend fun uploadUserPhoto(photoFile: File, isDefault: Boolean = true): UserPhoto {
    // Step 1: Upload to S3
    val userId = Amplify.Auth.currentUser.userId
    val timestamp = System.currentTimeMillis()
    val s3Key = "user-photos/${userId}/original-${timestamp}.jpg"
    
    val uploadedKey = suspendCoroutine { continuation ->
        Amplify.Storage.uploadFile(
            s3Key,
            photoFile,
            { result -> continuation.resume(result.key) },
            { error -> continuation.resumeWithException(error) }
        )
    }
    
    // Step 2: Create database record
    val userPhoto = UserPhoto.builder()
        .userId(userId)
        .photoUrl(uploadedKey)
        .isDefault(isDefault)
        .uploadedAt(Temporal.DateTime.now())
        .build()
    
    return suspendCoroutine { continuation ->
        Amplify.API.mutate(
            ModelMutation.create(userPhoto),
            { response -> continuation.resume(response.data) },
            { error -> continuation.resumeWithException(error) }
        )
    }
}
```

### 2. Virtual Try-On Flow

```kotlin
suspend fun performVirtualTryOn(
    userPhotoId: String,
    userPhotoUrl: String,
    garmentFile: File,
    garmentClass: String = "UPPER_BODY"
): TryOnHistory {
    val userId = Amplify.Auth.currentUser.userId
    
    // Step 1: Upload garment photo
    val garmentKey = "garment-photos/${userId}/garment-${System.currentTimeMillis()}.jpg"
    suspendCoroutine<String> { continuation ->
        Amplify.Storage.uploadFile(
            garmentKey,
            garmentFile,
            { result -> continuation.resume(result.key) },
            { error -> continuation.resumeWithException(error) }
        )
    }
    
    // Step 2: Create history record with PROCESSING status
    val history = TryOnHistory.builder()
        .userId(userId)
        .userPhotoId(userPhotoId)
        .userPhotoUrl(userPhotoUrl)
        .garmentPhotoUrl(garmentKey)
        .status(TryOnStatus.PROCESSING)
        .metadata("{\"garmentClass\":\"${garmentClass}\"}")
        .build()
    
    val createdHistory = suspendCoroutine<TryOnHistory> { continuation ->
        Amplify.API.mutate(
            ModelMutation.create(history),
            { response -> continuation.resume(response.data) },
            { error -> continuation.resumeWithException(error) }
        )
    }
    
    // Step 3: Invoke Lambda function
    val lambdaPayload = JSONObject().apply {
        put("userId", userId)
        put("userPhotoId", userPhotoId)
        put("userPhotoUrl", userPhotoUrl)
        put("garmentPhotoUrl", garmentKey)
        put("historyId", createdHistory.id)
        put("options", JSONObject().apply {
            put("garmentClass", garmentClass)
            put("mergeStyle", "BALANCED")
        })
    }
    
    // Trigger Lambda asynchronously
    invokeLambdaFunction("virtual-tryon", lambdaPayload)
    
    return createdHistory
}

suspend fun waitForTryOnCompletion(historyId: String): TryOnHistory {
    while (true) {
        delay(2000) // Poll every 2 seconds
        
        val history = suspendCoroutine<TryOnHistory> { continuation ->
            Amplify.API.query(
                ModelQuery.get(TryOnHistory::class.java, historyId),
                { response -> continuation.resume(response.data) },
                { error -> continuation.resumeWithException(error) }
            )
        }
        
        when (history.status) {
            TryOnStatus.COMPLETED -> return history
            TryOnStatus.FAILED -> throw Exception(history.errorMessage ?: "Try-on failed")
            TryOnStatus.PROCESSING -> continue
        }
    }
}
```

### 3. Display Result

```kotlin
suspend fun downloadTryOnResult(resultPhotoUrl: String): File {
    val localFile = File(context.cacheDir, "tryon-result-${System.currentTimeMillis()}.jpg")
    
    suspendCoroutine<Unit> { continuation ->
        Amplify.Storage.downloadFile(
            resultPhotoUrl,
            localFile,
            { continuation.resume(Unit) },
            { error -> continuation.resumeWithException(error) }
        )
    }
    
    return localFile
}
```

## Error Handling

### Common Error Codes

- `VALIDATION_ERROR`: Invalid input (missing required fields, invalid format)
- `AUTHORIZATION_ERROR`: User not authorized to access resource
- `NOT_FOUND`: Resource not found
- `BEDROCK_ERROR`: Amazon Bedrock API error
- `S3_ERROR`: S3 upload/download error
- `PROCESSING_ERROR`: General processing error

### Example Error Response

```json
{
  "success": false,
  "historyId": "history-789",
  "errorMessage": "Image size exceeds maximum allowed size (10MB)",
  "processingTime": 234
}
```

## Rate Limits

- **API Requests**: 10,000 requests per minute per user
- **Bedrock Nova Canvas**: Depends on your AWS account limits (typically 10-50 concurrent requests)
- **S3 Uploads**: 3,500 PUT requests per second per prefix

## Best Practices

1. **Always compress images** before upload to reduce storage costs and processing time
2. **Cache results** on the mobile device to avoid repeated downloads
3. **Implement retry logic** for network failures
4. **Show loading indicators** during processing (10-30 seconds expected)
5. **Validate image format and size** on client side before upload
6. **Handle errors gracefully** with user-friendly messages
7. **Clean up old files** - delete garment photos after try-on is complete
8. **Use thumbnails** for list views to improve performance
9. **Implement pagination** when listing history items
10. **Monitor costs** - set up AWS billing alerts

