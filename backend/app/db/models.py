"""
SQLAlchemy ORM models for Transit Assist India.
Supports GTFS entities, bilingual stop search, spatial geometry, and Indian transit fares.
"""

from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    ForeignKey,
    Text,
    Index,
)
from sqlalchemy.orm import relationship
from backend.app.db.database import Base

class Agency(Base):
    __tablename__ = "agencies"

    agency_id = Column(String(50), primary_key=True, index=True)
    agency_name = Column(String(200), nullable=False)
    agency_url = Column(String(300))
    agency_timezone = Column(String(50), default="Asia/Kolkata")
    agency_lang = Column(String(10), default="en")

    routes = relationship("Route", back_populates="agency", cascade="all, delete-orphan")

class Stop(Base):
    __tablename__ = "stops"

    stop_id = Column(String(50), primary_key=True, index=True)
    stop_code = Column(String(50), index=True)
    stop_name = Column(String(255), nullable=False, index=True)
    stop_name_en = Column(String(255), index=True)
    stop_name_ta = Column(String(255), index=True)
    stop_desc = Column(Text, nullable=True)
    stop_lat = Column(Float, nullable=False, index=True)
    stop_lon = Column(Float, nullable=False, index=True)
    zone_id = Column(String(50), nullable=True)
    location_type = Column(Integer, default=0)

    stop_times = relationship("StopTime", back_populates="stop", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_stops_coords", "stop_lat", "stop_lon"),
    )

class Route(Base):
    __tablename__ = "routes"

    route_id = Column(String(50), primary_key=True, index=True)
    agency_id = Column(String(50), ForeignKey("agencies.agency_id"), nullable=False, index=True)
    route_short_name = Column(String(50), nullable=False, index=True)
    route_long_name = Column(String(255), nullable=False)
    route_type = Column(Integer, nullable=False)  # 1=Metro/Subway, 3=Bus
    route_color = Column(String(10), default="0066CC")
    route_text_color = Column(String(10), default="FFFFFF")

    agency = relationship("Agency", back_populates="routes")
    trips = relationship("Trip", back_populates="route", cascade="all, delete-orphan")

class Trip(Base):
    __tablename__ = "trips"

    trip_id = Column(String(100), primary_key=True, index=True)
    route_id = Column(String(50), ForeignKey("routes.route_id"), nullable=False, index=True)
    service_id = Column(String(50), nullable=False, index=True)
    trip_headsign = Column(String(255))
    direction_id = Column(Integer, default=0)
    shape_id = Column(String(100), index=True, nullable=True)

    route = relationship("Route", back_populates="trips")
    stop_times = relationship("StopTime", back_populates="trip", cascade="all, delete-orphan", order_by="StopTime.stop_sequence")

class StopTime(Base):
    __tablename__ = "stop_times"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(String(100), ForeignKey("trips.trip_id"), nullable=False, index=True)
    stop_id = Column(String(50), ForeignKey("stops.stop_id"), nullable=False, index=True)
    arrival_time = Column(String(10), nullable=False)
    departure_time = Column(String(10), nullable=False)
    arrival_seconds = Column(Integer, nullable=False, index=True)
    departure_seconds = Column(Integer, nullable=False, index=True)
    stop_sequence = Column(Integer, nullable=False)

    trip = relationship("Trip", back_populates="stop_times")
    stop = relationship("Stop", back_populates="stop_times")

    __table_args__ = (
        Index("idx_stoptimes_trip_seq", "trip_id", "stop_sequence"),
        Index("idx_stoptimes_stop_dep", "stop_id", "departure_seconds"),
    )

class ShapePoint(Base):
    __tablename__ = "shape_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shape_id = Column(String(100), nullable=False, index=True)
    shape_pt_lat = Column(Float, nullable=False)
    shape_pt_lon = Column(Float, nullable=False)
    shape_pt_sequence = Column(Integer, nullable=False)

    __table_args__ = (
        Index("idx_shape_seq", "shape_id", "shape_pt_sequence"),
    )

class TransitReport(Base):
    __tablename__ = "transit_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    route_id = Column(String(50), nullable=False, index=True)
    stop_id = Column(String(50), nullable=True, index=True)
    crowd_level = Column(String(20), nullable=False)  # "low", "moderate", "packed"
    delay_minutes = Column(Integer, default=0)
    comment = Column(String(255), nullable=True)
    created_at = Column(String(35), nullable=False, index=True)

