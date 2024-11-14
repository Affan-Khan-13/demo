const AWS = require("aws-sdk");
const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require("uuid");

exports.handler = async (event) => {
  const { path, httpMethod, headers, body } = event;
  console.log("API request:", event);

  const region = process.env.REGION;
  const tablesTable = process.env.TABLES_TABLE;
  const reservationsTable = process.env.RESERVATIONS_TABLE;
  const bookingUserpool = process.env.BOOKING_USERPOOL;

  const response = {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: "",
  };

  switch (path) {
    case "/signup":
      const userPoolId = await getUserPoolId();
      return await signUpUser(body, userPoolId, response);

    case "/signin":
      const signInUserPoolId = await getUserPoolId();
      const clientId = await createAppClient(signInUserPoolId);
      return await signInUser(body, signInUserPoolId, clientId, response);

    case "/tables":
      if (httpMethod === "POST") {
        const tableObject = buildTableObject(body);
        return await persistTable(tableObject, tablesTable, response);
      } else {
        return await scanTable(tablesTable, response);
      }

    case "/reservations":
      if (httpMethod === "POST") {
        const reservationObject = buildReservationObject(body);
        return await persistReservation(
          reservationObject,
          reservationsTable,
          tablesTable,
          response
        );
      } else {
        return await scanReservations(reservationsTable, response);
      }

    default:
      if (headers && headers.authorization) {
        return await findTable(headers.authorization, tablesTable, response);
      } else {
        response.statusCode = 400;
        response.body = JSON.stringify({
          error: "Authorization header missing",
        });
        return response;
      }
  }
};

const buildTableObject = (body) => {
  console.log("Calling buildTableObject...");
  return {
    id: parseInt(body.id),
    number: parseInt(body.number),
    places: parseInt(body.places),
    isVip: body.isVip === "true",
    minOrder: body.minOrder ? parseInt(body.minOrder) : null,
  };
};

const buildReservationObject = (body) => {
  console.log("Calling buildReservationObject...");
  return {
    tableNumber: parseInt(body.tableNumber),
    clientName: body.clientName,
    phoneNumber: body.phoneNumber,
    date: body.date,
    slotTimeStart: body.slotTimeStart,
    slotTimeEnd: body.slotTimeEnd,
  };
};

const buildTableResponse = (item) => {
  return {
    id: item.id,
    number: item.number,
    places: item.places,
    isVip: item.isVip,
    minOrder: item.minOrder || null,
  };
};

const buildReservationResponse = (item) => {
  return {
    tableNumber: item.tableNumber,
    clientName: item.clientName,
    phoneNumber: item.phoneNumber,
    date: item.date,
    slotTimeStart: item.slotTimeStart,
    slotTimeEnd: item.slotTimeEnd,
  };
};

