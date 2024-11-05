exports.handler = async (event) => {
    console.log("Received SNS Event:", JSON.stringify(event, null, 2));
    const snsMessage = event.Records[0].Sns.Message;
    console.log("SNS Message:", snsMessage);
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "SNS message logged successfully",
            snsMessage: snsMessage,
        }),
    };
};
