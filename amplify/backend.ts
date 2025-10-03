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

// Grant data access to functions
backend.data.resources.tables['UserPhoto'].grantReadWriteData(
    backend.virtualTryonFunction.resources.lambda
);
backend.data.resources.tables['TryOnHistory'].grantReadWriteData(
    backend.virtualTryonFunction.resources.lambda
);
