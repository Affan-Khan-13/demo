const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const DYNAMODB_TABLE_NAME = process.env.target_table; // Table name passed via environment variable

exports.handler = async (event, context) => {
  // Loop through the DynamoDB Stream records
  for (const record of event.Records) {
    const eventName = record.eventName;

    // Handle INSERT event
    if (eventName === 'INSERT') {
      await addDataToAuditTable(record.dynamodb.NewImage);
    } 
    // Handle MODIFY event
    else if (eventName === 'MODIFY') {
      await modifyDataToAuditTable(record.dynamodb.NewImage, record.dynamodb.OldImage);
    } 
    // Handle REMOVE event (optional, not implemented here)
    else {
      console.log('Unhandled event type: ' + eventName);
    }
  }

  return 'Audit processing completed.';
};

// Add a new entry to the Audit table (INSERT event)
async function addDataToAuditTable(newImage) {
  const key = newImage.key.S; // Extract key from the new item
  const value = parseInt(newImage.value.N); // Extract the value

  const auditItem = {
    TableName: DYNAMODB_TABLE_NAME, // Target Audit table
    Item: {
      id: uuidv4(), // Unique ID for the audit entry
      itemKey: key,
      modificationTime: new Date().toISOString(),
      newValue: {
        key: key,
        value: value
      }
    }
  };

  try {
    await dynamoDB.put(auditItem).promise();
    console.log('Successfully added audit entry for INSERT event.');
  } catch (error) {
    console.error('Error inserting audit entry: ', error);
    throw new Error('Error inserting audit entry');
  }
}

// Modify an existing entry in the Audit table (MODIFY event)
async function modifyDataToAuditTable(newImage, oldImage) {
  const key = newImage.key.S; // Extract key from the new item
  const oldValue = parseInt(oldImage.value.N); // Extract old value
  const newValue = parseInt(newImage.value.N); // Extract new value

  // Only log if the value has changed
  if (newValue !== oldValue) {
    const auditItem = {
      TableName: DYNAMODB_TABLE_NAME, // Target Audit table
      Item: {
        id: uuidv4(), // Unique ID for the audit entry
        itemKey: key,
        modificationTime: new Date().toISOString(),
        updatedAttribute: 'value', // Specify the updated attribute
        oldValue: oldValue,
        newValue: newValue
      }
    };

    try {
      await dynamoDB.put(auditItem).promise();
      console.log('Successfully added audit entry for MODIFY event.');
    } catch (error) {
      console.error('Error inserting audit entry for MODIFY event: ', error);
      throw new Error('Error inserting audit entry for MODIFY event');
    }
  }
}
