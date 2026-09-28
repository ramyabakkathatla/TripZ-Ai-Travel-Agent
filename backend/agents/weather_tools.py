import os
import requests
from dotenv import load_dotenv

load_dotenv()

WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")

def get_weather(location: str, days: int = 5):
    """
    Fetch current weather and forecast for a travel destination.

    Args:
        location: City or place name.
        days: Number of forecast days (1-14).

    Returns:
        Structured weather information.
    """

    if not WEATHER_API_KEY:
        return {
            "success": False,
            "error": "WEATHER_API_KEY is not configured."
        }

    # Keep days within WeatherAPI's supported forecast range.
    days = max(1, min(days, 14))

    url = "https://api.weatherapi.com/v1/forecast.json"

    params = {
        "key": WEATHER_API_KEY,
        "q": location,
        "days": days,
        "aqi": "no",
        "alerts": "yes",
    }

    try:
        response = requests.get(
            url,
            params=params,
            timeout=15
        )

        if response.status_code != 200:
            try:
                error_data = response.json()
                error_message = (
                    error_data.get("error", {}).get(
                        "message",
                        "Weather API request failed."
                    )
                )
            except Exception:
                error_message = "Weather API request failed."

            return {
                "success": False,
                "error": error_message
            }

        data = response.json()

        forecast_days = []

        for day in data.get("forecast", {}).get("forecastday", []):

            day_data = day.get("day", {})
            astro = day.get("astro", {})

            forecast_days.append({
                "date": day.get("date"),

                "max_temperature_c": day_data.get("maxtemp_c"),
                "min_temperature_c": day_data.get("mintemp_c"),
                "average_temperature_c": day_data.get("avgtemp_c"),

                "condition": (
                    day_data.get("condition", {}).get("text")
                ),

                "chance_of_rain": (
                    day_data.get("daily_chance_of_rain")
                ),

                "chance_of_snow": (
                    day_data.get("daily_chance_of_snow")
                ),

                "max_wind_kph": (
                    day_data.get("maxwind_kph")
                ),

                "total_precipitation_mm": (
                    day_data.get("totalprecip_mm")
                ),

                "sunrise": astro.get("sunrise"),
                "sunset": astro.get("sunset"),
            })

        return {
            "success": True,

            "location": {
                "name": data.get("location", {}).get("name"),
                "region": data.get("location", {}).get("region"),
                "country": data.get("location", {}).get("country"),
                "local_time": data.get("location", {}).get("localtime"),
            },

            "current": {
                "temperature_c": data.get("current", {}).get("temp_c"),
                "feels_like_c": data.get("current", {}).get("feelslike_c"),

                "condition": (
                    data.get("current", {})
                    .get("condition", {})
                    .get("text")
                ),

                "humidity": data.get("current", {}).get("humidity"),
                "wind_kph": data.get("current", {}).get("wind_kph"),

                "chance_of_rain": (
                    forecast_days[0]["chance_of_rain"]
                    if forecast_days
                    else None
                ),
            },

            "forecast": forecast_days,

            "alerts": data.get("alerts", {}).get("alert", []),
        }

    except requests.RequestException as e:
        return {
            "success": False,
            "error": f"Weather API request failed: {str(e)}"
        }

if __name__ == "__main__":

    result = get_weather(
        location="Hyderabad",
        days=5
    )

    print(result)

