const AWS = require('aws-sdk');
const uuid = require('uuid');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get the DynamoDB table name from environment variables
const EVENTS_TABLE = "Events";

exports.handler = async (event) => {
  // Parse the request body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Invalid JSON in request body'
      }),
    };
  }

  // Extract principalId and content from the request body
  const { principalId, content } = body;

  if (!principalId || !content) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Missing required fields: principalId or content'
      }),
    };
  }

  // Generate unique event ID and timestamp
  const eventId = uuid.v4();
  const createdAt = new Date().toISOString();

  // Create event data object to store in DynamoDB
  const eventData = {
    id: eventId,
    principalId,
    createdAt,
    body: content,
  };

  // Insert the event data into DynamoDB
  try {
    await dynamoDB.put({
      TableName: EVENTS_TABLE,
      Item: eventData
    }).promise();
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error saving event to DynamoDB: ${error.message}`
      }),
    };
  }

  // Return a response with the created event data
  return {
    statusCode: 201,
    body: JSON.stringify({
      event: eventData
    }),
  };
};
