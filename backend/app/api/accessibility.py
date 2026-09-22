"""
FastAPI REST router for Chennai Transit Accessibility Information.
Provides step-free accessibility details, elevator/escalator counts, tactile pavers,
and wheelchair accessibility levels for CMRL Metro, Suburban Rail, and MTC bus terminals.
"""

from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/accessibility", tags=["Accessibility"])

class StationAccessibility(BaseModel):
    stop_id: str
    station_name: str
    station_name_ta: str
    mode: str  # "METRO", "SUBURBAN_RAIL", "BUS"
    has_elevators: bool
    has_escalators: bool
    has_wheelchair_ramp: bool
    has_tactile_paths: bool
    has_accessible_restrooms: bool
    elevator_count: int
    accessibility_level: str  # "FULL", "PARTIAL", "LIMITED"
    notes_en: str
    notes_ta: str

# Curated Chennai Transit Accessibility Directory
STATION_ACCESSIBILITY_DATA: List[StationAccessibility] = [
    StationAccessibility(
        stop_id="ST_CENTRAL",
        station_name="Chennai Central",
        station_name_ta="சென்னை சென்ட்ரல்",
        mode="METRO",
        has_elevators=True,
        has_escalators=True,
        has_wheelchair_ramp=True,
        has_tactile_paths=True,
        has_accessible_restrooms=True,
        elevator_count=6,
        accessibility_level="FULL",
        notes_en="Full step-free access across all underground metro platforms, central concourse & subway connection to Moore Market Complex.",
        notes_ta="அனைத்து நிலத்தடி மெட்ரோ தளங்கள் மற்றும் ரயில்வே சுரங்கப்பாதையில் லிஃப்ட் மற்றும் சக்கர நாற்காலி வசதிகள் உள்ளன.",
    ),
    StationAccessibility(
        stop_id="ST_AIRPORT",
        station_name="Chennai Airport",
        station_name_ta="விமான நிலையம்",
        mode="METRO",
        has_elevators=True,
        has_escalators=True,
        has_wheelchair_ramp=True,
        has_tactile_paths=True,
        has_accessible_restrooms=True,
        elevator_count=4,
        accessibility_level="FULL",
        notes_en="Direct travelator & elevator connection between Airport Terminal and Metro concourse.",
        notes_ta="விமான முனையம் மற்றும் மெட்ரோ நிலையத்திற்கு இடையே நேரடி லிஃப்ட் மற்றும் ட்ராவலேட்டர் இணைப்பு உள்ளது.",
    ),
    StationAccessibility(
        stop_id="ST_CMBT",
        station_name="Koyambedu CMBT",
        station_name_ta="கோயம்பேடு",
        mode="METRO",
        has_elevators=True,
        has_escalators=True,
        has_wheelchair_ramp=True,
        has_tactile_paths=True,
        has_accessible_restrooms=True,
        elevator_count=4,
        accessibility_level="FULL",
        notes_en="Elevated station with dedicated elevators on both sides of 100ft road connecting to Mofussil Bus Terminus.",
        notes_ta="இருபுறமும் 100 அடி சாலையில் பேருந்து நிலையத்துடன் இணைக்கும் பிரத்யேக லிஃப்ட் வசதி உள்ளது.",
    ),
    StationAccessibility(
        stop_id="ST_GUINDY",
        station_name="Guindy Metro & Suburban Interchange",
        station_name_ta="கிண்டி",
        mode="METRO",
        has_elevators=True,
        has_escalators=True,
        has_wheelchair_ramp=True,
        has_tactile_paths=True,
        has_accessible_restrooms=True,
        elevator_count=3,
        accessibility_level="FULL",
        notes_en="Step-free elevators connecting Anna Salai street level to Metro and suburban foot overbridge ramp.",
        notes_ta="அண்ணா சாலையில் இருந்து மெட்ரோ மற்றும் புறநகர் நடைமேடைக்கு நேரடி லிஃப்ட் மற்றும் சாய்வுதளம் உள்ளது.",
    ),
    StationAccessibility(
        stop_id="ST_TAMBARAM",
        station_name="Tambaram Railway Terminus",
        station_name_ta="தாம்பரம்",
        mode="SUBURBAN_RAIL",
        has_elevators=True,
        has_escalators=True,
        has_wheelchair_ramp=True,
        has_tactile_paths=False,
        has_accessible_restrooms=True,
        elevator_count=2,
        accessibility_level="PARTIAL",
        notes_en="Main entrance features wheelchair ramp and platform 1-2 elevator; assistance recommended for outer platforms.",
        notes_ta="முக்கிய நுழைவாயிலில் சாய்வுதளம் மற்றும் 1-2 நடைமேடைகளில் லிஃப்ட் உள்ளது; பிற தளங்களுக்கு உதவி தேவைப்படலாம்.",
    ),
    StationAccessibility(
        stop_id="ST_TNAGAR",
        station_name="T. Nagar Bus Terminus",
        station_name_ta="தியாகராய நகர்",
        mode="BUS",
        has_elevators=False,
        has_escalators=False,
        has_wheelchair_ramp=True,
        has_tactile_paths=False,
        has_accessible_restrooms=True,
        elevator_count=0,
        accessibility_level="PARTIAL",
        notes_en="Level ground bus bays for low-floor buses (Route 29C, 18A). Street curbs have gradient ramps.",
        notes_ta="தாழ்தளப் பேருந்துகளுக்கு ஏற்ற தரைமட்ட நடைமேடை மற்றும் சாய்வுதள வசதி உள்ளது.",
    ),
    StationAccessibility(
        stop_id="ST_ADYAR",
        station_name="Adyar Depot",
        station_name_ta="அடையாறு பணிமனை",
        mode="BUS",
        has_elevators=False,
        has_escalators=False,
        has_wheelchair_ramp=True,
        has_tactile_paths=False,
        has_accessible_restrooms=False,
        elevator_count=0,
        accessibility_level="PARTIAL",
        notes_en="Ground level terminal with pedestrian zebra crossing and gentle curb cuts.",
        notes_ta="தரைமட்ட பேருந்து முனையம் மற்றும் நடைபாதை சாய்வுதளம் உள்ளது.",
    ),
    StationAccessibility(
        stop_id="ST_1000_LIGHTS",
        station_name="Thousand Lights",
        station_name_ta="ஆயிரம் விளக்கு",
        mode="METRO",
        has_elevators=True,
        has_escalators=True,
        has_wheelchair_ramp=True,
        has_tactile_paths=True,
        has_accessible_restrooms=True,
        elevator_count=3,
        accessibility_level="FULL",
        notes_en="Underground station with street-to-platform dual elevators and platform screen doors.",
        notes_ta="தெருவிலிருந்து தளம் வரை முழுமையான லிஃப்ட் மற்றும் தானியங்கி கதவு வசதி உள்ளது.",
    ),
]

