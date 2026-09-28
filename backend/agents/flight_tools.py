
"""
TripZ Flight Search Tools.

Uses SerpAPI Google Flights for one-way and round-trip searches.

Latency optimizations:
- Cached location resolution
- Shared HTTP session
- Concurrent origin/destination resolution
- Compact flight results
- Request timing logs
"""

import os
import time
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor

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

# A shared session can reuse HTTP connections.
HTTP_SESSION = requests.Session()


# ---------------------------------------------------------
# HTTP REQUEST HELPER
# ---------------------------------------------------------

def _serpapi_request(params: dict, operation: str) -> dict:
    """
    Execute a SerpAPI request and log its duration.
    """

    start_time = time.perf_counter()

    response = HTTP_SESSION.get(
        SERPAPI_URL,
        params=params,
        timeout=REQUEST_TIMEOUT,
    )

    elapsed = time.perf_counter() - start_time

    print(
        f"[FlightTools] {operation} completed in "
        f"{elapsed:.3f} seconds "
        f"(status={response.status_code})"
    )

    if response.status_code != 200:
        raise RuntimeError(
            f"SerpAPI {operation} failed "
            f"({response.status_code}): {response.text[:500]}"
        )

    data = response.json()

    if data.get("error"):
        raise RuntimeError(
            f"SerpAPI {operation} returned an error: "
            f"{data['error']}"
        )

    return data


# ---------------------------------------------------------
# LOCATION RESOLVER
# ---------------------------------------------------------

@lru_cache(maxsize=128)
def resolve_location(location: str) -> dict:
    """
    Resolve a city, airport name, or IATA code.

    Results are cached to avoid repeated autocomplete calls.
    """

    if not location or not location.strip():
        raise ValueError(
            "Origin or destination cannot be empty."
        )

    location = location.strip()

    # Direct IATA airport code.
    if len(location) == 3 and location.isalpha():
        return {
            "input": location,
            "name": location.upper(),
            "type": "airport",
            "id": location.upper(),
        }

    params = {
        "engine": "google_flights_autocomplete",
        "q": location,
        "hl": "en",
        "gl": "in",
        "api_key": SERPAPI_API_KEY,
    }

    data = _serpapi_request(
        params=params,
        operation=f"Location resolution: {location}",
    )

    suggestions = data.get("suggestions", [])

    if not suggestions:
        raise ValueError(
            f"Could not find a flight location for '{location}'."
        )

    best = suggestions[0]

    suggestion_type = best.get("type")
    suggestion_name = best.get("name")
    suggestion_id = best.get("id")

    if suggestion_type == "city":
        if not suggestion_id:
            raise ValueError(
                f"No location ID found for '{location}'."
            )

        return {
            "input": location,
            "name": suggestion_name,
            "type": "city",
            "id": suggestion_id,
            "airports": best.get("airports", []),
        }

    if suggestion_id:
        return {
            "input": location,
            "name": suggestion_name,
            "type": suggestion_type or "location",
            "id": suggestion_id,
        }

    raise ValueError(
        f"Could not resolve flight location '{location}'."
    )


# ---------------------------------------------------------
# FLIGHT DATA FORMATTERS
# ---------------------------------------------------------

def _format_time(value) -> str:
    """Return a safe string for a time value."""

    if value is None:
        return "Not available"

    return str(value)


def _format_duration(value) -> str:
    """Convert duration values into readable text."""

    if value is None:
        return "Not available"

    if isinstance(value, int):
        hours, minutes = divmod(value, 60)

        if hours and minutes:
            return f"{hours}h {minutes}m"

        if hours:
            return f"{hours}h"

        return f"{minutes}m"

    return str(value)


def _extract_flight_options(data: dict, limit: int = 5) -> list:
    """
    Extract only the useful flight fields from SerpAPI data.

    This reduces the amount of data passed back to Gemini.
    """

    raw_options = data.get("best_flights") or data.get(
        "other_flights"
    ) or []

    formatted_options = []

    for option in raw_options[:limit]:
        flights = option.get("flights") or []

        if not flights:
            continue

        first_flight = flights[0]
        last_flight = flights[-1]

        segments = []

        for segment in flights:
            segments.append(
                {
                    "airline": segment.get(
                        "airline",
                        "Not available",
                    ),
                    "flight_number": segment.get(
                        "flight_number",
                        "Not available",
                    ),
                    "departure": segment.get(
                        "departure_airport",
                        {},
                    ),
                    "arrival": segment.get(
                        "arrival_airport",
                        {},
                    ),
                    "duration": _format_duration(
                        segment.get("duration")
                    ),
                }
            )

        formatted_options.append(
            {
                "airline": first_flight.get(
                    "airline",
                    "Not available",
                ),
                "flight_number": first_flight.get(
                    "flight_number",
                    "Not available",
                ),
                "departure": first_flight.get(
                    "departure_airport",
                    {},
                ),
                "arrival": last_flight.get(
                    "arrival_airport",
                    {},
                ),
                "duration": _format_duration(
                    option.get("total_duration")
                ),
                "price": option.get(
                    "price",
                    "Not available",
                ),
                "stops": max(len(flights) - 1, 0),
                "segments": segments,
            }
        )

    return formatted_options


