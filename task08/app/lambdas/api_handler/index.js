// const { fetchWeather } = require('/opt/nodejs/fetchWeather')

exports.handler = async (event) => {
  try {
    // Fetch the weather data using the layer
    const weatherData = await fetchWeather();
    console.log(weatherData);
    
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

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m';

async function fetchWeather() {
  try {
    const response = await fetch(WEATHER_API_URL);  // Fetch the weather data
    if (!response.ok) {
      throw new Error("Failed to fetch weather data: " + response.statusText);
    }

    const data = await response.json();  // Parse the response as JSON
    console.log(data);  // Log the entire response
    return data;  // Return weather data

  } catch (error) {
    console.error("Error fetching weather data:", error);
    // throw new Error("Failed to fetch weather data.");
  }
}