"""
TripZ ADK Root Agent

This module defines the root agent used by the Google Agent Development Kit
(ADK) to start and manage the TripZ multi-agent travel planning system.

The root agent acts as the entry point for the ADK application and connects
the main TripZ orchestrator with the specialized travel agents.
"""
"""
TripZ Root Agent

This is the main entry point for the TripZ ADK application.

The root agent receives the user's travel request and
coordinates the specialist TripZ agents.
"""

from .agents.orchestrator import tripz_orchestrator


root_agent = tripz_orchestrator