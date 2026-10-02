"""
FastAPI REST router for Phase 15:
Station Interchange Wayfinding Guide, Platform Directories, and First/Last-Mile Feeder Networks (MTC Small Buses & Chennai Share-Autos).
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, HTTPException, status
from pydantic import BaseModel

from backend.app.schemas.interchange import (
    PlatformInfo,
    ExitGateInfo,
    AmenityInfo,
    FeederServiceInfo,
    InterchangeHubSummary,
    InterchangeHubDetail,
    TransferStep,
    TransferGuideRequest,
    TransferGuideResponse,
    FeederRecommendationRequest,
    FeederRecommendationResponse,
)

router = APIRouter(prefix="/api/interchange", tags=["Station Interchanges & Feeders"])

# In-memory database of curated Chennai Multimodal Interchange Hubs
INTERCHANGE_HUBS: Dict[str, Dict[str, Any]] = {
    "HUB_CENTRAL": {
        "hub_id": "HUB_CENTRAL",
        "name_en": "Chennai Central (Puratchi Thalaivar Dr. M.G.R. Central)",
        "name_ta": "சென்னை சென்ட்ரல் (புரட்சித் தலைவர் டாக்டர் எம்.ஜி.ஆர் சென்ட்ரல்)",
        "subtitle_en": "Mega Interchange: CMRL Underground Metro + Moore Market Suburban EMU + Mainline Rail + MTC Bus Bay",
        "subtitle_ta": "மெகா சந்திப்பு: CMRL மெட்ரோ + மூர் மார்க்கெட் புறநகர் ரயில் + முதன்மை ரயில் நிலையம் + மாநகர பேருந்து",
        "lat": 13.0827,
        "lon": 80.2754,
        "modes": ["METRO", "SUBURBAN_RAIL", "MAINLINE_TRAIN", "BUS"],
        "levels": ["UNDERGROUND_L2", "UNDERGROUND_L1", "GROUND", "ELEVATED_L1"],
        "connects_to_stop_ids": ["ST_CENTRAL", "ST_PARK", "ST_MOORE_MARKET"],
        "platforms": [
            {
                "platform_id": "CEN_MTR_P1",
                "platform_number": "Metro L2 - Platform 1",
                "mode": "METRO",
                "level": "UNDERGROUND_L2",
                "service_direction": "Blue Line: Down towards Chennai Airport via Guindy",
                "service_direction_ta": "நீலப் பாதை: கிண்டி வழியாக சென்னை விமான நிலையம் நோக்கி",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
            {
                "platform_id": "CEN_MTR_P2",
                "platform_number": "Metro L2 - Platform 2",
                "mode": "METRO",
                "level": "UNDERGROUND_L2",
                "service_direction": "Green Line: Towards St. Thomas Mount via Koyambedu (CMBT)",
                "service_direction_ta": "பச்சைப் பாதை: கோயம்பேடு வழியாக புனித தோமையார் மலை நோக்கி",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
            {
                "platform_id": "CEN_SUB_MMC11",
                "platform_number": "Suburban MMC - Platforms 11 to 14",
                "mode": "SUBURBAN_RAIL",
                "level": "GROUND",
                "service_direction": "Moore Market Terminal: North / West EMU towards Avadi, Arakkonam & Gummidipundi",
                "service_direction_ta": "மூர் மார்க்கெட்: ஆவடி, அரக்கோணம் மற்றும் கும்மிடிப்பூண்டி புறநகர் ரயில்கள்",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
            {
                "platform_id": "CEN_SUB_PARK",
                "platform_number": "Chennai Park Suburban - Platforms 1 & 2",
                "mode": "SUBURBAN_RAIL",
                "level": "GROUND",
                "service_direction": "South Line EMU: Chennai Beach towards Tambaram & Chengalpattu",
                "service_direction_ta": "தெற்கு புறநகர்: சென்னை கடற்கரை - தாம்பரம் & செங்கல்பட்டு",
                "accessible": True,
                "has_lift": True,
                "has_escalator": False,
            },
            {
                "platform_id": "CEN_MAIN_P1_10",
                "platform_number": "Mainline Central - Platforms 1 to 10",
                "mode": "MAINLINE_TRAIN",
                "level": "GROUND",
                "service_direction": "Express & Vande Bharat Trains to Bengaluru, Delhi, Hyderabad, Mumbai",
                "service_direction_ta": "வந்தே பாரத் மற்றும் விரைவு ரயில்கள் (பெங்களூரு, தில்லி, மும்பை)",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
            {
                "platform_id": "CEN_BUS_BAY",
                "platform_number": "Central Bus Terminus Bays 1 to 6",
                "mode": "BUS",
                "level": "GROUND",
                "service_direction": "MTC Routes: 11G, 18A, 29C, 54, 21H across Chennai Metropolitan Region",
                "service_direction_ta": "MTC பேருந்து வழிகள்: 11G, 18A, 29C, 54, 21H",
                "accessible": True,
                "has_lift": False,
                "has_escalator": False,
            },
        ],
        "exit_gates": [
            {
                "gate_id": "CEN_G1",
                "gate_code": "Gate 1 (A1)",
                "name_en": "EVR Periyar Salai (Poonamallee High Rd) & RGGGH Hospital",
                "name_ta": "ஈ.வே.ரா பெரியார் சாலை & அரசு பொது மருத்துவமனை",
                "leading_to": ["Rajiv Gandhi Govt General Hospital", "Madras Medical College", "Underground Pedestrian Subway"],
                "leading_to_ta": ["ராஜீவ் காந்தி அரசு பொது மருத்துவமனை", "மெட்ராஸ் மருத்துவக் கல்லூரி", "பாதசாரி சுரங்கப்பாதை"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "MTC Bus Shelters on Poonamallee High Road",
            },
            {
                "gate_id": "CEN_G2",
                "gate_code": "Gate 2 (A2)",
                "name_en": "Central Main Railway Station Concourse",
                "name_ta": "சென்ட்ரல் முதன்மை ரயில் நிலைய முகப்பு",
                "leading_to": ["Heritage Main Concourse", "VIP Entry", "Prepaid Taxi Stand", "Current Reservation Counters"],
                "leading_to_ta": ["முதன்மை முகப்பு", "முன்பதிவு கவுண்ட்டர்", "ப்ரீபெய்ட் டாக்ஸி"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "Prepaid Taxi & Fast-Track Auto Bay",
            },
            {
                "gate_id": "CEN_G3",
                "gate_code": "Gate 3 (A3)",
                "name_en": "Moore Market Complex (Suburban Terminal)",
                "name_ta": "மூர் மார்க்கெட் வளாகம் (புறநகர் ரயில் முனையம்)",
                "leading_to": ["Suburban UTS Ticket Counters", "Platforms 11-14", "Wall Tax Road Exit"],
                "leading_to_ta": ["புறநகர் டிக்கெட் கவுண்ட்டர்", "பிளாட்பாரம் 11-14", "வால் டாக்ஸ் சாலை"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "Wall Tax Road Chennai Share-Auto Stand",
            },
            {
                "gate_id": "CEN_G4",
                "gate_code": "Gate 4 (A4)",
                "name_en": "Park Station Subway & Ripon Building",
                "name_ta": "பார்க் ரயில் நிலைய சுரங்கப்பாதை & ரிப்பன் மாளிகை",
                "leading_to": ["Chennai Park Suburban Station", "Greater Chennai Corporation Headquarters", "Victoria Public Hall"],
                "leading_to_ta": ["சென்னை பார்க் புறநகர் நிலையம்", "சென்னை மாநகராட்சி தலைமை அலுவலகம்"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "Park Station Shared Shuttle Point",
            },
        ],
        "amenities": [
            {
                "category": "CLOAKROOM",
                "name_en": "24/7 Left Luggage Cloakroom",
                "name_ta": "24 மணி நேர உடைமை பாதுகாப்பு அறை",
                "location_description": "Ground Level, Near Mainline Platform 1 exit",
                "location_description_ta": "தரை தளம், பிளாட்பாரம் 1 அருகே",
                "is_operational": True,
            },
            {
                "category": "LIFT",
                "name_en": "Step-Free Glass Elevators (6 Units)",
                "name_ta": "லிஃப்ட் வசதி (6 அலகுகள்)",
                "location_description": "Connecting Metro L2, L1 Concourse, and Ground Subway",
                "location_description_ta": "மெட்ரோ தளம் மற்றும் தரைதளத்தை இணைக்கும் லிஃப்ட்",
                "is_operational": True,
            },
            {
                "category": "WATER",
                "name_en": "Free RO Drinking Water Points",
                "name_ta": "இலவச RO குடிநீர் வசதி",
                "location_description": "Available on Metro Concourse and Suburban Platform 11",
                "location_description_ta": "மெட்ரோ மற்றும் புறநகர் பிளாட்பாரங்களில் கிடைக்கிறது",
                "is_operational": True,
            },
            {
                "category": "WHEELCHAIR",
                "name_en": "Dedicated May I Help You & Wheelchair Desk",
                "name_ta": "சக்கர நாற்காலி உதவி மையம்",
                "location_description": "Metro Concourse Gate 1 & Mainline Porch",
                "location_description_ta": "மெட்ரோ வாயில் 1 மற்றும் முதன்மை முகப்பு",
                "is_operational": True,
            },
        ],
        "feeders": [
            {
                "service_id": "FDR_CEN_SH01",
                "service_type": "SHARE_AUTO",
                "route_number": "SH-CEN-01",
                "destination_en": "Broadway / High Court",
                "destination_ta": "பிராட்வே / உயர் நீதிமன்றம்",
                "via_en": "Wall Tax Road, Mint Street, Flower Bazaar",
                "via_ta": "வால் டாக்ஸ் சாலை, மின்ட் தெரு",
                "frequency_minutes": 3,
                "fare_inr": 15.0,
                "operating_hours": "05:30 - 23:00",
                "boarding_gate_code": "Gate 3 (Wall Tax Rd)",
                "vehicle_capacity": "7-Seater Shared Auto",
            },
            {
                "service_id": "FDR_CEN_SH02",
                "service_type": "SHARE_AUTO",
                "route_number": "SH-CEN-02",
                "destination_en": "Purasawalkam Doveton & Kellys",
                "destination_ta": "புரசைவாக்கம் டவ்டன் & கெல்லிஸ்",
                "via_en": "EVR Periyar Salai, Perambur Barracks Rd",
                "via_ta": "ஈ.வே.ரா பெரியார் சாலை",
                "frequency_minutes": 5,
                "fare_inr": 20.0,
                "operating_hours": "06:00 - 22:30",
                "boarding_gate_code": "Gate 1 (Poonamallee Rd)",
                "vehicle_capacity": "7-Seater Shared Auto",
            },
            {
                "service_id": "FDR_CEN_S11",
                "service_type": "MTC_SMALL_BUS",
                "route_number": "S11",
                "destination_en": "Triplicane Ice House (Marina)",
                "destination_ta": "திருவல்லிக்கேணி ஐஸ் அவுஸ் (மெரினா)",
                "via_en": "Chintadripet, Simpsons, Anna Salai",
                "via_ta": "சிந்தாதிரிப்பேட்டை, அண்ணா சாலை",
                "frequency_minutes": 15,
                "fare_inr": 12.0,
                "operating_hours": "06:15 - 21:45",
                "boarding_gate_code": "Gate 1 Bus Shelter",
                "vehicle_capacity": "24-Seater MTC Minibus",
            },
        ],
    },
    "HUB_GUINDY": {
        "hub_id": "HUB_GUINDY",
        "name_en": "Guindy Multi-Modal Transit Hub",
        "name_ta": "கிண்டி பன்முக போக்குவரத்து சந்திப்பு",
        "subtitle_en": "CMRL Metro + Beach-Tambaram Suburban Railway + GST Road Bus Terminal + Share-Auto Hub",
        "subtitle_ta": "CMRL மெட்ரோ + கடற்கரை-தாம்பரம் புறநகர் ரயில் + GST சாலை பேருந்து + ஷேர் ஆட்டோ",
        "lat": 13.0067,
        "lon": 80.2014,
        "modes": ["METRO", "SUBURBAN_RAIL", "BUS", "SHARE_AUTO"],
        "levels": ["UNDERGROUND_L1", "GROUND", "ELEVATED_FOB"],
        "connects_to_stop_ids": ["ST_GUINDY"],
        "platforms": [
            {
                "platform_id": "GND_MTR_P1",
                "platform_number": "Metro Underground - Platform 1",
                "mode": "METRO",
                "level": "UNDERGROUND_L1",
                "service_direction": "Blue Line: Down towards Chennai Airport (3 stops)",
                "service_direction_ta": "நீலப் பாதை: சென்னை விமான நிலையம் நோக்கி",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
            {
                "platform_id": "GND_MTR_P2",
                "platform_number": "Metro Underground - Platform 2",
                "mode": "METRO",
                "level": "UNDERGROUND_L1",
                "service_direction": "Blue Line: Up towards Central & Wimco Nagar",
                "service_direction_ta": "நீலப் பாதை: சென்ட்ரல் & விம்கோ நகர் நோக்கி",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
            {
                "platform_id": "GND_SUB_P1",
                "platform_number": "Suburban Rail - Platforms 1 & 2",
                "mode": "SUBURBAN_RAIL",
                "level": "GROUND",
                "service_direction": "Southern Railway EMU: Tambaram & Chengalpattu Southbound",
                "service_direction_ta": "தாம்பரம் & செங்கல்பட்டு தெற்கு புறநகர்",
                "accessible": True,
                "has_lift": True,
                "has_escalator": False,
            },
            {
                "platform_id": "GND_BUS_BAYS",
                "platform_number": "Guindy Industrial Estate & Race Course Bus Bays",
                "mode": "BUS",
                "level": "GROUND",
                "service_direction": "MTC City Routes: 18A, 47A, 54, 70V, 21G",
                "service_direction_ta": "MTC பேருந்து வழிகள்: 18A, 47A, 54, 70V",
                "accessible": True,
                "has_lift": False,
                "has_escalator": False,
            },
        ],
        "exit_gates": [
            {
                "gate_id": "GND_G1",
                "gate_code": "Gate 1",
                "name_en": "GST Road & Kathipara Flyover Pedestrian Plaza",
                "name_ta": "ஜி.எஸ்.டி சாலை & கத்திப்பாரா நடைபாதை",
                "leading_to": ["Kathipara Urban Square", "SIDCO Industrial Estate", "Bus Shelters"],
                "leading_to_ta": ["கத்திப்பாரா சதுக்கம்", "சிட்கோ தொழிற்பேட்டை"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "GST Road MTC Bus Bays",
            },
            {
                "gate_id": "GND_G2",
                "gate_code": "Gate 2",
                "name_en": "Guindy Railway Station Foot Overbridge (FOB)",
                "name_ta": "கிண்டி ரயில் நிலைய நடைமேம்பாலம்",
                "leading_to": ["Suburban Platforms 1 & 2", "Race Course Road", "Ticket Counters"],
                "leading_to_ta": ["புறநகர் பிளாட்பாரம்", "ரேஸ் கோர்ஸ் சாலை"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "Guindy Railway Station Auto Bay",
            },
            {
                "gate_id": "GND_G3",
                "gate_code": "Gate 3",
                "name_en": "Race Course Road & Guindy Bus Stand",
                "name_ta": "ரேஸ் கோர்ஸ் சாலை & கிண்டி பேருந்து நிலையம்",
                "leading_to": ["Madipakkam & Velachery Share Auto Terminal", "Guindy Bus Depot"],
                "leading_to_ta": ["மடிப்பாக்கம் & வேளச்சேரி ஷேர் ஆட்டோ நிலையம்"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "Mega Chennai Share Auto Stand",
            },
        ],
        "amenities": [
            {
                "category": "LIFT",
                "name_en": "Elevator to Metro Concourse & Railway FOB",
                "name_ta": "மெட்ரோ மற்றும் ரயில் மேம்பால லிஃப்ட்",
                "location_description": "Gate 1 and Gate 2 concourse",
                "location_description_ta": "கேட் 1 மற்றும் கேட் 2 முகப்பு",
                "is_operational": True,
            },
            {
                "category": "TICKETING",
                "name_en": "Integrated Singara Chennai NCMC Reval Kiosks",
                "name_ta": "NCMC ஸ்மார்ட்கார்டு ரீசார்ஜ் இயந்திரம்",
                "location_description": "Metro entry foyer",
                "location_description_ta": "மெட்ரோ நுழைவு வாயில்",
                "is_operational": True,
            },
        ],
        "feeders": [
            {
                "service_id": "FDR_GND_SH01",
                "service_type": "SHARE_AUTO",
                "route_number": "SH-GND-01",
                "destination_en": "Madipakkam Koot Road & Puzhuthivakkam",
                "destination_ta": "மடிப்பாக்கம் கூட்டு ரோடு & புழுதிவாக்கம்",
                "via_en": "Adambakkam, NGO Colony, Vanuvampet",
                "via_ta": "ஆதம்பாக்கம், என்.ஜி.ஓ காலனி",
                "frequency_minutes": 2,
                "fare_inr": 20.0,
                "operating_hours": "05:00 - 23:30",
                "boarding_gate_code": "Gate 3 (Race Course Auto Stand)",
                "vehicle_capacity": "7-Seater Shared Auto",
            },
            {
                "service_id": "FDR_GND_SH02",
                "service_type": "SHARE_AUTO",
                "route_number": "SH-GND-02",
                "destination_en": "Porur Roundtana & DLF IT Park",
                "destination_ta": "போரூர் ரவுண்டானா & DLF ஐடி பார்க்",
                "via_en": "Kathipara, Butt Road, Ramapuram, Mugalivakkam",
                "via_ta": "கத்திப்பாரா, ராமாபுரம், முகலிவாக்கம்",
                "frequency_minutes": 3,
                "fare_inr": 25.0,
                "operating_hours": "05:30 - 23:00",
                "boarding_gate_code": "Gate 1 (Kathipara Stand)",
                "vehicle_capacity": "7-Seater Shared Auto",
            },
            {
                "service_id": "FDR_GND_SH03",
                "service_type": "SHARE_AUTO",
                "route_number": "SH-GND-03",
                "destination_en": "Velachery Vijayanagar Junction",
                "destination_ta": "வேளச்சேரி விஜயநகர் சந்திப்பு",
                "via_en": "Guindy Race Course, Checkpost, Phoenix Marketcity",
                "via_ta": "ரேஸ் கோர்ஸ், பீனிக்ஸ் மால்",
                "frequency_minutes": 3,
                "fare_inr": 20.0,
                "operating_hours": "05:30 - 23:30",
                "boarding_gate_code": "Gate 3 (Race Course)",
                "vehicle_capacity": "7-Seater Shared Auto",
            },
            {
                "service_id": "FDR_GND_S15",
                "service_type": "MTC_SMALL_BUS",
                "route_number": "S15",
                "destination_en": "Ramapuram Mount-Poonamallee Rd",
                "destination_ta": "ராமாபுரம் மவுண்ட்-பூந்தமல்லி சாலை",
                "via_en": "St. Thomas Mount, Nandambakkam Trade Centre",
                "via_ta": "நந்தம்பாக்கம் வர்த்தக மையம்",
                "frequency_minutes": 12,
                "fare_inr": 12.0,
                "operating_hours": "06:00 - 21:30",
                "boarding_gate_code": "Gate 1 Bus Bay",
                "vehicle_capacity": "24-Seater MTC Minibus",
            },
        ],
    },
    "HUB_AIRPORT": {
        "hub_id": "HUB_AIRPORT",
        "name_en": "Chennai International Airport Multi-Modal Hub",
        "name_ta": "சென்னை பன்னாட்டு விமான நிலையம் பன்முக மையம்",
        "subtitle_en": "CMRL Elevated Metro + Direct AC Travelator Bridge to Domestic (T1/T4) & International (T2) Terminals",
        "subtitle_ta": "CMRL மெட்ரோ + ஏசி நகரும் நடைபாதை வழியாக உள்நாட்டு & பன்னாட்டு முனையங்கள் இணைப்பு",
        "lat": 12.9856,
        "lon": 80.1636,
        "modes": ["METRO", "AIRPORT_TERMINAL", "BUS", "PREPAID_TAXI"],
        "levels": ["GROUND", "ELEVATED_L1", "ELEVATED_L2"],
        "connects_to_stop_ids": ["ST_AIRPORT"],
        "platforms": [
            {
                "platform_id": "AIR_MTR_P1",
                "platform_number": "Metro Elevated - Platform 1 & 2",
                "mode": "METRO",
                "level": "ELEVATED_L2",
                "service_direction": "Blue Line: Up towards Chennai Central & Wimco Nagar",
                "service_direction_ta": "நீலப் பாதை: சென்ட்ரல் & விம்கோ நகர் நோக்கி",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
            {
                "platform_id": "AIR_TERM_DOM",
                "platform_number": "Domestic Terminal T1 (Kamaraj) & T4",
                "mode": "AIRPORT_TERMINAL",
                "level": "GROUND",
                "service_direction": "Departures (1st Floor) & Arrivals (Ground Floor)",
                "service_direction_ta": "உள்நாட்டு புறப்பாடு & வருகை முனையம்",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
            {
                "platform_id": "AIR_TERM_INT",
                "platform_number": "International Terminal T2 (New Integrated Terminal)",
                "mode": "AIRPORT_TERMINAL",
                "level": "GROUND",
                "service_direction": "International Departures & Arrivals",
                "service_direction_ta": "பன்னாட்டு புறப்பாடு & வருகை முனையம்",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
        ],
        "exit_gates": [
            {
                "gate_id": "AIR_G1",
                "gate_code": "Bridge Gate A",
                "name_en": "Air-Conditioned Travelator Skybridge to Domestic Terminal (T1/T4)",
                "name_ta": "உள்நாட்டு முனையத்திற்கு செல்லும் ஏசி ஸ்கைபிரிட்ஜ்",
                "leading_to": ["Domestic Departures Level 1", "Baggage Claim", "Aerohub Mall"],
                "leading_to_ta": ["உள்நாட்டு புறப்பாடு தளம்", "ஏரோஹப் மால்"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "Free Electric Buggy Station",
            },
            {
                "gate_id": "AIR_G2",
                "gate_code": "Bridge Gate B",
                "name_en": "Air-Conditioned Travelator Skybridge to International Terminal (T2)",
                "name_ta": "பன்னாட்டு முனையத்திற்கு செல்லும் ஏசி ஸ்கைபிரிட்ஜ்",
                "leading_to": ["New Integrated Terminal T2", "Immigration & Customs", "MLCP Parking"],
                "leading_to_ta": ["புதிய ஒருங்கிணைந்த முனையம் T2"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "AAI Prepaid Taxi Booth",
            },
        ],
        "amenities": [
            {
                "category": "WHEELCHAIR",
                "name_en": "Free Electric Commuter Buggy Cart",
                "name_ta": "இலவச மின்சார பேட்டரி வண்டி",
                "location_description": "Station concourse directly at skybridge entry",
                "location_description_ta": "பாலத்தின் தொடக்கத்தில் கிடைக்கிறது",
                "is_operational": True,
            },
            {
                "category": "TICKETING",
                "name_en": "Airline Flight Information Display System (FIDS)",
                "name_ta": "விமான தகவல் திரை",
                "location_description": "Metro station platform & concourse displays",
                "location_description_ta": "மெட்ரோ பிளாட்பாரத்தில் விமான நேரங்கள்",
                "is_operational": True,
            },
        ],
        "feeders": [
            {
                "service_id": "FDR_AIR_SH01",
                "service_type": "SHARE_AUTO",
                "route_number": "SH-AIR-01",
                "destination_en": "Pallavaram & Chromepet Sanatorium",
                "destination_ta": "பல்லாவரம் & குரோம்பேட்டை",
                "via_en": "GST Road, Cantonment Board",
                "via_ta": "ஜி.எஸ்.டி சாலை",
                "frequency_minutes": 5,
                "fare_inr": 20.0,
                "operating_hours": "05:00 - 23:00",
                "boarding_gate_code": "GST Road Foyer (Ground)",
                "vehicle_capacity": "7-Seater Shared Auto",
            },
        ],
    },
    "HUB_TAMBARAM": {
        "hub_id": "HUB_TAMBARAM",
        "name_en": "Tambaram South Transit Gateway",
        "name_ta": "தாம்பரம் தெற்கு போக்குவரத்து நுழைவாயில்",
        "subtitle_en": "Southern Railway EMU Terminal + Mainline Coaching + MTC East/West Terminus + GST Corridor Hub",
        "subtitle_ta": "புறநகர் ரயில் முனையம் + விரைவு ரயில் + MTC கிழக்கு/மேற்கு பேருந்து நிலையம்",
        "lat": 12.9249,
        "lon": 80.1197,
        "modes": ["SUBURBAN_RAIL", "MAINLINE_TRAIN", "BUS", "SHARE_AUTO"],
        "levels": ["GROUND", "ELEVATED_FOB"],
        "connects_to_stop_ids": ["ST_TAMBARAM"],
        "platforms": [
            {
                "platform_id": "TBM_SUB_P1_4",
                "platform_number": "Suburban EMU - Platforms 1 to 4",
                "mode": "SUBURBAN_RAIL",
                "level": "GROUND",
                "service_direction": "Northbound EMU towards Chennai Beach via Guindy & Central",
                "service_direction_ta": "சென்னை கடற்கரை நோக்கி புறப்படும் புறநகர் ரயில்கள்",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
            {
                "platform_id": "TBM_SUB_P5_8",
                "platform_number": "Suburban & Mainline - Platforms 5 to 8",
                "mode": "MAINLINE_TRAIN",
                "level": "GROUND",
                "service_direction": "Southbound EMU to Chengalpattu / Express to Madurai, Tirunelveli, Kanyakumari",
                "service_direction_ta": "செங்கல்பட்டு புறநகர் மற்றும் தென் மாவட்ட விரைவு ரயில்கள்",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
            {
                "platform_id": "TBM_BUS_EAST",
                "platform_number": "Tambaram East Bus Stand",
                "mode": "BUS",
                "level": "GROUND",
                "service_direction": "MTC routes towards Velachery, Medavakkam, Adyar, Camp Road",
                "service_direction_ta": "வேளச்சேரி, மேடவாக்கம், அடையாறு, கேம்ப் ரோடு பேருந்துகள்",
                "accessible": True,
                "has_lift": False,
                "has_escalator": False,
            },
            {
                "platform_id": "TBM_BUS_WEST",
                "platform_number": "Tambaram West Bus Stand & GST Road",
                "mode": "BUS",
                "level": "GROUND",
                "service_direction": "MTC routes towards Koyambedu, Broadway, Sriperumbudur, Mudichur",
                "service_direction_ta": "கோயம்பேடு, பிராட்வே, ஸ்ரீபெரும்புதூர் பேருந்துகள்",
                "accessible": True,
                "has_lift": False,
                "has_escalator": False,
            },
        ],
        "exit_gates": [
            {
                "gate_id": "TBM_GEAST",
                "gate_code": "East Gate",
                "name_en": "Tambaram East Concourse & MCC College",
                "name_ta": "தாம்பரம் கிழக்கு முகப்பு & எம்.சி.சி கல்லூரி",
                "leading_to": ["Madras Christian College", "East Bus Terminus", "Camp Road Auto Stand"],
                "leading_to_ta": ["சென்னை கிறித்துவக் கல்லூரி", "கிழக்கு பேருந்து நிலையம்"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "Tambaram East Share-Auto Stand",
            },
            {
                "gate_id": "TBM_GWEST",
                "gate_code": "West Gate",
                "name_en": "Tambaram West Concourse & GST Road Market",
                "name_ta": "தாம்பரம் மேற்கு முகப்பு & ஜி.எஸ்.டி சாலை",
                "leading_to": ["GST Road Flyover", "West Bus Stand", "Mudichur Road Auto Bay"],
                "leading_to_ta": ["ஜி.எஸ்.டி சாலை", "மேற்கு பேருந்து நிலையம்"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "Tambaram West Mega Share-Auto Stand",
            },
        ],
        "amenities": [
            {
                "category": "LIFT",
                "name_en": "Lifts to Foot Overbridges (Platform 1 to 8)",
                "name_ta": "நடைமேம்பால லிஃப்ட் (பிளாட்பாரம் 1 முதல் 8 வரை)",
                "location_description": "Connecting all 8 platforms over the tracks",
                "location_description_ta": "அனைத்து பிளாட்பாரங்களையும் இணைக்கும் லிஃப்ட்",
                "is_operational": True,
            },
            {
                "category": "RESTROOM",
                "name_en": "Accessible Restrooms (Divyangjan)",
                "name_ta": "மாற்றுத்திறனாளிகளுக்கான கழிப்பறை",
                "location_description": "Platform 1 & Platform 8 concourses",
                "location_description_ta": "பிளாட்பாரம் 1 மற்றும் 8 முகப்பில்",
                "is_operational": True,
            },
        ],
        "feeders": [
            {
                "service_id": "FDR_TBM_SH01",
                "service_type": "SHARE_AUTO",
                "route_number": "SH-TBM-01",
                "destination_en": "Camp Road, Selaiyur & Rajakilpakkam",
                "destination_ta": "கேம்ப் ரோடு, சேலையூர் & ராஜகீழ்ப்பாக்கம்",
                "via_en": "Velachery Main Road, East Tambaram Junction",
                "via_ta": "வேளச்சேரி மெயின் ரோடு",
                "frequency_minutes": 2,
                "fare_inr": 15.0,
                "operating_hours": "05:00 - 23:45",
                "boarding_gate_code": "East Gate Auto Bay",
                "vehicle_capacity": "7-Seater Shared Auto",
            },
            {
                "service_id": "FDR_TBM_SH02",
                "service_type": "SHARE_AUTO",
                "route_number": "SH-TBM-02",
                "destination_en": "Mudichur & Mannivakkam",
                "destination_ta": "முடிச்சூர் & மணிமங்கலம்",
                "via_en": "Mudichur Main Road, Old Tambaram",
                "via_ta": "முடிச்சூர் மெயின் ரோடு",
                "frequency_minutes": 4,
                "fare_inr": 20.0,
                "operating_hours": "05:30 - 23:00",
                "boarding_gate_code": "West Gate Auto Bay",
                "vehicle_capacity": "7-Seater Shared Auto",
            },
            {
                "service_id": "FDR_TBM_S51",
                "service_type": "MTC_SMALL_BUS",
                "route_number": "S51",
                "destination_en": "Medavakkam Koot Road",
                "destination_ta": "மேடவாக்கம் கூட்டு ரோடு",
                "via_en": "Camp Road, Santhosapuram, Gowrivakkam",
                "via_ta": "சந்தோஷபுரம், கௌரிவாக்கம்",
                "frequency_minutes": 10,
                "fare_inr": 14.0,
                "operating_hours": "06:00 - 22:00",
                "boarding_gate_code": "East Bus Stand",
                "vehicle_capacity": "24-Seater MTC Minibus",
            },
        ],
    },
    "HUB_KOYAMBEDU": {
        "hub_id": "HUB_KOYAMBEDU",
        "name_en": "Koyambedu CMBT Multi-Modal Hub",
        "name_ta": "கோயம்பேடு CMBT பன்முக மையம்",
        "subtitle_en": "CMRL Elevated Metro + Puratchi Thalaivar Dr. MGR Bus Terminus (Intercity & MTC City)",
        "subtitle_ta": "CMRL மெட்ரோ + புரட்சித் தலைவர் டாக்டர் எம்.ஜி.ஆர் புறநகர் & நகர பேருந்து நிலையம்",
        "lat": 13.0732,
        "lon": 80.2012,
        "modes": ["METRO", "INTERCITY_BUS", "MTC_CITY_BUS", "SHARE_AUTO"],
        "levels": ["GROUND", "ELEVATED_L1", "ELEVATED_L2"],
        "connects_to_stop_ids": ["ST_CMBT"],
        "platforms": [
            {
                "platform_id": "CMBT_MTR_P1_2",
                "platform_number": "Metro Elevated - Platforms 1 & 2",
                "mode": "METRO",
                "level": "ELEVATED_L2",
                "service_direction": "Green Line: Towards Chennai Central or St. Thomas Mount",
                "service_direction_ta": "பச்சைப் பாதை: சென்ட்ரல் அல்லது பரங்கிமலை நோக்கி",
                "accessible": True,
                "has_lift": True,
                "has_escalator": True,
            },
            {
                "platform_id": "CMBT_BUS_MTC",
                "platform_number": "MTC City Bus Bays 1 to 10",
                "mode": "BUS",
                "level": "GROUND",
                "service_direction": "City Buses across Chennai (T. Nagar, Broadway, Tambaram, Adyar)",
                "service_direction_ta": "மாநகர பேருந்துகள் (தி.நகர், பிராட்வே, தாம்பரம்)",
                "accessible": True,
                "has_lift": False,
                "has_escalator": False,
            },
        ],
        "exit_gates": [
            {
                "gate_id": "CMBT_G1",
                "gate_code": "Skywalk Gate",
                "name_en": "Direct Covered Skywalk to CMBT Bus Terminus Concourse",
                "name_ta": "CMBT பேருந்து நிலையத்திற்கு நேரடி ஆகாய நடைபாதை",
                "leading_to": ["Bus Terminus Bays", "SETC Reservation Office", "Food Court"],
                "leading_to_ta": ["பேருந்து நிலைய விரிகுடாக்கள்", "SETC அலுவலகம்"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "CMBT Internal Minibus Shelter",
            },
            {
                "gate_id": "CMBT_G2",
                "gate_code": "Inner Ring Road Gate",
                "name_en": "Jawaharlal Nehru Salai (100 Ft Road) & Market",
                "name_ta": "ஜவஹர்லால் நேரு சாலை (100 அடி சாலை) & மார்க்கெட்",
                "leading_to": ["Koyambedu Wholesale Market", "Rohini Silver Screens", "Auto Bay"],
                "leading_to_ta": ["கோயம்பேடு அங்காடி", "ரோகிணி திரையரங்கம்"],
                "has_wheelchair_ramp": True,
                "nearby_feeder_stand": "100 Ft Road Share-Auto Stand",
            },
        ],
        "amenities": [
            {
                "category": "LIFT",
                "name_en": "Elevators to Elevated Concourse & Skywalk",
                "name_ta": "ஆகாய நடைபாதை லிஃப்ட் வசதி",
                "location_description": "Ground floor foyer to Level 2",
                "location_description_ta": "தரை தளத்திலிருந்து நிலை 2 வரை",
                "is_operational": True,
            },
        ],
        "feeders": [
            {
                "service_id": "FDR_CMBT_S16",
                "service_type": "MTC_SMALL_BUS",
                "route_number": "S16",
                "destination_en": "Mogappair West & Golden Flats",
                "destination_ta": "முகப்பேர் மேற்கு & கோல்டன் பிளாட்ஸ்",
                "via_en": "Thirumangalam, Collector Nagar",
                "via_ta": "திருமங்கலம், கலெக்டர் நகர்",
                "frequency_minutes": 8,
                "fare_inr": 12.0,
                "operating_hours": "06:00 - 22:30",
                "boarding_gate_code": "Skywalk Gate MTC Bay",
                "vehicle_capacity": "24-Seater MTC Minibus",
            },
            {
                "service_id": "FDR_CMBT_SH01",
                "service_type": "SHARE_AUTO",
                "route_number": "SH-CMBT-01",
                "destination_en": "Ambattur Industrial Estate (Telephone Exchange)",
                "destination_ta": "அம்பத்தூர் தொழிற்பேட்டை",
                "via_en": "Thirumangalam, Padi Flyover, Britannia",
                "via_ta": "பாடி மேம்பாலம், பிரிட்டானியா",
                "frequency_minutes": 3,
                "fare_inr": 25.0,
                "operating_hours": "05:30 - 23:00",
                "boarding_gate_code": "Inner Ring Road Gate",
                "vehicle_capacity": "7-Seater Shared Auto",
            },
        ],
    },
}

@router.get("/hubs", response_model=List[InterchangeHubSummary])
def list_interchange_hubs():
    """
    List all curated Chennai multimodal interchange hubs with connected transit modes,
    platform counts, and step-free accessibility status.
    """
    results: List[InterchangeHubSummary] = []
    for hub in INTERCHANGE_HUBS.values():
        results.append(
            InterchangeHubSummary(
                hub_id=hub["hub_id"],
                name_en=hub["name_en"],
                name_ta=hub["name_ta"],
                modes=hub["modes"],
                lat=hub["lat"],
                lon=hub["lon"],
                total_platforms=len(hub["platforms"]),
                total_exits=len(hub["exit_gates"]),
                has_share_auto_stand=any(f["service_type"] == "SHARE_AUTO" for f in hub["feeders"]),
                has_small_bus_feeder=any(f["service_type"] == "MTC_SMALL_BUS" for f in hub["feeders"]),
                is_step_free=True,
            )
        )
    return results

@router.get("/hubs/{hub_id}", response_model=InterchangeHubDetail)
def get_interchange_hub_detail(hub_id: str):
    """
    Get comprehensive hub details including level-by-level directory, platform directory,
    exit gate guide, station amenities, and feeder transit routes.
    """
    hub = INTERCHANGE_HUBS.get(hub_id.upper())
    if not hub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interchange hub '{hub_id}' not found. Available hubs: {list(INTERCHANGE_HUBS.keys())}",
        )
    return InterchangeHubDetail(**hub)

@router.post("/transfer-guide", response_model=TransferGuideResponse)
def generate_station_transfer_guide(req: TransferGuideRequest):
    """
    Generate turn-by-turn pedestrian wayfinding transfer path between platforms,
    gates, or modes inside a complex multimodal station hub.
    Supports step-free wheelchair routing and level transitions.
    """
    hub = INTERCHANGE_HUBS.get(req.hub_id.upper())
    if not hub:
        raise HTTPException(status_code=404, detail=f"Hub '{req.hub_id}' not found.")

    # Find origin and destination platform metadata
    p_map = {p["platform_id"]: p for p in hub["platforms"]}
    origin = p_map.get(req.origin_platform_id)
    dest = p_map.get(req.destination_platform_id)

    origin_name = origin["platform_number"] if origin else req.origin_platform_id
    dest_name = dest["platform_number"] if dest else req.destination_platform_id

    # Compute realistic walking distance and steps based on level changes
    is_level_change = (origin and dest and origin["level"] != dest["level"])
    steps: List[TransferStep] = []

    # Step 1: Platform disembarkation
    steps.append(
        TransferStep(
            step_number=1,
            instruction_en=f"Alight from train/bus at {origin_name} and proceed towards the central concourse foyer.",
            instruction_ta=f"{origin_name}-ல் இறங்கி மத்திய முகப்பு நோக்கி செல்லவும்.",
            distance_meters=45,
            duration_seconds=40,
            level_change=None,
            is_step_free=True,
            signage_clue="Follow wayfinding directional signage on platform pillars",
        )
    )

    # Step 2: Level transition / Concourse
    if is_level_change:
        if req.wheelchair_only:
            transition_en = f"Locate step-free elevator marked 'LIFT' and transition from {origin['level']} to {dest['level']}."
            transition_ta = f"'LIFT' என குறிக்கப்பட்ட லிஃப்ட்டைப் பயன்படுத்தி {dest['level']} தளத்திற்கு செல்லவும்."
            level_tag = f"Take Elevator from {origin['level']} to {dest['level']}"
        else:
            transition_en = f"Take Escalator or Glass Elevator from {origin['level']} to {dest['level']} concourse level."
            transition_ta = f"நகரும் படிக்கட்டு (Escalator) அல்லது லிஃப்ட் வழியாக {dest['level']} தளத்திற்கு செல்லவும்."
            level_tag = f"Escalator / Lift transition to {dest['level']}"

        steps.append(
            TransferStep(
                step_number=2,
                instruction_en=transition_en,
                instruction_ta=transition_ta,
                distance_meters=35,
                duration_seconds=50,
                level_change=level_tag,
                is_step_free=True,
                signage_clue="Look for illuminated transit mode transfer signs above head",
            )
        )

    # Step 3: Fare gate / Subway passage if inter-modal
    is_intermodal = (origin and dest and origin["mode"] != dest["mode"])
    if is_intermodal:
        steps.append(
            TransferStep(
                step_number=3 if is_level_change else 2,
                instruction_en="Tap out of AFC fare gates using your Singara Chennai NCMC Smartcard or QR boarding pass.",
                instruction_ta="சிங்கார சென்னை NCMC ஸ்மார்ட்கார்டு அல்லது QR டிக்கெட்டைப் பயன்படுத்தி வெளியேறவும்.",
                distance_meters=25,
                duration_seconds=30,
                level_change=None,
                is_step_free=True,
                signage_clue="Follow green illuminated exit arrows toward transfer pedestrian subway",
            )
        )
        steps.append(
            TransferStep(
                step_number=4 if is_level_change else 3,
                instruction_en=f"Proceed along the covered pedestrian corridor connecting directly to {dest['mode']} terminal.",
                instruction_ta=f"{dest['mode']} முனையத்திற்கு இணைக்கும் மூடப்பட்ட நடைபாதை வழியாக செல்லவும்.",
                distance_meters=95,
                duration_seconds=85,
                level_change=None,
                is_step_free=True,
                signage_clue=f"Follow directional logos for {dest['mode']}",
            )
        )

    # Final Step: Platform Arrival
    steps.append(
        TransferStep(
            step_number=len(steps) + 1,
            instruction_en=f"Enter {dest_name} and verify your upcoming departure on the overhead live indicator board.",
            instruction_ta=f"{dest_name}-க்குள் நுழைந்து அறிவிப்பு பலகையில் புறப்படும் நேரத்தை சரிபார்க்கவும்.",
            distance_meters=40,
            duration_seconds=35,
            level_change=None,
            is_step_free=True,
            signage_clue=f"Boarding at {dest_name}",
        )
    )

    total_dist = sum(s.distance_meters for s in steps)
    total_sec = sum(s.duration_seconds for s in steps)
    duration_mins = round(total_sec / 60.0, 1)

    return TransferGuideResponse(
        hub_id=hub["hub_id"],
        origin_platform_name=origin_name,
        destination_platform_name=dest_name,
        total_walking_distance_meters=total_dist,
        estimated_walk_duration_minutes=duration_mins,
        is_fully_step_free=True,
        has_elevator_option=True,
        steps=steps,
        tips_en=[
            "All transfers in this hub are under CCTV surveillance with 24/7 security personnel.",
            "Use tactile floor paving along the central corridor if visually impaired.",
            "NCMC card balance revalidation kiosks are available near AFC gates.",
        ],
        tips_ta=[
            "அனைத்து நடைபாதைகளும் 24 மணி நேர சிசிடிவி கண்காணிப்பில் உள்ளன.",
            "பார்வை குறைபாடுள்ளவர்களுக்கான தொடு உணர் தரைத்தளம் அமைக்கப்பட்டுள்ளது.",
            "NCMC ஸ்மார்ட்கார்டு ரீசார்ஜ் இயந்திரங்கள் கேட் அருகே உள்ளன.",
        ],
    )

@router.get("/feeders", response_model=List[FeederServiceInfo])
def list_station_feeders(hub_id: Optional[str] = Query(None)):
    """
    List first/last-mile feeder buses (MTC Small Bus S-series) and Chennai Share-Autos
    originating or passing through major transit interchange hubs.
    """
    all_feeders: List[FeederServiceInfo] = []
    if hub_id:
        hub = INTERCHANGE_HUBS.get(hub_id.upper())
        if not hub:
            raise HTTPException(status_code=404, detail=f"Hub '{hub_id}' not found.")
        return [FeederServiceInfo(**f) for f in hub["feeders"]]

    for h in INTERCHANGE_HUBS.values():
        for f in h["feeders"]:
            all_feeders.append(FeederServiceInfo(**f))
    return all_feeders

@router.post("/feeder-recommend", response_model=FeederRecommendationResponse)
def recommend_first_last_mile_feeder(req: FeederRecommendationRequest):
    """
    Recommend the optimal MTC Minibus or Chennai Share-Auto based on destination
    neighbourhood keyword (e.g. 'Madipakkam', 'Porur', 'Mogappair', 'Camp Road').
    """
    hub = INTERCHANGE_HUBS.get(req.hub_id.upper())
    if not hub:
        raise HTTPException(status_code=404, detail=f"Hub '{req.hub_id}' not found.")

    query = req.destination_query.strip().lower()
    feeders = [FeederServiceInfo(**f) for f in hub["feeders"]]

    # Score feeders based on destination and via keywords
    matched: List[FeederServiceInfo] = []
    for f in feeders:
        text = f"{f.destination_en} {f.via_en} {f.destination_ta} {f.via_ta}".lower()
        if any(word in text for word in query.split()):
            if req.max_fare is None or f.fare_inr <= req.max_fare:
                matched.append(f)

    # Fallback to all feeders if query doesn't match specific neighbourhood
    candidates = matched if matched else feeders

    # Fastest: minimum frequency
    fastest = min(candidates, key=lambda x: x.frequency_minutes) if candidates else None
    # Cheapest: minimum fare
    cheapest = min(candidates, key=lambda x: x.fare_inr) if candidates else None

    return FeederRecommendationResponse(
        hub_id=hub["hub_id"],
        destination_matched=req.destination_query,
        recommended_feeders=candidates,
        fastest_option=fastest,
        cheapest_option=cheapest,
    )
