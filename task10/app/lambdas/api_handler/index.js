const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Global variable to store environment variables
const TABLES = process.env.Tables;
const RESERVATIONS = process.env.Reservations;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

exports.handler = async (event) => {
    const path = event.requestContext.http.path;
    const method = event.requestContext.http.method;
    const response = {
        statusCode: 200,
        body: JSON.stringify({}),
    };

    try {
        // Handle based on API endpoint and method
        if (path === "/signup" && method === "POST") {
            response.body = await handleSignup(event);
        } else if (path === "/signin" && method === "POST") {
            response.body = await handleSignin(event);
        } else if (path === "/tables" && method === "GET") {
            response.body = await getTables(event);
        } else if (path === "/tables" && method === "POST") {
            response.body = await createTable(event);
        } else if (path === "/reservations" && method === "POST") {
            response.body = await createReservation(event);
        } else if (path === "/reservations" && method === "GET") {
            response.body = await getReservations(event);
        } else {
            throw new Error("Unsupported route");
        }
    } catch (error) {
        response.statusCode = 400;
        response.body = JSON.stringify({ error: error.message });
    }

    return response;
};

// Validate Email format
function isValidEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
}

// Validate Password complexity
function isValidPassword(password) {
    const minLength = 8;
    const hasNumber = /\d/;
    const hasUpperCase = /[A-Z]/;
    const hasLowerCase = /[a-z]/;
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/;

    return (
        password.length >= minLength &&
        hasNumber.test(password) &&
        hasUpperCase.test(password) &&
        hasLowerCase.test(password) &&
        hasSpecialChar.test(password)
    );
}

// Handler for /signup POST
async function handleSignup(event) {
    const { firstName, lastName, email, password } = JSON.parse(event.body);

    // Validate input
    if (!email || !password || !firstName || !lastName) {
        throw new Error("Missing required fields");
    }

    // Validate email format
    if (!isValidEmail(email)) {
        throw new Error("Invalid email format");
    }

    // Validate password
    if (!isValidPassword(password)) {
        throw new Error("Password does not meet the required complexity");
    }

    // Check if the user already exists
    try {
        await cognito.adminGetUser({
            UserPoolId: COGNITO_USER_POOL_ID,
            Username: email,
        }).promise();
        throw new Error("User already exists");
    } catch (error) {
        if (error.code !== "UserNotFoundException") {
            throw error;
        }
    }

    // Create the user
    const params = {
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: email,
        UserAttributes: [
            { Name: "email", Value: email },
            { Name: "given_name", Value: firstName },
            { Name: "family_name", Value: lastName },
        ],
        MessageAction: "SUPPRESS", // Prevent sending email verification at sign-up
        TemporaryPassword: password,
    };

    await cognito.adminCreateUser(params).promise();
    return { message: "User created successfully" };
}

// Handler for /signin POST
async function handleSignin(event) {
    const { email, password } = JSON.parse(event.body);

    const params = {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: COGNITO_USER_POOL_ID, // Using global variable for UserPool ID
        AuthParameters: {
            USERNAME: email,
            PASSWORD: password,
        },
    };

    try {
        const response = await cognito.initiateAuth(params).promise();
        const accessToken = response.AuthenticationResult.AccessToken;
        return { accessToken };
    } catch (error) {
        if (error.code === 'UserNotFoundException' || error.code === 'NotAuthorizedException') {
            throw new Error('Invalid email or password');
        }
        throw error;
    }
}

// Handler for /tables GET
async function getTables(event) {
    const params = {
        TableName: TABLES, // Using global variable for table name
    };

    const data = await dynamoDB.scan(params).promise();
    return { tables: data.Items };
}

// Handler for /tables POST
async function createTable(event) {
    const { id, number, places, isVip, minOrder } = JSON.parse(event.body);

    const params = {
        TableName: TABLES, // Using global variable for table name
        Item: {
            id: id,
            number: number,
            places: places,
            isVip: isVip,
            minOrder: minOrder || null,
        },
    };

    await dynamoDB.put(params).promise();
    return { id };
}

// Handler for /reservations POST
async function createReservation(event) {
    const { tableNumber, clientName, phoneNumber, date, slotTimeStart, slotTimeEnd } = JSON.parse(event.body);

    const reservationId = AWS.util.uuid.v4(); // Generate unique reservation ID

    const params = {
        TableName: RESERVATIONS, // Using global variable for reservations table
        Item: {
            reservationId: reservationId,
            tableNumber: tableNumber,
            clientName: clientName,
            phoneNumber: phoneNumber,
            date: date,
            slotTimeStart: slotTimeStart,
            slotTimeEnd: slotTimeEnd,
        },
    };

    await dynamoDB.put(params).promise();
    return { reservationId };
}

// Handler for /reservations GET
async function getReservations(event) {
    const params = {
        TableName: RESERVATIONS, // Using global variable for reservations table
    };

    const data = await dynamoDB.scan(params).promise();
    return { reservations: data.Items };
}
