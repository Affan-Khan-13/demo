const axios = require("axios"); // Import axios from the layer

// The Lambda handler function
exports.handler = async (event) => {
  try {
    const WEATHER_API = "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m"
      // Make a simple GET request to the Open-Meteo API without any parameters
      const response = await axios.get(WEATHER_API);

      // Return the entire response from the API as-is
      return {
          statusCode: 200,
          body: JSON.stringify(response.data)  // Directly send the full API response
      };

  } catch (error) {
      console.error('Error fetching weather data:', error);

      // Return an error response if something goes wrong
      return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Failed to fetch weather data' })
      };
  }
};