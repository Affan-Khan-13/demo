exports.handler = async (event) => {
    const response = {
        statusCode: 200,  // HTTP status code (top level, for API Gateway)
        body: JSON.stringify({  // The body contains a JSON string
            statusCode: 200,  // statusCode inside the body (as required)
            message: "Hello from Lambda"  // Your message inside the body
        })
    };
    return response;
};
