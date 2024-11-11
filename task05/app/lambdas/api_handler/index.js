const AWS = require('aws-sdk');
const uuid = require('uuid');
const moment = require('moment');

// DynamoDB client setup
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// Hardcoding the table name as "Events"
const DYNAMODB_TABLE_NAME = process.env.target_table;

exports.handler = async (event, context) => {
  try {
    // Extracting data from the incoming event
    const { principalId, content } = event;
    
    // Generating a new UUID
    const newId = uuid.v4();
    
    // Getting the current UTC time in ISO 8601 format
    const currentTime = moment.utc().toISOString();

    // Prepare the item to put into DynamoDB
    const item = {
      TableName: DYNAMODB_TABLE_NAME,
      Item: {
        id: newId,
        principalId: principalId,
        createdAt: currentTime,
        body: content
      }
    };

    // Insert the item into the DynamoDB table
    await dynamoDb.put(item).promise();

    // Prepare the event object to return
    const eventObj = {
      id: newId,
      principalId: principalId,
      createdAt: currentTime,
      body: content
    };

    // Return the response
    return {
      statusCode: 201,
      body: JSON.stringify({ event: eventObj })
    };
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};