def _compact_search_result(
    data: dict,
    trip_type: str,
) -> dict:
    """
    Convert raw SerpAPI response into a compact result.
    """

    return {
        "trip_type": trip_type,
        "currency": "INR",
        "flights": _extract_flight_options(data),
        "search_metadata": {
            "has_results": bool(
                data.get("best_flights")
                or data.get("other_flights")
            ),
            "error": data.get("error"),
        },
    }


# ---------------------------------------------------------
# SEARCH FLIGHTS
# ---------------------------------------------------------

def search_flights(
    origin: str,
    destination: str,
    outbound_date: str,
    adults: int = 1,
    return_date: str | None = None,
):
    """
    Search one-way or round-trip flights using SerpAPI.

    For one-way trips:
        - Two location resolutions
        - One outbound flight search

    For round trips:
        - Two location resolutions
        - One outbound search
        - One return search
    """

    total_start = time.perf_counter()

    # Resolve both locations concurrently.
    with ThreadPoolExecutor(max_workers=2) as executor:
        origin_future = executor.submit(
            resolve_location,
            origin,
        )

        destination_future = executor.submit(
            resolve_location,
            destination,
        )

        origin_location = origin_future.result()
        destination_location = destination_future.result()

    origin_id = origin_location["id"]
    destination_id = destination_location["id"]

    params = {
        "engine": "google_flights",
        "departure_id": origin_id,
        "arrival_id": destination_id,
        "outbound_date": outbound_date,
        "adults": adults,
        "currency": "INR",
        "hl": "en",
        "api_key": SERPAPI_API_KEY,
    }

    if return_date:
        params["type"] = "1"
        params["return_date"] = return_date
    else:
        params["type"] = "2"

    outbound_data = _serpapi_request(
        params=params,
        operation="Outbound flight search",
    )

    base_result = {
        "origin": {
            "input": origin,
            "resolved": origin_location,
        },
        "destination": {
            "input": destination,
            "resolved": destination_location,
        },
        "outbound_date": outbound_date,
        "adults": adults,
    }

    # -----------------------------------------------------
    # ONE-WAY TRIP
    # -----------------------------------------------------

    if not return_date:
        total_elapsed = time.perf_counter() - total_start

        print(
            f"[FlightTools] Total one-way search time: "
            f"{total_elapsed:.3f} seconds"
        )

        return {
            **base_result,
            "trip_type": "one_way",
            "outbound": _compact_search_result(
                outbound_data,
                "one_way",
            ),
        }

    # -----------------------------------------------------
    # ROUND-TRIP TRIP
    # -----------------------------------------------------

    outbound_flights = (
        outbound_data.get("best_flights")
        or outbound_data.get("other_flights")
        or []
    )

    if not outbound_flights:
        return {
            **base_result,
            "trip_type": "round_trip",
            "return_date": return_date,
            "outbound": _compact_search_result(
                outbound_data,
                "round_trip",
            ),
            "inbound": {
                "error": "No outbound flights were found."
            },
        }

    departure_token = outbound_flights[0].get(
        "departure_token"
    )

    if not departure_token:
        return {
            **base_result,
            "trip_type": "round_trip",
            "return_date": return_date,
            "outbound": _compact_search_result(
                outbound_data,
                "round_trip",
            ),
            "inbound": {
                "error": (
                    "No departure token was provided "
                    "for the outbound flight."
                ),
            },
        }

    return_params = {
        "engine": "google_flights",
        "departure_id": origin_id,
        "arrival_id": destination_id,
        "outbound_date": outbound_date,
        "return_date": return_date,
        "departure_token": departure_token,
        "type": "1",
        "currency": "INR",
        "hl": "en",
        "api_key": SERPAPI_API_KEY,
    }

    inbound_data = _serpapi_request(
        params=return_params,
        operation="Return flight search",
    )

    total_elapsed = time.perf_counter() - total_start

    print(
        f"[FlightTools] Total round-trip search time: "
        f"{total_elapsed:.3f} seconds"
    )

    return {
        **base_result,
        "trip_type": "round_trip",
        "return_date": return_date,
        "outbound": _compact_search_result(
            outbound_data,
            "round_trip",
        ),
        "inbound": _compact_search_result(
            inbound_data,
            "round_trip",
        ),
    }