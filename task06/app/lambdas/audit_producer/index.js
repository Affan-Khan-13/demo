const AWS = require('aws-sdk');
const uuid = require('uuid');
const moment = require('moment'); // For formatting timestamps like in Java's DateTimeFormatter

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const targetTable = process.env.target_table;

exports.handler = async (event, context) => {
    try {
        for (const record of event.Records) {
            const eventName = record.eventName;
            
            if (eventName === 'INSERT') {
                await addDataToAuditTable(record.dynamodb.NewImage);
            } else if (eventName === 'MODIFY') {
                await modifyDataToAuditTable(record.dynamodb.NewImage, record.dynamodb.OldImage);
            } else {
                // If not INSERT or MODIFY, skip processing
                continue;
            }
        }
        return "Success"; // or return an empty string if that’s what is expected
    } catch (error) {
        console.error('Error processing DynamoDB event:', error);
        throw error;
    }
};

async function addDataToAuditTable(newImage) {
    const key = newImage.key.S;
    const value = parseInt(newImage.value.N);
    
    const newValue = {
        key: key,
        value: value
    };
    
    const auditItem = {
        TableName: targetTable,
        Item: {
            id: uuid.v4(),
            itemKey: key,
            modificationTime: moment().toISOString(), // Use ISO format
            newValue: newValue
        }
    };
    
    await dynamoDb.put(auditItem).promise();
}

async function modifyDataToAuditTable(newImage, oldImage) {
    const key = newImage.key.S;
    const oldValue = parseInt(oldImage.value.N);
    const newValue = parseInt(newImage.value.N);
    
    if (newValue !== oldValue) {
        const updateAuditItem = {
            TableName: targetTable,
            Item: {
                id: uuid.v4(),
                itemKey: key,
                modificationTime: moment().toISOString(), // Use ISO format
                updatedAttribute: 'value',
                oldValue: oldValue,
                newValue: newValue
            }
        };
        
        await dynamoDb.put(updateAuditItem).promise();
    }
}
