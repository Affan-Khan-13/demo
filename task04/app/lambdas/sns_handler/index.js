exports.handler = async (event) => {
    for (const record of event.Records) {
        const snsMessage = record.Sns.Message;
        console.log('Received SNS message:', snsMessage);
    }
    const response = {
        statusCode: 200,
        body: JSON.stringify('SNS message logged successfully!'),
    };
    return response;
};
