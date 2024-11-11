const AWS = require('aws-sdk');
const uuid = require('uuid');
const s3 = new AWS.S3();

// Global variables from environment variables
const BUCKET_NAME = process.env.S3_BUCKET_NAME;  // S3 Bucket name from env variable

exports.handler = async (event) => {
    try {
        // Generate 10 random UUIDs
        const uuids = Array.from({ length: 10 }, () => uuid.v4());

        // Get the current timestamp in ISO 8601 format (including milliseconds)
        const timestamp = new Date().toISOString();  // Use the full ISO format without modification
        const fileName = `${timestamp}`; // Use the exact timestamp as the file name

        // Prepare the S3 object structure
        const s3Object = {
            ids: uuids,  // UUIDs are placed under the "ids" key
        };

        // Prepare the S3 upload parameters
        const s3Params = {
            Bucket: BUCKET_NAME,
            Key: fileName,  // File name is the timestamp (ISO format)
            Body: JSON.stringify(s3Object),  // Store the UUIDs in the "ids" array
            ContentType: 'application/json',
        };

        // Upload the UUIDs to S3
        const s3Response = await s3.putObject(s3Params).promise();

        // Return success response
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'UUIDs successfully generated and uploaded to S3!',
                fileName: fileName,
                s3Response: s3Response,
            }),
        };
    } catch (error) {
        console.error('Error generating and uploading UUIDs:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to generate and upload UUIDs.',
                error: error.message,
            }),
        };
    }
};
