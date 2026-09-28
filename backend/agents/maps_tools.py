"""
Maps tools for the TripZ Maps Agent.

Provides:
- Driving directions
- Walking directions
- Bicycling directions
- Transit directions
- Alternative routes
- Waypoints
- Encoded polylines
- Turn-by-turn directions
- Landmarks along driving routes

Latency optimizations:
- Shared HTTP session
- Concurrent route requests
- Request timing logs
- Limited landmark results
- Compact route processing
"""

import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from dotenv import load_dotenv


# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

if not GOOGLE_MAPS_API_KEY:
    raise RuntimeError(
        "GOOGLE_MAPS_API_KEY is not configured."
    )

GOOGLE_ROUTES_URL = (
    "https://routes.googleapis.com/directions/v2:computeRoutes"
)

GOOGLE_PLACES_SEARCH_URL = (
    "https://places.googleapis.com/v1/places:searchText"
)

REQUEST_TIMEOUT = 20
MAX_LANDMARKS_PER_ROUTE = 3

SUPPORTED_MODES = {
    "DRIVE",
    "WALK",
    "BICYCLE",
    "TRANSIT",
}

HTTP_SESSION = requests.Session()


# ---------------------------------------------------------
# HTTP HELPERS
# ---------------------------------------------------------

def _post_json(
    url: str,
    headers: dict,
    body: dict,
    operation: str,
) -> dict:
    """
    Send a POST request and log its duration.
    """

    start_time = time.perf_counter()

    response = HTTP_SESSION.post(
        url,
        headers=headers,
        json=body,
        timeout=REQUEST_TIMEOUT,
    )

    elapsed = time.perf_counter() - start_time

    print(
        f"[MapsTools] {operation}: "
        f"{elapsed:.3f} seconds "
        f"(status={response.status_code})"
    )

    if response.status_code != 200:
        raise RuntimeError(
            f"{operation} failed "
            f"({response.status_code}): "
            f"{response.text[:500]}"
        )

    data = response.json()

    if data.get("error"):
        raise RuntimeError(
            f"{operation} returned an error: "
            f"{data['error']}"
        )

    return data


# ---------------------------------------------------------
# LANDMARK SEARCH
# ---------------------------------------------------------

def search_landmarks_along_route(
    encoded_polyline: str,
    max_results: int = MAX_LANDMARKS_PER_ROUTE,
):
    """
    Find real landmarks or tourist attractions near a route.
    """

    if not encoded_polyline:
        return []

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": (
            "places.id,"
            "places.displayName,"
            "places.formattedAddress,"
            "places.location,"
            "places.types"
        ),
    }

    body = {
        "textQuery": "tourist attractions landmarks",
        "pageSize": min(max_results, 10),
        "searchAlongRouteParameters": {
            "polyline": {
                "encodedPolyline": encoded_polyline
            }
        },
    }

    data = _post_json(
        url=GOOGLE_PLACES_SEARCH_URL,
        headers=headers,
        body=body,
        operation="Landmark search",
    )

    landmarks = []

    for place in data.get("places", []):
        display_name = place.get("displayName", {})
        name = display_name.get("text")

        if not name:
            continue

        landmarks.append(
            {
                "place_id": place.get("id"),
                "name": name,
                "address": place.get("formattedAddress"),
                "location": place.get("location"),
                "types": place.get("types", []),
            }
        )

        if len(landmarks) >= max_results:
            break

    return landmarks


# ---------------------------------------------------------
# SINGLE ROUTE SEARCH
# ---------------------------------------------------------

