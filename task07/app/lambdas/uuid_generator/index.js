const AWS = require('aws-sdk');
const uuid = require('uuid');
const s3 = new AWS.S3();

// Global variables from environment variables
const BUCKET_NAME = process.env.S3_BUCKET_NAME;  // S3 Bucket name from env variable

exports.handler = async (event) => {
    try {
        // Generate 10 random UUIDs
        const uuids = Array.from({ length: 10 }, () => uuid.v4());

        // Get the current timestamp for the file name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Format to avoid invalid filename characters
        const fileName = `uuids-${timestamp}.json`; // Include execution start time in the file name

        // Prepare the S3 bucket and object parameters
        const s3Params = {
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: JSON.stringify(uuids),
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
