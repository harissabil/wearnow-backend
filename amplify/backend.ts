import {defineBackend} from '@aws-amplify/backend';
import {auth} from './auth/resource';
import {data} from './data/resource';
import {storage} from './storage/resource';
import {virtualTryonFunction} from './functions/virtual-tryon/resource';
import {Policy, PolicyStatement} from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
    auth,
    data,
    storage,
    virtualTryonFunction,
});

// Grant Bedrock permissions to virtual-tryon function
const bedrockPolicy = new Policy(
    backend.virtualTryonFunction.resources.lambda.stack,
    'BedrockInvokePolicy',
    {
        statements: [
            new PolicyStatement({
                actions: ['bedrock:InvokeModel'],
                resources: ['arn:aws:bedrock:*::foundation-model/amazon.nova-canvas-v1:0'],
            }),
        ],
    }
);
backend.virtualTryonFunction.resources.lambda.role?.attachInlinePolicy(bedrockPolicy);

// Grant S3 permissions to virtual-tryon function
backend.storage.resources.bucket.grantReadWrite(backend.virtualTryonFunction.resources.lambda);

// Set S3 bucket name as environment variable for virtual-tryon function
backend.virtualTryonFunction.addEnvironment(
    'S3_BUCKET_NAME',
    backend.storage.resources.bucket.bucketName
);

// Set DynamoDB table name as environment variable for virtual-tryon function
// Using Amplify's table naming pattern to avoid circular dependency
// Amplify Gen2 creates tables with pattern: {ModelName}-{AppId}-{Environment}
// We'll pass the stack name and let the Lambda construct the full table name
backend.virtualTryonFunction.addEnvironment(
    'STACK_NAME',
    backend.virtualTryonFunction.resources.lambda.stack.stackName
);

// Grant DynamoDB permissions to virtual-tryon function using wildcard to avoid circular dependency
const dynamoDbPolicy = new Policy(
    backend.virtualTryonFunction.resources.lambda.stack,
    'DynamoDBAccessPolicy',
    {
        statements: [
            new PolicyStatement({
                actions: [
                    'dynamodb:ListTables',
                    'dynamodb:GetItem',
                    'dynamodb:PutItem',
                    'dynamodb:UpdateItem',
                    'dynamodb:DeleteItem',
                    'dynamodb:Query',
                    'dynamodb:Scan',
                ],
                resources: ['*'], // Use wildcard to avoid circular dependency
            }),
        ],
    }
);
backend.virtualTryonFunction.resources.lambda.role?.attachInlinePolicy(dynamoDbPolicy);