def get_route(
    origin: str,
    destination: str,
    mode: str = "DRIVE",
    waypoints: list[str] | None = None,
    alternatives: bool = False,
):
    """
    Get routes between origin and destination.
    """

    mode = mode.upper()

    if mode not in SUPPORTED_MODES:
        raise ValueError(
            f"Unsupported travel mode: {mode}. "
            f"Supported modes: {sorted(SUPPORTED_MODES)}"
        )

    intermediates = []

    if waypoints:
        for waypoint in waypoints:
            if waypoint and waypoint.strip():
                intermediates.append(
                    {
                        "address": waypoint.strip()
                    }
                )

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": (
            "routes.distanceMeters,"
            "routes.duration,"
            "routes.polyline.encodedPolyline,"
            "routes.legs.steps.navigationInstruction,"
            "routes.legs.steps.distanceMeters,"
            "routes.legs.steps.staticDuration"
        ),
    }

    body = {
        "origin": {
            "address": origin
        },
        "destination": {
            "address": destination
        },
        "travelMode": mode,
        "computeAlternativeRoutes": alternatives,
    }

    if intermediates:
        body["intermediates"] = intermediates

    data = _post_json(
        url=GOOGLE_ROUTES_URL,
        headers=headers,
        body=body,
        operation=f"Route search ({mode})",
    )

    if not data.get("routes"):
        raise RuntimeError(
            f"Google Maps returned no routes for {mode}."
        )

    processed_routes = []

    for route_number, route in enumerate(
        data.get("routes", []),
        start=1,
    ):
        distance_meters = route.get("distanceMeters")
        duration = route.get("duration")

        distance_km = (
            round(distance_meters / 1000, 1)
            if distance_meters is not None
            else None
        )

        duration_minutes = None

        if duration:
            try:
                duration_seconds = int(
                    duration.rstrip("s")
                )
                duration_minutes = round(
                    duration_seconds / 60
                )
            except ValueError:
                duration_minutes = None

        polyline = (
            route.get("polyline", {})
            .get("encodedPolyline")
        )

        directions = []

        for leg in route.get("legs", []):
            for step in leg.get("steps", []):
                navigation = step.get(
                    "navigationInstruction",
                    {}
                )

                instruction = navigation.get(
                    "instructions"
                )

                if not instruction:
                    continue

                directions.append(
                    {
                        "instruction": instruction,
                        "distance_meters": step.get(
                            "distanceMeters"
                        ),
                        "duration": step.get(
                            "staticDuration"
                        ),
                    }
                )

        processed_routes.append(
            {
                "route_number": route_number,
                "distance_meters": distance_meters,
                "distance_km": distance_km,
                "duration": duration,
                "duration_minutes": duration_minutes,
                "encoded_polyline": polyline,
                "directions": directions,
            }
        )

    return {
        "available": True,
        "origin": origin,
        "destination": destination,
        "waypoints": waypoints or [],
        "travel_mode": mode,
        "alternative_routes_requested": alternatives,
        "routes": processed_routes,
    }


# ---------------------------------------------------------
# LANDMARK ASSIGNMENT
# ---------------------------------------------------------

def _get_route_landmarks(
    mode: str,
    route_options: list,
) -> None:
    """
    Add landmarks only to driving routes.
    """

    if mode != "DRIVE":
        return

    landmark_tasks = []

    for route in route_options:
        encoded_polyline = route.get(
            "encoded_polyline"
        )

        if encoded_polyline:
            landmark_tasks.append(
                (
                    route,
                    encoded_polyline,
                )
            )

    if not landmark_tasks:
        return

    with ThreadPoolExecutor(
        max_workers=min(3, len(landmark_tasks))
    ) as executor:

        futures = {
            executor.submit(
                search_landmarks_along_route,
                encoded_polyline,
                MAX_LANDMARKS_PER_ROUTE,
            ): route
            for route, encoded_polyline in landmark_tasks
        }

        for future in as_completed(futures):
            route = futures[future]

            try:
                route["landmarks"] = future.result()
            except Exception as error:
                print(
                    "[MapsTools] Landmark search failed: "
                    f"{error}"
                )
                route["landmarks"] = []


# ---------------------------------------------------------
# ALL ROUTES
# ---------------------------------------------------------

