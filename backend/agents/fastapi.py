from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from .orchestrator import tripz_orchestrator


# ---------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------

app = FastAPI(title="TripZ API")


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# ADK configuration
# ---------------------------------------------------------

APP_NAME = "tripz"

session_service = InMemorySessionService()

runner = Runner(
    agent=tripz_orchestrator,
    app_name=APP_NAME,
    session_service=session_service,
)


# ---------------------------------------------------------
# Request model
# ---------------------------------------------------------

class TripRequest(BaseModel):
    trip_type: str
    from_location: str
    destination: str
    departure: str
    return_date: str | None = None
    travelers: int
    user_request: str | None = None


# ---------------------------------------------------------
# Health check
# ---------------------------------------------------------

@app.get("/")
async def root():
    return {
        "status": "success",
        "message": "TripZ API is running",
    }


# ---------------------------------------------------------
# Plan trip
# ---------------------------------------------------------

@app.post("/plan-trip")
async def plan_trip(request: TripRequest):

    # -----------------------------------------------------
    # Create prompt for the TripZ Orchestrator
    # -----------------------------------------------------

    prompt = f"""
You are planning a trip for the user using the TripZ
multi-agent travel planning system.

TRIP DETAILS
------------

Trip type:
{request.trip_type}

Origin:
{request.from_location}

Destination:
{request.destination}

Departure date:
{request.departure}

Return date:
{request.return_date if request.return_date else "Not applicable"}

Number of travelers:
{request.travelers}

USER'S ADDITIONAL REQUEST
-------------------------

{request.user_request if request.user_request else "No additional request provided."}


INSTRUCTIONS
------------

Understand the user's complete request and use the appropriate
TripZ specialist agents.

The available specialist agents are:

- Destination Agent
- Flight Agent
- Hotel Agent
- Maps Agent
- Weather Agent

If the user asks for multiple options, preserve multiple options
returned by the specialist agents.

Do not reduce multiple search results to only one recommendation.

For example:

- If the Flight Agent returns multiple flights, keep multiple flights.
- If the Hotel Agent returns multiple hotels, keep multiple hotels.
- If the Destination Agent returns multiple attractions, keep multiple attractions.
- If the Maps Agent returns alternative routes, keep the alternatives.
- If the Weather Agent returns multiple forecast days, preserve the forecast.

For a complete trip request, provide information from all relevant
specialist agents.

Create a useful day-by-day itinerary when travel dates are available.

Do not invent information.

Do not remove valid options returned by the specialist agents.

Provide a complete and well-organized final travel plan.
"""


    # -----------------------------------------------------
    # Create a session
    # -----------------------------------------------------

    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id="tripz_user",
    )


    # -----------------------------------------------------
    # Create ADK content
    # -----------------------------------------------------

    content = types.Content(
        role="user",
        parts=[
            types.Part(text=prompt)
        ],
    )


    # -----------------------------------------------------
    # Run the orchestrator
    # -----------------------------------------------------

    final_response = ""

    async for event in runner.run_async(
        user_id="tripz_user",
        session_id=session.id,
        new_message=content,
    ):

        if event.is_final_response():

            if event.content and event.content.parts:

                final_response = event.content.parts[0].text


    # -----------------------------------------------------
    # Return response to frontend
    # -----------------------------------------------------

    return {
        "success": True,

        "trip": request.model_dump(),

        "response": final_response,
    }