@router.get("/stations", response_model=List[StationAccessibility])
def get_all_accessible_stations(mode: Optional[str] = None):
    """
    Get all monitored Chennai transit stations with accessibility details.
    Optionally filter by mode: METRO, SUBURBAN_RAIL, BUS.
    """
    if mode:
        m = mode.upper()
        return [s for s in STATION_ACCESSIBILITY_DATA if s.mode == m]
    return STATION_ACCESSIBILITY_DATA

@router.get("/stations/{stop_id}", response_model=StationAccessibility)
def get_station_accessibility(stop_id: str):
    """
    Get accessibility details for a specific transit stop or station.
    """
    station = next((s for s in STATION_ACCESSIBILITY_DATA if s.stop_id == stop_id), None)
    if not station:
        # Default fallback for unlisted stops (generic assessment)
        return StationAccessibility(
            stop_id=stop_id,
            station_name="Transit Station",
            station_name_ta="நிலையப் பகுதி",
            mode="BUS",
            has_elevators=False,
            has_escalators=False,
            has_wheelchair_ramp=True,
            has_tactile_paths=False,
            has_accessible_restrooms=False,
            elevator_count=0,
            accessibility_level="LIMITED",
            notes_en="Standard street-level access. Dedicated wheelchair boarding may vary by bus type.",
            notes_ta="வழக்கமான தெருநிலை அணுகல்.",
        )
    return station
