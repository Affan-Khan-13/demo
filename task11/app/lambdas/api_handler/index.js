const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
    region: process.env.region
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const reservationsTable = process.env.RESERVATION;
const tablesTable = process.env.TABLE;

exports.handler = async (event) => {
    const userPoolId = process.env.USERPOOL;
    const clientId = process.env.USERPOOLCLIENT;

    // Parse the request body
    let body = JSON.parse(event.body);

    // Handle `/signup` endpoint
    if (event.resource === '/signup' && event.httpMethod === 'POST') {
        const { email, password } = body;
        const params = {
            ClientId: clientId,
            Username: email,
            Password: password,
            UserAttributes: [{ Name: 'email', Value: email }],
        };

        try {
            await cognitoIdentityServiceProvider.signUp(params).promise();
            const confirmParams = {
                Username: email,
                UserPoolId: userPoolId
            };
            await cognitoIdentityServiceProvider.adminConfirmSignUp(confirmParams).promise();

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: "User created successfully" })
            };
        } catch (error) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Signup failed", details: error.message })
            };
        }
    }

    // Handle `/signin` endpoint
    if (event.resource === '/signin' && event.httpMethod === 'POST') {
        const { email, password } = body;
        const params = {
            AuthFlow: 'ADMIN_NO_SRP_AUTH',
            UserPoolId: userPoolId,
            ClientId: clientId,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password
            }
        };

        try {
            const data = await cognitoIdentityServiceProvider.adminInitiateAuth(params).promise();
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    accessToken: data.AuthenticationResult.IdToken || 'blank'
                })
            };
        } catch (error) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Authentication failed", details: error })
            };
        }
    }

    // Handle `/tables` endpoint - GET method
    if (event.resource === '/tables' && event.httpMethod === 'GET') {
        const params = {
            TableName: tablesTable
        };
        try {
            const data = await dynamoDB.scan(params).promise();
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tables: data.Items }) // Returns all tables
            };
        } catch (error) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Failed to fetch tables", details: error.message })
            };
        }
    }

    // Handle `/tables` endpoint - POST method
    if (event.resource === '/tables' && event.httpMethod === 'POST') {
        try {
            const params = {
                TableName: tablesTable,
                Item: body
            };
            await dynamoDB.put(params).promise();
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: body.id })
            };
        } catch (e) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: "Error" })
            };
        }
    }

    // Handle `/tables/{tableId}` resource for GET method
    if (event.resource === '/tables/{tableId}' && event.httpMethod === 'GET') {
        const tableId = event.pathParameters.tableId;
        const params = {
            TableName: tablesTable,
            Key: { id: parseInt(tableId) }
        };
        try {
            const data = await dynamoDB.get(params).promise();
            if (data.Item) {
                return {
                    statusCode: 200,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...data.Item })
                };
            } else {
                return {
                    statusCode: 404,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: "Table not found" })
                };
            }
        } catch (error) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Failed to fetch table data", details: error.message })
            };
        }
    }

    // Handle `/reservations` endpoint - GET method
    if (event.resource === '/reservations' && event.httpMethod === 'GET') {
        try {
            const params = { TableName: reservationsTable };
            const data = await dynamoDB.scan(params).promise();
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reservations: data.Items }) // Replace with actual data
            };
        } catch (e) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: e.message })
            };
        }
    }

    // Check if the table exists
    async function isTableExist(tableNumber) {
        const parsedTableNumber = parseInt(tableNumber);
        try {
            const response = await dynamoDB
                .scan({
                    TableName: tablesTable,
                    FilterExpression: "#number = :tableNumberValue",
                    ExpressionAttributeNames: {
                        "#number": "number"
                    },
                    ExpressionAttributeValues: {
                        ":tableNumberValue": parsedTableNumber
                    },
                })
                .promise();
            return response.Items.length > 0;
        } catch (error) {
            return false;
        }
    }

    // Check for overlapping reservation
    async function hasOverlappingReservation(reservationData) {
        try {
            const tableNumber = reservationData.tableNumber;
            const response = await dynamoDB
                .scan({
                    TableName: reservationsTable,
                    ExpressionAttributeValues: {
                        ":tableNumberValue": parseInt(tableNumber)
                    },
                    FilterExpression: "tableNumber = :tableNumberValue",
                })
                .promise();
            for (const item of response.Items) {
                const existingStart = new Date(`${item.date} ${item.slotTimeStart}`).getTime();
                const existingEnd = new Date(`${item.date} ${item.slotTimeEnd}`).getTime();
                const newStart = new Date(`${reservationData.date} ${reservationData.slotTimeStart}`).getTime();
                const newEnd = new Date(`${reservationData.date} ${reservationData.slotTimeEnd}`).getTime();

                if (newStart < existingEnd && newEnd > existingStart) {
                    return true; // Overlap detected
                }
            }
            return false; // No overlap
        } catch (e) {
            throw e;
        }
    }

    // Handle `/reservations` endpoint - POST method
    if (event.resource === '/reservations' && event.httpMethod === 'POST') {
        try {
            const tableExistence = await isTableExist(body.tableNumber);
            if (!tableExistence) {
                return {
                    statusCode: 400,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: "Table does not exist" })
                };
            }

            const isOverlapping = await hasOverlappingReservation(body);
            if (isOverlapping) {
                return {
                    statusCode: 400,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: "Reservation overlaps with an existing one" })
                };
            }

            const id = uuidv4();
            const params = {
                TableName: reservationsTable,
                Item: {
                    "id": id,
                    "tableNumber": body.tableNumber,
                    "clientName": body.clientName,
                    "phoneNumber": body.phoneNumber,
                    "date": body.date,
                    "slotTimeStart": body.slotTimeStart,
                    "slotTimeEnd": body.slotTimeEnd
                }
            };
            await dynamoDB.put(params).promise();
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reservationId: id })
            };
        } catch (e) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: e.message })
            };
        }
    }

    return {
        statusCode: 404,
        body: JSON.stringify({ message: "Resource not found" })
    };
};
