const axios = require("axios"); // Import axios from the layer

// The Lambda handler function
exports.handler = async (event) => {
  try {
    const WEATHER_API_URL =
      "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m";

    // Make a simple GET request to the Open-Meteo API without any parameters
    const response = await axios.get(WEATHER_API_URL);

    // Get the current weather and hourly forecast from the response
    const currentWeather = response.data.current;
    const hourlyWeather = response.data.hourly;

    // Format the data as per your requirements
    const formattedResponse = {
      latitude: response.data.latitude, // Latitude is part of the API response
      longitude: response.data.longitude, // Longitude is part of the API response
      generationtime_ms: response.data.generationtime_ms,
      utc_offset_seconds: response.data.utc_offset_seconds,
      timezone: response.data.timezone,
      timezone_abbreviation: response.data.timezone_abbreviation,
      elevation: response.data.elevation,
      hourly_units: response.data.hourly_units,
      hourly: {
        time: hourlyWeather.time,
        temperature_2m: hourlyWeather.temperature_2m,
        relative_humidity_2m: hourlyWeather.relative_humidity_2m,
        wind_speed_10m: hourlyWeather.wind_speed_10m,
      },
      current_units: response.data.current_units,
      current: {
        time: currentWeather.time,
        interval: 900, // Interval in seconds (example: 15 minutes)
        temperature_2m: currentWeather.temperature_2m,
        wind_speed_10m: currentWeather.wind_speed_10m,
      },
    };

    // Return the formatted response
    return {
      statusCode: 200,
      body: JSON.stringify(formattedResponse),
    };
  } catch (error) {
    console.error("Error fetching weather data:", error);

    // Return an error response if something goes wrong
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to fetch weather data" }),
    };
  }
};