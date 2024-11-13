const axios = require('axios');  // Axios for API calls
const AWS = require('aws-sdk');  // AWS SDK to interact with DynamoDB
const { v4: uuidv4 } = require('uuid'); // For generating UUIDs

// Create DynamoDB DocumentClient instance
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    // Fetch the table name from the environment variable
    const targetTable = process.env.target_table;

    // Open-Meteo API URL (You can customize with other parameters as needed)
    const weatherApiUrl = 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m';

    try {
        // Fetch weather data from the Open-Meteo API
        const response = await axios.get(weatherApiUrl);
        const weatherData = response.data;

        // Format the data to match the expected structure
        const weatherRecord = {
            id: uuidv4(), // Generate a new UUID for the record
            forecast: {
                elevation: weatherData.elevation,
                generationtime_ms: weatherData.generationtime_ms,
                hourly: {
                    temperature_2m: weatherData.hourly.temperature_2m,
                    time: weatherData.hourly.time
                },
                hourly_units: {
                    temperature_2m: weatherData.hourly_units.temperature_2m,
                    time: weatherData.hourly_units.time
                },
                latitude: weatherData.latitude,
                longitude: weatherData.longitude,
                timezone: weatherData.timezone,
                timezone_abbreviation: weatherData.timezone_abbreviation,
                utc_offset_seconds: weatherData.utc_offset_seconds
            }
        };

        // Define the DynamoDB parameters
        const params = {
            TableName: targetTable,
            Item: weatherRecord
        };

        // Push the weather data into DynamoDB
        await docClient.put(params).promise();

        // Return a success response
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Weather data inserted into DynamoDB successfully' })
        };

    } catch (error) {
        console.error('Error fetching weather data or inserting into DynamoDB:', error);

        // Return an error response
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to insert weather data into DynamoDB', error: error.message })
        };
    }
};
