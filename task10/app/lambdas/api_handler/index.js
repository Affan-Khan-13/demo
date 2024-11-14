const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const uuid = require('uuid');

// Global variables
const userPoolId = process.env.CUPId;
const clientId = process.env.CUPClientId;
const tablesTable = process.env.Tables;
const reservationsTable = process.env.Reservations;

// Helper Functions
function isValidEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
}

function isValidPassword(password) {
    const minLength = 12;
    const hasNumber = /\d/;
    const hasUpperCase = /[A-Z]/;
    const hasLowerCase = /[a-z]/;
    const hasSpecialChar = /[!%^*$#-_]/;
    return (
        password.length >= minLength &&
        hasNumber.test(password) &&
        hasUpperCase.test(password) &&
        hasLowerCase.test(password) &&
        hasSpecialChar.test(password)
    );
}

exports.handler = async (event) => {
    const path = event.requestContext.http.path;
    const method = event.requestContext.http.method;
    const body = event.body ? JSON.parse(event.body) : {};

    const response = {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({}),
    };

    try {
        if (path === "/signup" && method === "POST") {
            response.body = await handleSignup(body);
        } else if (path === "/signin" && method === "POST") {
            response.body = await handleSignin(body);
        } else if (path === "/tables" && method === "GET") {
            response.body = await getTables();
        } else if (path === "/tables" && method === "POST") {
            response.body = await createTable(body);
        } else if (path === "/tables/{tableId}" && method === "GET") {
            response.body = await getTableDetails(event);
        } else if (path === "/reservations" && method === "POST") {
            response.body = await createReservation(body);
        } else if (path === "/reservations" && method === "GET") {
            response.body = await getReservations();
        } else {
            throw new Error("Unsupported route");
        }
    } catch (error) {
        response.statusCode = 400;
        response.body = JSON.stringify({ error: error.message });
    }

    return response;
};

// /signup POST
async function handleSignup(body) {
    const { firstName, lastName, email, password } = body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
        throw new Error("Missing required fields");
    }
    if (!isValidEmail(email)) {
        throw new Error("Invalid email format");
    }
    if (!isValidPassword(password)) {
        throw new Error("Password must be at least 12 characters long, contain a number, an uppercase letter, a lowercase letter, and one special character.");
    }

    const params = {
        ClientId: clientId,
        Username: email,
        Password: password,
        UserAttributes: [
            { Name: 'given_name', Value: firstName },
            { Name: 'family_name', Value: lastName },
            { Name: 'email', Value: email }
        ]
    };

    try {
        const data = await cognito.signUp(params).promise();
        const confirmParams = {
            Username: email,
            UserPoolId: userPoolId
        };
        await cognito.adminConfirmSignUp(confirmParams).promise();
        return { message: 'OK' };
    } catch (error) {
        throw new Error(`Sign-up failed: ${error.message}`);
    }
}

// /signin POST
async function handleSignin(body) {
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
        const data = await cognito.adminInitiateAuth(params).promise();
        const accessToken = data.AuthenticationResult.AccessToken;
        return { accessToken };
    } catch (error) {
        throw new Error('Authentication failed');
    }
}

// /tables GET
async function getTables() {
    const params = {
        TableName: tablesTable
    };

    try {
        const data = await dynamoDB.scan(params).promise();
        return { tables: data.Items };
    } catch (error) {
        throw new Error('Failed to retrieve tables');
    }
}

// /tables POST
async function createTable(body) {
    const { id, number, places, isVip, minOrder } = body;
    
    const params = {
        TableName: tablesTable,
        Item: {
            id: id,
            number: number,
            places: places,
            isVip: isVip,
            minOrder: minOrder || null
        }
    };

    try {
        await dynamoDB.put(params).promise();
        return { id };
    } catch (error) {
        throw new Error('Failed to create table');
    }
}

// /tables/{tableId} GET
async function getTableDetails(event) {
    const tableId = event.pathParameters.tableId;

    const params = {
        TableName: tablesTable,
        Key: { id: tableId }
    };

    try {
        const data = await dynamoDB.get(params).promise();
        return data.Item ? data.Item : { error: 'Table not found' };
    } catch (error) {
        throw new Error('Failed to retrieve table details');
    }
}

// /reservations POST
async function createReservation(body) {
    const { tableNumber, clientName, phoneNumber, date, slotTimeStart, slotTimeEnd } = body;
    const reservationId = uuid.v4();

    const params = {
        TableName: reservationsTable,
        Item: {
            reservationId: reservationId,
            tableNumber: tableNumber,
            clientName: clientName,
            phoneNumber: phoneNumber,
            date: date,
            slotTimeStart: slotTimeStart,
            slotTimeEnd: slotTimeEnd
        }
    };

    try {
        await dynamoDB.put(params).promise();
        return { reservationId };
    } catch (error) {
        throw new Error('Failed to create reservation');
    }
}

// /reservations GET
async function getReservations() {
    const params = {
        TableName: reservationsTable
    };

    try {
        const data = await dynamoDB.scan(params).promise();
        return { reservations: data.Items };
    } catch (error) {
        throw new Error('Failed to retrieve reservations');
    }
}