const createAppClient = async (userPoolId) => {
  console.log("Calling createAppClient...");
  const params = {
    UserPoolId: userPoolId,
    ClientName: "api_client",
    ExplicitAuthFlows: ["ADMIN_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
  };

  const result = await cognito.createUserPoolClient(params).promise();
  console.log("createAppClient", result.UserPoolClient.ClientId);
  return result.UserPoolClient.ClientId;
};

const signUpUser = async (body, userPoolId, response) => {
  console.log("Calling signUpUser...");
  try {
    const params = {
      UserPoolId: userPoolId,
      Username: body.email,
      TemporaryPassword: body.password,
      UserAttributes: [{ Name: "email", Value: body.email }],
      MessageAction: "SUPPRESS",
    };

    await cognito.adminCreateUser(params).promise();
    console.log("User has been created");
    response.body = JSON.stringify({ message: "User created successfully" });
    return response;
  } catch (err) {
    console.error("Error while signing up user", err);
    response.statusCode = 400;
    response.body = JSON.stringify({ error: err.message });
    return response;
  }
};

const signInUser = async (body, userPoolId, clientId, response) => {
  console.log("Calling signInUser...");
  const params = {
    AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
    AuthParameters: {
      USERNAME: body.email,
      PASSWORD: body.password,
    },
    UserPoolId: userPoolId,
    ClientId: clientId,
  };

  try {
    const authResponse = await cognito.adminInitiateAuth(params).promise();
    console.log("Auth response:", authResponse);

    let authResult = authResponse.AuthenticationResult;

    if (authResponse.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      const challengeParams = {
        UserPoolId: userPoolId,
        ClientId: clientId,
        Session: authResponse.Session,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        ChallengeResponses: {
          NEW_PASSWORD: body.password,
          USERNAME: body.email,
        },
      };

      const challengeResponse = await cognito
        .adminRespondToAuthChallenge(challengeParams)
        .promise();
      console.log("Challenge passed:", challengeResponse.AuthenticationResult);
      authResult = challengeResponse.AuthenticationResult;
    }

    response.body = JSON.stringify({ idToken: authResult.IdToken });
    return response;
  } catch (err) {
    console.error("Error while signing in user", err);
    response.statusCode = 400;
    response.body = JSON.stringify({ error: err.message });
    return response;
  }
};

const getUserPoolId = async () => {
  console.log("Calling getUserPoolId...");
  try {
    const result = await cognito.listUserPools({ MaxResults: 50 }).promise();
    const userPool = result.UserPools.find(
      (pool) => pool.Name === process.env.BOOKING_USERPOOL
    );
    console.log("User pool id:", userPool.Id);
    return userPool.Id;
  } catch (err) {
    console.error("Error while listing user pools:", err);
    throw new Error("Unable to get UserPoolId");
  }
};

const persistTable = async (table, tablesTable, response) => {
  console.log("Calling persistTable...");
  try {
    const params = {
      TableName: tablesTable,
      Item: table,
    };
    await dynamoDb.put(params).promise();
    response.body = JSON.stringify({ id: table.id });
    return response;
  } catch (err) {
    console.error("Error while persisting table", err);
    response.statusCode = 400;
    response.body = JSON.stringify({ error: err.message });
    return response;
  }
};

const scanTable = async (tablesTable, response) => {
  console.log("Calling scanTable...");
  try {
    const params = {
      TableName: tablesTable,
    };
    const result = await dynamoDb.scan(params).promise();
    const tables = result.Items.map(buildTableResponse);
    response.body = JSON.stringify({ tables });
    return response;
  } catch (err) {
    console.error("Error while scanning table", err);
    response.statusCode = 400;
    response.body = JSON.stringify({ error: err.message });
    return response;
  }
};

const findTable = async (tableId, tablesTable, response) => {
  console.log("Calling findTable...");
  try {
    const params = {
      TableName: tablesTable,
      Key: { id: tableId },
    };
    const result = await dynamoDb.get(params).promise();
    if (!result.Item) {
      response.statusCode = 404;
      response.body = JSON.stringify({ error: "Table not found" });
      return response;
    }

    const table = buildTableResponse(result.Item);
    response.body = JSON.stringify(table);
    return response;
  } catch (err) {
    console.error("Error while finding table", err);
    response.statusCode = 400;
    response.body = JSON.stringify({ error: err.message });
    return response;
  }
};

const scanReservations = async (reservationsTable, response) => {
  console.log("Calling scanReservations...");
  try {
    const params = {
      TableName: reservationsTable,
    };
    const result = await dynamoDb.scan(params).promise();
    const reservations = result.Items.map(buildReservationResponse);
    response.body = JSON.stringify({ reservations });
    return response;
  } catch (err) {
    console.error("Error while scanning reservations", err);
    response.statusCode = 400;
    response.body = JSON.stringify({ error: err.message });
    return response;
  }
};

const persistReservation = async (
  reservation,
  reservationsTable,
  tablesTable,
  response
) => {
  console.log("Calling persistReservation...");
  try {
    const tableExists = await validateTable(reservation, tablesTable);
    const reservationExists = await validateReservation(
      reservation,
      reservationsTable
    );

    if (!tableExists || !reservationExists) {
      response.statusCode = 400;
      response.body = JSON.stringify({
        error:
          "The table does not exist or a reservation already exists for this slot.",
      });
      return response;
    }

    const params = {
      TableName: reservationsTable,
      Item: {
        id: uuidv4(),
        tableNumber: reservation.tableNumber,
        clientName: reservation.clientName,
        phoneNumber: reservation.phoneNumber,
        date: reservation.date,
        slotTimeStart: reservation.slotTimeStart,
        slotTimeEnd: reservation.slotTimeEnd,
      },
    };

    await dynamoDb.put(params).promise();
    response.body = JSON.stringify({ id: params.Item.id });
    return response;
  } catch (err) {
    console.error("Error while persisting reservation", err);
    response.statusCode = 400;
    response.body = JSON.stringify({ error: err.message });
    return response;
  }
};

const validateTable = async (reservation, tablesTable) => {
  const params = {
    TableName: tablesTable,
    FilterExpression: "#tn = :tableNumber",
    ExpressionAttributeNames: {
      "#tn": "tableNumber",
    },
    ExpressionAttributeValues: {
      ":tableNumber": reservation.tableNumber,
    },
  };

  const result = await dynamoDb.scan(params).promise();
  return result.Items.length === 1;
};

const validateReservation = async (reservation, reservationsTable) => {
  const params = {
    TableName: reservationsTable,
    FilterExpression:
      "#tn = :tableNumber and #sts = :slotTimeStart and #ste = :slotTimeEnd",
    ExpressionAttributeNames: {
      "#tn": "tableNumber",
      "#sts": "slotTimeStart",
      "#ste": "slotTimeEnd",
    },
    ExpressionAttributeValues: {
      ":tableNumber": reservation.tableNumber,
      ":slotTimeStart": reservation.slotTimeStart,
      ":slotTimeEnd": reservation.slotTimeEnd,
    },
  };

  const result = await dynamoDb.scan(params).promise();
  return result.Items.length === 0;
};
