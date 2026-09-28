"""
Hotel search tools for the TripZ Hotel Agent.

Uses SerpAPI Google Hotels with:
- HTTP connection reuse
- Request timing
- Compact hotel results
- Limited number of hotels
"""

import os
import time
import requests

from dotenv import load_dotenv


# ---------------------------------------------------------
# ENVIRONMENT CONFIGURATION
# ---------------------------------------------------------

load_dotenv()

SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")

if not SERPAPI_API_KEY:
    raise ValueError(
        "SERPAPI_API_KEY is not found in the TripZ .env file."
    )

SERPAPI_URL = "https://serpapi.com/search.json"

REQUEST_TIMEOUT = 20

# Reuse HTTP connections
HTTP_SESSION = requests.Session()


# ---------------------------------------------------------
# HOTEL RESULT FORMATTER
# ---------------------------------------------------------

def _extract_hotels(data: dict, limit: int = 5) -> list:
    """
    Extract only the useful hotel information.

    Returning a compact response reduces the amount of data
    that the Hotel Agent and orchestrator need to process.
    """

    hotels = data.get("properties", [])

    results = []

    for hotel in hotels[:limit]:
        results.append(
            {
                "name": hotel.get(
                    "name",
                    "Not available",
                ),
                "type": hotel.get(
                    "type",
                    "Not available",
                ),
                "description": hotel.get(
                    "description",
                    "",
                ),
                "rating": hotel.get(
                    "overall_rating",
                    "Not available",
                ),
                "reviews": hotel.get(
                    "reviews",
                    "Not available",
                ),
                "price": hotel.get(
                    "rate_per_night",
                    {},
                ),
                "total_price": hotel.get(
                    "total_rate",
                    {},
                ),
                "location": hotel.get(
                    "gps_coordinates",
                    {},
                ),
                "amenities": hotel.get(
                    "amenities",
                    [],
                )[:10],
            }
        )

    return results


# ---------------------------------------------------------
# SEARCH HOTELS
# ---------------------------------------------------------

def search_hotels(
    destination: str,
    check_in_date: str,
    check_out_date: str,
    adults: int = 1,
):
    """
    Search for hotels using SerpAPI Google Hotels.

    Args:
        destination: Destination city or location.
        check_in_date: Hotel check-in date in YYYY-MM-DD format.
        check_out_date: Hotel check-out date in YYYY-MM-DD format.
        adults: Number of adults.

    Returns:
        Compact hotel search results.
    """

    total_start = time.perf_counter()

    if not destination or not destination.strip():
        raise ValueError(
            "Hotel destination cannot be empty."
        )

    params = {
        "engine": "google_hotels",
        "q": destination.strip(),
        "check_in_date": check_in_date,
        "check_out_date": check_out_date,
        "adults": adults,
        "currency": "INR",
        "hl": "en",
        "api_key": SERPAPI_API_KEY,
    }

    request_start = time.perf_counter()

    response = HTTP_SESSION.get(
        SERPAPI_URL,
        params=params,
        timeout=REQUEST_TIMEOUT,
    )

    request_elapsed = time.perf_counter() - request_start

    print(
        f"[HotelTools] SerpAPI hotel request: "
        f"{request_elapsed:.3f} seconds "
        f"(status={response.status_code})"
    )

    if response.status_code != 200:
        raise RuntimeError(
            f"SerpAPI hotel request failed "
            f"({response.status_code}): "
            f"{response.text[:500]}"
        )

    data = response.json()

    if data.get("error"):
        raise RuntimeError(
            f"SerpAPI hotel search returned an error: "
            f"{data['error']}"
        )

    hotels = _extract_hotels(data)

    total_elapsed = time.perf_counter() - total_start

    print(
        f"[HotelTools] Total hotel search: "
        f"{total_elapsed:.3f} seconds "
        f"({len(hotels)} hotels returned)"
    )

    return {
        "destination": destination,
        "check_in_date": check_in_date,
        "check_out_date": check_out_date,
        "adults": adults,
        "currency": "INR",
        "hotels": hotels,
    }