def get_all_routes(
    origin: str,
    destination: str,
    waypoints=None,
):
    """
    Get routes for all supported travel modes.

    Route-mode requests execute concurrently.
    Landmark searches for driving routes also execute
    concurrently.
    """

    total_start = time.perf_counter()

    modes = [
        "DRIVE",
        "WALK",
        "BICYCLE",
        "TRANSIT",
    ]

    results = {}

    # -----------------------------------------------------
    # Execute route searches concurrently
    # -----------------------------------------------------

    with ThreadPoolExecutor(
        max_workers=len(modes)
    ) as executor:

        futures = {
            executor.submit(
                get_route,
                origin,
                destination,
                mode,
                waypoints,
                True if mode == "DRIVE" and not waypoints else False,
            ): mode
            for mode in modes
        }

        for future in as_completed(futures):
            mode = futures[future]

            try:
                route_result = future.result()

                route_options = []

                for route in route_result.get(
                    "routes",
                    []
                ):
                    route_number = route.get(
                        "route_number"
                    )

                    route_options.append(
                        {
                            "route_number": route_number,
                            "label": (
                                "Recommended"
                                if route_number == 1
                                else "Alternative"
                            ),
                            "distance_km": route.get(
                                "distance_km"
                            ),
                            "duration_minutes": route.get(
                                "duration_minutes"
                            ),
                            "encoded_polyline": route.get(
                                "encoded_polyline"
                            ),
                            "landmarks": [],
                        }
                    )

                results[mode] = {
                    "available": True,
                    "travel_mode": mode,
                    "route_count": len(route_options),
                    "routes": route_result.get(
                        "routes",
                        []
                    ),
                    "route_options": route_options,
                }

            except Exception as error:
                print(
                    f"[MapsTools] {mode} route failed: "
                    f"{error}"
                )

                results[mode] = {
                    "available": False,
                    "travel_mode": mode,
                    "route_count": 0,
                    "routes": [],
                    "route_options": [],
                    "error": str(error),
                }

    # -----------------------------------------------------
    # Search driving landmarks concurrently
    # -----------------------------------------------------

    driving_data = results.get("DRIVE")

    if driving_data and driving_data.get("available"):
        _get_route_landmarks(
            mode="DRIVE",
            route_options=driving_data.get(
                "route_options",
                [],
            ),
        )

    # -----------------------------------------------------
    # Format concise route summary
    # -----------------------------------------------------

    mode_names = {
        "DRIVE": "DRIVING",
        "WALK": "WALKING",
        "BICYCLE": "BICYCLING",
        "TRANSIT": "TRANSIT",
    }

    formatted_routes = [
        f"Directions from {origin} to {destination}"
    ]

    for mode in modes:
        mode_data = results.get(mode)

        if not mode_data:
            continue

        formatted_routes.append("")
        formatted_routes.append(
            f"=== {mode_names[mode]} ==="
        )

        if not mode_data.get("available"):
            formatted_routes.append(
                "No route available."
            )
            continue

        route_options = mode_data.get(
            "route_options",
            []
        )

        if not route_options:
            formatted_routes.append(
                "No route available."
            )
            continue

        for route in route_options:
            formatted_routes.append("")
            formatted_routes.append(
                f"Route {route.get('route_number')} "
                f"— {route.get('label')}"
            )
            formatted_routes.append(
                f"Distance: {route.get('distance_km')} km"
            )
            formatted_routes.append(
                "Duration: "
                f"{route.get('duration_minutes')} minutes"
            )

            landmarks = route.get(
                "landmarks",
                []
            )

            if landmarks:
                formatted_routes.append(
                    "Landmarks:"
                )

                for landmark in landmarks:
                    name = landmark.get("name")

                    if name:
                        formatted_routes.append(
                            f"- {name}"
                        )

    total_elapsed = time.perf_counter() - total_start

    print(
        f"[MapsTools] Total all-routes search: "
        f"{total_elapsed:.3f} seconds"
    )

    return {
        "origin": origin,
        "destination": destination,
        "waypoints": waypoints or [],
        "routes": results,
        "formatted_routes": "\n".join(
            formatted_routes
        ),
    }