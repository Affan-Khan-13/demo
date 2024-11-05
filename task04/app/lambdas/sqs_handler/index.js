const AWS = require('aws-sdk');

exports.handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        console.log('SQS Message Body:', record.body);

        try {
            const messageBody = JSON.parse(record.body);
            console.log("Parsed Message Body:", messageBody);
        } catch (error) {
            console.log("Error parsing message body:", error);
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Successfully processed SQS messages.",
        }),
    };
};
