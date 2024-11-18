const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
  region: process.env.region,
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const reservationsTable = process.env.revtable;
const tablesTable = process.env.tablestable;

function apiResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Accept-Version": "*",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const userPoolId = process.env.CUPId;
  const clientId = process.env.CUPClientId;

  // Check if event.body exists before attempting to parse
  let body;
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch (err) {
      console.error("Error parsing JSON:", err);
      return apiResponse(400, { error: "Invalid JSON in request body" });
    }
  } else {
    console.log("No body exists");
    return apiResponse(400, { error: "Request body is missing" });
  }

  console.log(body);
  console.log(event);

  // Handle `/signup` endpoint
  if (event.resource === "/signup" && event.httpMethod === "POST") {
    const { email, password, firstName, lastName } = body;
    if (!email || !password || !firstName || !lastName) {
      return apiResponse(400, { message: "Bad Request" });
    }

    const params = {
      ClientId: clientId,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    };
    try {
      await cognitoIdentityServiceProvider.signUp(params).promise();
      const confirmParams = {
        Username: body.email,
        UserPoolId: userPoolId,
      };
      await cognitoIdentityServiceProvider
        .adminConfirmSignUp(confirmParams)
        .promise();

      return apiResponse(200, { message: "User created successfully" });
    } catch (error) {
      console.log(error);

      return apiResponse(400, {
        error: "Signup failed",
        details: error.message,
      });
    }
  }

  // Handle `/signin` endpoint
  if (event.resource === "/signin" && event.httpMethod === "POST") {
    const { email, password } = body;
    if (!email || !password) {
      return apiResponse(400, { message: "Bad Request" });
    }
    const params = {
      AuthFlow: "ADMIN_NO_SRP_AUTH",
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    };

    try {
      const data = await cognitoIdentityServiceProvider
        .adminInitiateAuth(params)
        .promise();
      console.log(data);
      return apiResponse(200, {
        accessToken: data.AuthenticationResult.IdToken || "blank",
      });
    } catch (error) {
      console.log(error);
      return apiResponse(400, {
        error: "Authentication failed",
        details: error,
      });
    }
  }

  if (event.resource === "/tables" && event.httpMethod === "GET") {
    const params = {
      TableName: tablesTable,
    };
    try {
      const data = await dynamoDB.scan(params).promise();
      return apiResponse(200, { tables: data.Items });
    } catch (error) {
      console.error(error);
      return apiResponse(500, {
        error: "Failed to fetch tables",
        details: error.message,
      });
    }
  }

  if (event.resource === "/tables" && event.httpMethod === "POST") {
    try {
      const params = {
        TableName: tablesTable,
        Item: body,
      };
      await dynamoDB.put(params).promise();
      return apiResponse(200, { id: body.id });
    } catch (e) {
      console.log(e);
      return apiResponse(500, { message: "error" });
    }
  }

  // Handle `/tables/{tableId}` resource for GET method
  if (event.resource === "/tables/{tableId}" && event.httpMethod === "GET") {
    const tableId = event.pathParameters.tableId;
    const params = {
      TableName: tablesTable,
      Key: { id: parseInt(tableId) },
    };
    try {
      const data = await dynamoDB.get(params).promise();
      if (data.Item) {
        return apiResponse(200, { ...data.Item });
      } else {
        return apiResponse(404, { error: "Table not found" });
      }
    } catch (error) {
      console.error(error);
      return apiResponse(500, {
        error: "Failed to fetch table data",
        details: error.message,
      });
    }
  }

  if (event.resource === "/reservations" && event.httpMethod === "GET") {
    try {
      const params = { TableName: reservationsTable };
      const data = await dynamoDB.scan(params).promise();
      return apiResponse(200, { reservations: data.Items });
    } catch (e) {
      console.log(e);
      return apiResponse(500, e.message);
    }
  }

  // Other logic for checking table existence, overlapping reservations, etc.

  if (event.resource === "/reservations" && event.httpMethod === "POST") {
    try {
      // identify if table exists
      const tableExistence = await isTableExist(body.tableNumber);
      if (!tableExistence) {
        console.log("table does not exist");
        return apiResponse(400, { message: "table does not exist" });
      }
      // identify if new reservation is overlapping with older reservations
      const isOverlapping = await hasOverlappingReservation(body);
      if (isOverlapping) {
        console.log("You are overlapping a reservation. Cancel");
        return apiResponse(400, {
          message: "You are overlapping reservation. Cancel",
        });
      }

      const id = uuidv4();
      const params = {
        TableName: reservationsTable,
        Item: {
          id: id,
          tableNumber: body.tableNumber,
          clientName: body.clientName,
          phoneNumber: body.phoneNumber,
          date: body.date,
          slotTimeStart: body.slotTimeStart,
          slotTimeEnd: body.slotTimeEnd,
        },
      };
      await dynamoDB.put(params).promise();
      return apiResponse(200, { reservationId: id });
    } catch (e) {
      console.log(e);
      return apiResponse(500, { message: e.message });
    }
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ message: "Resource not found" }),
  };
};
