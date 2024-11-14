const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');


const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
    region: process.env.region
});


const dynamoDB = new AWS.DynamoDB.DocumentClient();
const reservationsTable = process.env.RESERVATION
const tablesTable = process.env.TABLES

exports.handler = async (event) => {
    const userPoolId = process.env.booking_userpool;
    const clientId = process.env.booking_userpool_client;

    // Parse the request body
    let body = JSON.parse(event.body)

    console.log(body);
    console.log(event);


    // Handle `/signup` endpoint
    if (event.resource === '/signup' && event.httpMethod === 'POST') {
        console.log('THIS IS SIMG UP');

        const { email, password, firstName, lastName } = body;
        const params = {
            ClientId: clientId,
            Username: email,
            Password: password,
            UserAttributes: [{ Name: 'email', Value: email }],
            // MessageAction: "SUPPRESS", 
        };

        // const params = {
        //     ClientId:clientId,
        //     UserPoolId: userPoolId,
        //     Username: email,
        //     Password: password,
        //     MessageAction: "SUPPRESS", 
        //     UserAttributes: [
        //         { Name: 'email', Value: email },
        //         { Name: 'name', Value: firstName + lastName }
        //     ]
        // };
        try {
            const data = await cognitoIdentityServiceProvider.signUp(params).promise();
            const confirmParams = {
                Username: body.email,
                UserPoolId: userPoolId
            };
            const confirmedResult = await cognitoIdentityServiceProvider.adminConfirmSignUp(confirmParams).promise();

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: "User created successfully" })
            };
        } catch (error) {
            console.log(error);

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
            console.log(data);

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    accessToken: data.AuthenticationResult.IdToken ||
                        'blank'
                })
            };
        } catch (error) {
            console.log(error);

            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Authentication failed", details: error })
            };
        }
    }

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
            console.error(error);
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Failed to fetch tables", details: error.message })
            };
        }
    }


    if (event.resource === '/tables' && event.httpMethod === 'POST') {
        try {
            const params = {
                TableName: tablesTable,
                Item: body
            };
            await dynamoDB.put(params).promise()
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: body.id })
            };
        } catch (e) {
            console.log(e);
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: "error" })
            };
        }

    }


    // Handle `/tables/{tableId}` resource for GET method
    if (event.resource === '/tables/{tableId}' && event.httpMethod === 'GET') {
        const tableId = event.pathParameters.tableId;
        const params = {
            TableName: tablesTable,
            Key: { id: parseInt(tableId) } // Assuming `id` is the primary key in the tablesTable
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
            console.error(error);
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Failed to fetch table data", details: error.message })
            };
        }
    }






    if (event.resource === '/reservations' && event.httpMethod === 'GET') {
        try {
            const params = { TableName: reservationsTable }
            const data = await dynamoDB.scan(params).promise()
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reservations: data.Items }) // Replace with actual data
            };
        } catch (e) {
            console.log(e);

            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: e.message
            }
        }

    }

    async function checkIfTableExists(tableNumber) {
        const params = {
            TableName: tablesTable,
            FilterExpression: "number = :tableNumber",
            ExpressionAttributeValues: {
                ":tableNumber": parseInt(tableNumber)
            }
        };
        const data = await dynamoDB.get(params).promise();
        return data.Item !== undefined;
    }

    async function isValidTableNumber(tableNumber) {
        // const params = {
        //     TableName: tablesTable,
        //     Key: { id: parseInt(tableNumber) } // Assuming `id` is the primary key in the tablesTable
        // };
        const parsedTableNumber = parseInt(tableNumber)
        const params = {
            TableName: tablesTable,
            FilterExpression: "tableNumber = :tableNumber",
            ExpressionAttributeValues: {
                ":tableNumber": parsedTableNumber
            }
        };

        try {
            const data = await dynamoDB.get(params).promise();
            return data.Item !== undefined;
        } catch (error) {
            console.error("Error checking table existence:", error);
            return false;
        }
    }


    async function hasOverlappingReservation(reservationData) {
        const params = {
            TableName: reservationsTable,
            FilterExpression: "number = :number AND #date = :date",
            ExpressionAttributeNames: {
                "#date": "date"
            },
            ExpressionAttributeValues: {
                ":number": reservationData.tableNumber,
                ":date": reservationData.date
            }
        };

        const data = await dynamoDB.scan(params).promise();

        for (const item of data.Items) {
            const existingStart = new Date(`${item.date} ${item.slotTimeStart}`).getTime();
            const existingEnd = new Date(`${item.date} ${item.slotTimeEnd}`).getTime();
            const newStart = new Date(`${reservationData.date} ${reservationData.slotTimeStart}`).getTime();
            const newEnd = new Date(`${reservationData.date} ${reservationData.slotTimeEnd}`).getTime();

            // Check if the time slots overlap
            if (newStart < existingEnd && newEnd > existingStart) {
                return true; // Overlap detected
            }
        }

        return false; // No overlap
    }

    if (event.resource === '/reservations' && event.httpMethod === 'POST') {
        try {
            const reservationData = body;

            // Validate tableNumber field in reservationData
            const isTableReserved = await isValidTableNumber(body.tableNumber)
            if (isTableReserved) {

                return {
                    statusCode: 400,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: "TABLE IS RESERVEd" })
                };
            }
            const isExist = await checkIfTableExists(body.tableNumber)
            if (!isExist) {
                return {
                    statusCode: 400,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: "table do not exist" })
                };
            }
            if (!body.tableNumber) {
                return {
                    statusCode: 400,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: "NO TABLE DATA" })
                };
            }
            // if (await hasOverlappingReservation(reservationData)) {
            //     return {
            //         statusCode: 400,
            //         headers: { "Content-Type": "application/json" },
            //         body: JSON.stringify({ message: "Reservation time overlaps with an existing reservation" })
            //     };
            // }
            const id = uuidv4();
            const params = {
                TableName: reservationsTable, 
                Item: {
                    "id": id,
                }
            };
            await dynamoDB.put(params).promise();
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reservationId: id })
            };

    
        } catch (e) {
            console.log(e);
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: e.message})
            };
        }
    }


    return {
        statusCode: 404,
        body: JSON.stringify({ message: "Resource not found" })
    };
};