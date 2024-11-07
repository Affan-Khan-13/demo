exports.handler = async (event) => {
    event.Records.forEach((record) => {
        console.log('SQS Message Body:', record.body);
    });

    console.log("Hello from Lambda");

    const response = {
        statusCode: 200,
        body: JSON.stringify({
            message: "Hello from Lambda"
        }),
    };

    return response;
};
