const axios = require('axios');

// URL for the Open-Meteo API
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m';

async function fetchWeather() {
  try {
    const response = await axios.get(WEATHER_API_URL);
    return response.data; // Return weather data
  } catch (error) {
    console.error("Error fetching weather data:", error);
    throw new Error("Failed to fetch weather data.");
  }
}

module.exports = { fetchWeather };
