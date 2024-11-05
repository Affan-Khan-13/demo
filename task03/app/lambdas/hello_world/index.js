exports.handler = async (event) => {
    const response = {
        statusCode: 200, // HTTP status code
        body: JSON.stringify({ // Body contains statusCode and message
            statusCode: 200,
            message: "Hello from Lambda"
        })
    };
    return response;
};
