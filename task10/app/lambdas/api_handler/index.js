const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  GetItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { v4: uuidv4 } = require("uuid");
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
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "Accept-Version": "*",
};

// Route Handlers
const handlers = {
  "/signup:POST": async (event) => {
    const body = JSON.parse(event.body);
    const userPoolId = process.env.USER_POOL_ID; // Use the correct environment variable
    const clientId = process.env.CLIENT_ID; // Use the correct environment variable

    const params = {
      ClientId: clientId,
      Username: body.email,
      Password: body.password,
      UserAttributes: [{ Name: "email", Value: body.email }],
    };

    try {
      // Sign up the user
      const data = await cognitoIdentityServiceProvider
        .signUp(params)
        .promise();

      // Immediately confirm the user
      const confirmParams = {
        Username: body.email,
        UserPoolId: userPoolId,
      };

      await cognitoIdentityServiceProvider
        .adminConfirmSignUp(confirmParams)
        .promise();

      return {
        statusCode: 201, // Resource created successfully
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "User registered and confirmed successfully",
        }),
      };
    } catch (error) {
      console.error(error);
      return {
        statusCode: 400, // Bad request (e.g., invalid email, password too weak, etc.)
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Signing up failed",
          details: error.message,
        }),
      };
    }
  },

  // Handler for /signin endpoint
  "/signin:POST": async (event) => {
    const body = JSON.parse(event.body);
    const userPoolId = process.env.USER_POOL_ID; // Use the correct environment variable
    const clientId = process.env.CLIENT_ID; // Use the correct environment variable

    const params = {
      AuthFlow: "ADMIN_NO_SRP_AUTH",
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthParameters: {
        USERNAME: body.email,
        PASSWORD: body.password,
      },
    };

    try {
      // Authenticate the user
      const data = await cognitoIdentityServiceProvider
        .adminInitiateAuth(params)
        .promise();

      const idToken = data.AuthenticationResult.IdToken;
      const accessToken = data.AuthenticationResult.AccessToken; // Optional: Add if needed for future requests

      return {
        statusCode: 200, // OK
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken: idToken, accessToken: accessToken }),
      };
    } catch (error) {
      console.error(error);
      return {
        statusCode: 400, // Bad request (invalid credentials)
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Authentication failed",
          details: error.message,
        }),
      };
    }
  },

  "/tables:POST": async (event) => {
    const { number, places, isVip, minOrder } = JSON.parse(event.body);
    if (!number || !places) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required fields" }),
      };
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
      },
    });

    try {
      await dynamoDbClient.send(putTableCommand);
      return {
        statusCode: 200,
        body: JSON.stringify({ id: uuidv4() }),
      };
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Error: ${error.message}` }),
      };
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
        body: JSON.stringify({ tables: data.Items }),
      };
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Error: ${error.message}` }),
      };
    }
  },

  "/tables/{tableId}:GET": async (event) => {
    const tableId = event.pathParameters.tableId;

    // DynamoDB to get table by ID
    const getTableCommand = new GetItemCommand({
      TableName: process.env.TABLES_TABLE,
      Key: {
        id: { S: tableId },
      },
    });

    try {
      const data = await dynamoDbClient.send(getTableCommand);
      return {
        statusCode: 200,
        body: JSON.stringify(data.Item),
      };
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Error: ${error.message}` }),
      };
    }
  },

  "/reservations:POST": async (event) => {
    const {
      tableNumber,
      clientName,
      phoneNumber,
      date,
      slotTimeStart,
      slotTimeEnd,
    } = JSON.parse(event.body);
    if (
      !tableNumber ||
      !clientName ||
      !phoneNumber ||
      !date ||
      !slotTimeStart ||
      !slotTimeEnd
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required fields" }),
      };
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
      },
    });

    try {
      await dynamoDbClient.send(putReservationCommand);
      return {
        statusCode: 200,
        body: JSON.stringify({ reservationId }),
      };
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Error: ${error.message}` }),
      };
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
        body: JSON.stringify({ reservations: data.Items }),
      };
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Error: ${error.message}` }),
      };
    }
  },

  default: async (event) => {
    return { statusCode: 404, body: JSON.stringify({ message: "Not Found" }) };
  },
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
      headers: corsHeaders,
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: `Error: ${error.message}` }),
      headers: corsHeaders,
    };
  }
};

// Get route key
function getRouteKey(event) {
  let path = event.resource;
  if (path.match(/^\/tables\/\d+$/)) path = "/tables/{tableId}";
  return `${path}:${event.httpMethod}`;
}
