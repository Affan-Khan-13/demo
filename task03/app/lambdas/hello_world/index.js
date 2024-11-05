exports.handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2)); // Log the event to debug

    const response = {
        statusCode: 200, // HTTP status code
        body: JSON.stringify({
            statusCode: 200,
            message: "Hello from Lambda"
        })
    };
    console.log("Response:", JSON.stringify(response)); // Log the response to debug
    return response;
};
