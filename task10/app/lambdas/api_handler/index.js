// const AWS = require('aws-sdk');

// const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
//     region: process.env.region // This uses the specified region or defaults to what's set in the AWS configuration
// });

// exports.handler = async (event) => {
//     console.log(event);
//     const body = JSON.parse(event.body);
//     const userPoolId = process.env.booking_userpool;
//     const clientId = process.env.booking_userpool_client;

//     if (event.resource === '/signin') {
//         const params = {
//             AuthFlow: 'ADMIN_NO_SRP_AUTH',
//             UserPoolId: userPoolId,
//             ClientId: clientId,
//             AuthParameters: {
//                 USERNAME: body.email,
//                 PASSWORD: body.password
//             }
//         };

//         try {
//             const data = await cognitoIdentityServiceProvider.adminInitiateAuth(params).promise();
//             const idToken = data.AuthenticationResult.IdToken;
//             return {
//                 statusCode: 200,
//                 headers: {
//                     "Content-Type": "application/json"
//                 },
//                 body: JSON.stringify({ idToken: idToken })
//             };
//         } catch (error) {
//             console.error(error);
//             return {
//                 statusCode: 500,
//                 headers: {
//                     "Content-Type": "application/json"
//                 },
//                 body: JSON.stringify({ error: "Authentication failed", details: error.message })
//             };
//         }
//     } else if (event.resource === '/signup') {
//         const params = {
//             ClientId: clientId,
//             Username: body.email,
//             Password: body.password,
//             UserAttributes: [{ Name: 'email', Value: body.email }]
//         };

//         try {
//             const data = await cognitoIdentityServiceProvider.signUp(params).promise();
//             const confirmParams = {
//                 Username: body.email,
//                 UserPoolId: userPoolId
//             };

//             const confirmedResult = await cognitoIdentityServiceProvider.adminConfirmSignUp(confirmParams).promise();
//             return {
//                 statusCode: 200,
//                 headers: {
//                     "Content-Type": "application/json"
//                 },
//                 body: JSON.stringify({ message: 'OK' })
//             };
//         } catch (error) {
//             console.error(error);
//             return {
//                 statusCode: 500,
//                 headers: {
//                     "Content-Type": "application/json"
//                 },
//                 body: JSON.stringify({ error: "Signing up failed", details: error.message })
//             };
//         }
//     } else {
//         // Handle unexpected resource paths
//         return {
//             statusCode: 400,
//             headers: {
//                 "Content-Type": "application/json"
//             },
//             body: JSON.stringify({ error: "Invalid resource path" })
//         };
//     }
// };


const { CognitoIdentityProviderClient } = require("@aws-sdk/client-cognito-identity-provider");
const RouteHandler = require("./routeHandler"); // Assuming the RouteHandler is a separate file

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.region,  // Use environment variable for region
  credentials: { // Credentials would typically come from the environment or IAM roles assigned to the Lambda
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Instantiate the RouteHandler
const routeHandler = new RouteHandler(cognitoClient);

// Lambda Handler
exports.handler = async (event) => {
  try {
    // Handle the request with RouteHandler
    const response = await routeHandler.handleRequest(event);

    // Add CORS headers to the response
    const corsHeaders = {
      "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Accept-Version": "*"
    };

    return {
      statusCode: response.statusCode || 200,  // Default to 200 if no status code is provided
      body: JSON.stringify(response.body),  // Assuming response.body is an object or string
      headers: { ...corsHeaders, ...response.headers }
    };
  } catch (error) {
    console.error("Error in process:", error);

    // Return error response with 400 status code
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Error in process: ${error.message}`
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*"
      }
    };
  }
};
