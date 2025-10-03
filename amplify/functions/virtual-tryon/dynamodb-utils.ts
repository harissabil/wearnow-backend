import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

export class DynamoDBUtils {
    private ddbDocClient: DynamoDBDocument;
    private ddbClient: DynamoDB;

    constructor(region: string) {
        this.ddbClient = new DynamoDB({ region });
        this.ddbDocClient = DynamoDBDocument.from(this.ddbClient);
    }

    /**
     * Find the TryOnHistory table by listing tables and matching pattern
     * Amplify creates tables with pattern: TryOnHistory-{stack-identifier}
     */
    private async findTryOnHistoryTableName(): Promise<string> {
        try {
            const result = await this.ddbClient.listTables({});
            const tables = result.TableNames || [];

            // Find table that starts with "TryOnHistory-"
            const tryOnHistoryTable = tables.find(table => table.startsWith('TryOnHistory-'));

            if (!tryOnHistoryTable) {
                throw new Error('TryOnHistory table not found. Available tables: ' + tables.join(', '));
            }

            console.log('Found TryOnHistory table:', tryOnHistoryTable);
            return tryOnHistoryTable;
        } catch (error) {
            console.error('Error finding TryOnHistory table:', error);
            throw error;
        }
    }

    /**
     * Update TryOnHistory record with result or error
     */
    async updateTryOnHistory(
        historyId: string,
        updates: {
            status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
            resultPhotoUrl?: string;
            errorMessage?: string;
            completedAt?: string;
        }
    ): Promise<void> {
        try {
            // Find the table name dynamically
            const tableName = await this.findTryOnHistoryTableName();

            // Build update expression dynamically based on what fields are provided
            const updateExpressions: string[] = ['#status = :status', 'updatedAt = :updatedAt'];
            const expressionAttributeNames: Record<string, string> = { '#status': 'status' };
            const expressionAttributeValues: Record<string, any> = {
                ':status': updates.status,
                ':updatedAt': new Date().toISOString(),
            };

            if (updates.resultPhotoUrl) {
                updateExpressions.push('resultPhotoUrl = :resultPhotoUrl');
                expressionAttributeValues[':resultPhotoUrl'] = updates.resultPhotoUrl;
            }

            if (updates.errorMessage) {
                updateExpressions.push('errorMessage = :errorMessage');
                expressionAttributeValues[':errorMessage'] = updates.errorMessage;
            }

            if (updates.completedAt) {
                updateExpressions.push('completedAt = :completedAt');
                expressionAttributeValues[':completedAt'] = updates.completedAt;
            }

            const updateExpression = 'SET ' + updateExpressions.join(', ');

            console.log('Updating TryOnHistory:', {
                historyId,
                tableName,
                updateExpression,
                expressionAttributeValues,
            });

            await this.ddbDocClient.update({
                TableName: tableName,
                Key: { id: historyId },
                UpdateExpression: updateExpression,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
            });

            console.log(`Successfully updated TryOnHistory ${historyId} with status: ${updates.status}`);
        } catch (error) {
            console.error('Error updating TryOnHistory:', error);
            throw error;
        }
    }
}
