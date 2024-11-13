const { fetchWeather } = require('/opt/weather-api/fetchWeather'); // Import from the Lambda layer

exports.handler = async (event) => {
  try {
    // Fetch the weather data using the layer
    const weatherData = await fetchWeather();
    
    // Return the weather data
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Weather data fetched successfully!",
        data: weatherData
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to fetch weather data",
        error: error.message,
      }),
    };
  }
};
