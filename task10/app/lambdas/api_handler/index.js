const { CognitoIdentityProviderClient, SignUpCommand, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient, PutItemCommand, QueryCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { APIGatewayProxyHandler } = require("aws-lambda");

// Initialize DynamoDB and Cognito Clients
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.region,
});

const dynamoDbClient = new DynamoDBClient({
  region: process.env.region,
});

// Define the Cognito User Pool ID and Client ID
const USER_POOL_ID = process.env.USER_POOL_ID;
const CLIENT_ID = process.env.CLIENT_ID;

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "Accept-Version": "*"
};

// Route Handlers
const handlers = {
  "/signup:POST": async (event) => {
    const { firstName, lastName, email, password } = JSON.parse(event.body);
    if (!email || !password || !firstName || !lastName) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields" }) };
    }
    
    // Cognito sign-up
    const signUpCommand = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName }
      ]
    });

    try {
      await cognitoClient.send(signUpCommand);
      return { statusCode: 200, body: JSON.stringify({ message: "Account created successfully" }) };
    } catch (error) {
      return { statusCode: 400, body: JSON.stringify({ message: `Error: ${error.message}` }) };
    }
  },

  "/signin:POST": async (event) => {
    const { email, password } = JSON.parse(event.body);
    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields" }) };
    }

    // Cognito sign-in
    const signInCommand = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    try {
      const data = await cognitoClient.send(signInCommand);
      return {
        statusCode: 200,
        body: JSON.stringify({ accessToken: data.AuthenticationResult.AccessToken })
      };
    } catch (error) {
      return { statusCode: 400, body: JSON.stringify({ message: `Error: ${error.message}` }) };
    }
  },

  "/tables:POST": async (event) => {
    const { number, places, isVip, minOrder } = JSON.parse(event.body);
    if (!number || !places) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields" }) };
    }

    // DynamoDB to create table
    const putTableCommand = new PutItemCommand({
      TableName: process.env.TABLES_TABLE,
      Item: {
        id: { S: uuidv4() },
        number: { N: String(number) },
        places: { N: String(places) },
        isVip: { BOOL: isVip },
        minOrder: minOrder ? { N: String(minOrder) } : { N: "0" },
      }
    });

    try {
      await dynamoDbClient.send(putTableCommand);
      return {
        statusCode: 200,
        body: JSON.stringify({ id: uuidv4() })
      };
    } catch (error) {
      return { statusCode: 400, body: JSON.stringify({ message: `Error: ${error.message}` }) };
    }
  },

  "/tables:GET": async (event) => {
    // DynamoDB to get all tables
    const queryTablesCommand = new QueryCommand({
      TableName: process.env.TABLES_TABLE,
    });

    try {
      const data = await dynamoDbClient.send(queryTablesCommand);
      return {
        statusCode: 200,
        body: JSON.stringify({ tables: data.Items })
      };
    } catch (error) {
      return { statusCode: 400, body: JSON.stringify({ message: `Error: ${error.message}` }) };
    }
  },

  "/tables/{tableId}:GET": async (event) => {
    const tableId = event.pathParameters.tableId;

    // DynamoDB to get table by ID
    const getTableCommand = new GetItemCommand({
      TableName: process.env.TABLES_TABLE,
      Key: {
        id: { S: tableId },
      }
    });

    try {
      const data = await dynamoDbClient.send(getTableCommand);
      return {
        statusCode: 200,
        body: JSON.stringify(data.Item)
      };
    } catch (error) {
      return { statusCode: 400, body: JSON.stringify({ message: `Error: ${error.message}` }) };
    }
  },

  "/reservations:POST": async (event) => {
    const { tableNumber, clientName, phoneNumber, date, slotTimeStart, slotTimeEnd } = JSON.parse(event.body);
    if (!tableNumber || !clientName || !phoneNumber || !date || !slotTimeStart || !slotTimeEnd) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields" }) };
    }

    // DynamoDB to create reservation
    const reservationId = uuidv4();
    const putReservationCommand = new PutItemCommand({
      TableName: process.env.RESERVATIONS_TABLE,
      Item: {
        reservationId: { S: reservationId },
        tableNumber: { N: String(tableNumber) },
        clientName: { S: clientName },
        phoneNumber: { S: phoneNumber },
        date: { S: date },
        slotTimeStart: { S: slotTimeStart },
        slotTimeEnd: { S: slotTimeEnd },
      }
    });

    try {
      await dynamoDbClient.send(putReservationCommand);
      return {
        statusCode: 200,
        body: JSON.stringify({ reservationId })
      };
    } catch (error) {
      return { statusCode: 400, body: JSON.stringify({ message: `Error: ${error.message}` }) };
    }
  },

  "/reservations:GET": async (event) => {
    // DynamoDB to fetch all reservations
    const queryReservationsCommand = new QueryCommand({
      TableName: process.env.RESERVATIONS_TABLE,
    });

    try {
      const data = await dynamoDbClient.send(queryReservationsCommand);
      return {
        statusCode: 200,
        body: JSON.stringify({ reservations: data.Items })
      };
    } catch (error) {
      return { statusCode: 400, body: JSON.stringify({ message: `Error: ${error.message}` }) };
    }
  },

  "default": async (event) => {
    return { statusCode: 404, body: JSON.stringify({ message: "Not Found" }) };
  }
};

// Lambda Handler
exports.handler = async (event) => {
  try {
    const route = getRouteKey(event);
    const handler = handlers[route] || handlers["default"];
    const response = await handler(event);

    return {
      statusCode: response.statusCode,
      body: JSON.stringify(response.body),
      headers: corsHeaders
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: `Error: ${error.message}` }),
      headers: corsHeaders
    };
  }
};

// Get route key
function getRouteKey(event) {
  let path = event.resource;
  if (path.match(/^\/tables\/\d+$/)) path = "/tables/{tableId}";
  return `${path}:${event.httpMethod}`;
}
