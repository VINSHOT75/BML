from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from enum import Enum
from database import Database

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Persistent local database (no external database server required)
db = Database(os.environ.get("DATABASE_PATH", str(ROOT_DIR / "data" / "bookmyload.db")))

# Create the main app
app = FastAPI(title="Bookmyload API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== ENUMS ==============
class VehicleStatus(str, Enum):
    AVAILABLE = "available"
    IN_TRANSIT = "in_transit"
    MAINTENANCE = "maintenance"
    OFFLINE = "offline"

class DriverStatus(str, Enum):
    AVAILABLE = "available"
    ON_TRIP = "on_trip"
    OFF_DUTY = "off_duty"
    ON_LEAVE = "on_leave"

class TripStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

# ============== MODELS ==============
class AppModel(BaseModel):
    """Pydantic model with the v2 serialization name used by the API code."""
    def model_dump(self, *args, **kwargs):
        return self.dict(*args, **kwargs)

# User Models
class User(AppModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "admin"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(AppModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Vehicle Models
class VehicleBase(AppModel):
    registration_number: str
    vehicle_type: str  # truck, trailer, tanker, etc.
    make: str
    model: str
    year: int
    capacity_tons: float
    fuel_type: str = "diesel"
    current_location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class VehicleCreate(VehicleBase):
    pass

class Vehicle(VehicleBase):
    vehicle_id: str = Field(default_factory=lambda: f"veh_{uuid.uuid4().hex[:12]}")
    status: VehicleStatus = VehicleStatus.AVAILABLE
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None
    total_trips: int = 0
    total_km: float = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Driver Models
class DriverBase(AppModel):
    name: str
    phone: str
    email: Optional[str] = None
    license_number: str
    license_expiry: datetime
    address: Optional[str] = None
    emergency_contact: Optional[str] = None

class DriverCreate(DriverBase):
    pass

class Driver(DriverBase):
    driver_id: str = Field(default_factory=lambda: f"drv_{uuid.uuid4().hex[:12]}")
    status: DriverStatus = DriverStatus.AVAILABLE
    assigned_vehicle_id: Optional[str] = None
    total_trips: int = 0
    total_km: float = 0
    rating: float = 5.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Trip Models
class TripBase(AppModel):
    origin: str
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    destination: str
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    cargo_type: str
    cargo_weight_tons: float
    customer_name: str
    customer_phone: Optional[str] = None
    scheduled_date: datetime
    notes: Optional[str] = None

class TripCreate(TripBase):
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None

class Trip(TripBase):
    trip_id: str = Field(default_factory=lambda: f"trip_{uuid.uuid4().hex[:12]}")
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    status: TripStatus = TripStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    distance_km: Optional[float] = None
    estimated_duration_hours: Optional[float] = None
    actual_duration_hours: Optional[float] = None
    pod_signature: Optional[str] = None
    pod_photo: Optional[str] = None
    pod_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Compliance Models
class PreTripCheck(AppModel):
    check_id: str = Field(default_factory=lambda: f"chk_{uuid.uuid4().hex[:12]}")
    trip_id: str
    driver_id: str
    vehicle_id: str
    tires_ok: bool = False
    brakes_ok: bool = False
    lights_ok: bool = False
    mirrors_ok: bool = False
    fuel_level: str = "full"
    documents_ok: bool = False
    notes: Optional[str] = None
    checked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Analytics Models
class DashboardStats(AppModel):
    total_vehicles: int
    available_vehicles: int
    total_drivers: int
    available_drivers: int
    active_trips: int
    completed_trips_today: int
    total_km_today: float
    pending_maintenance: int

# AI Insight Model
class AIInsightRequest(AppModel):
    query: str

class AIInsightResponse(AppModel):
    insight: str
    generated_at: datetime

# ============== AUTH HELPERS ==============

async def get_current_user(request: Request) -> User:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

# ============== AUTH ROUTES ==============

@api_router.post("/auth/login")
async def create_session(request: Request, response: Response):
    """Create a local development session.

    This self-hosted mode deliberately avoids third-party identity providers.
    Add a production identity provider before exposing the app publicly.
    """
    body = await request.json()
    email = body.get("email", "admin@bookmyload.local").strip().lower()
    name = body.get("name", "Local Administrator").strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
    else:
        # Create new user
        new_user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": None,
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=os.environ.get("COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
        path="/",
        max_age=7*24*60*60
    )
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user_doc

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============== VEHICLE ROUTES ==============

@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles(user: User = Depends(get_current_user)):
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(1000)
    return vehicles

@api_router.get("/vehicles/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str, user: User = Depends(get_current_user)):
    vehicle = await db.vehicles.find_one({"vehicle_id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle

@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle_data: VehicleCreate, user: User = Depends(get_current_user)):
    vehicle = Vehicle(**vehicle_data.model_dump())
    doc = vehicle.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('last_maintenance'):
        doc['last_maintenance'] = doc['last_maintenance'].isoformat()
    if doc.get('next_maintenance'):
        doc['next_maintenance'] = doc['next_maintenance'].isoformat()
    await db.vehicles.insert_one(doc)
    return vehicle

@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, vehicle_data: VehicleCreate, user: User = Depends(get_current_user)):
    existing = await db.vehicles.find_one({"vehicle_id": vehicle_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_data = vehicle_data.model_dump()
    await db.vehicles.update_one({"vehicle_id": vehicle_id}, {"$set": update_data})
    
    updated = await db.vehicles.find_one({"vehicle_id": vehicle_id}, {"_id": 0})
    return updated

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, user: User = Depends(get_current_user)):
    result = await db.vehicles.delete_one({"vehicle_id": vehicle_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted"}

@api_router.patch("/vehicles/{vehicle_id}/status")
async def update_vehicle_status(vehicle_id: str, status: VehicleStatus, user: User = Depends(get_current_user)):
    result = await db.vehicles.update_one(
        {"vehicle_id": vehicle_id},
        {"$set": {"status": status.value}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Status updated"}

# ============== DRIVER ROUTES ==============

@api_router.get("/drivers", response_model=List[Driver])
async def get_drivers(user: User = Depends(get_current_user)):
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(1000)
    return drivers

@api_router.get("/drivers/{driver_id}", response_model=Driver)
async def get_driver(driver_id: str, user: User = Depends(get_current_user)):
    driver = await db.drivers.find_one({"driver_id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver

@api_router.post("/drivers", response_model=Driver)
async def create_driver(driver_data: DriverCreate, user: User = Depends(get_current_user)):
    driver = Driver(**driver_data.model_dump())
    doc = driver.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['license_expiry'] = doc['license_expiry'].isoformat()
    await db.drivers.insert_one(doc)
    return driver

@api_router.put("/drivers/{driver_id}", response_model=Driver)
async def update_driver(driver_id: str, driver_data: DriverCreate, user: User = Depends(get_current_user)):
    existing = await db.drivers.find_one({"driver_id": driver_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    update_data = driver_data.model_dump()
    update_data['license_expiry'] = update_data['license_expiry'].isoformat()
    await db.drivers.update_one({"driver_id": driver_id}, {"$set": update_data})
    
    updated = await db.drivers.find_one({"driver_id": driver_id}, {"_id": 0})
    return updated

@api_router.delete("/drivers/{driver_id}")
async def delete_driver(driver_id: str, user: User = Depends(get_current_user)):
    result = await db.drivers.delete_one({"driver_id": driver_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"message": "Driver deleted"}

@api_router.patch("/drivers/{driver_id}/status")
async def update_driver_status(driver_id: str, status: DriverStatus, user: User = Depends(get_current_user)):
    result = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {"status": status.value}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"message": "Status updated"}

# ============== TRIP ROUTES ==============

@api_router.get("/trips", response_model=List[Trip])
async def get_trips(status: Optional[TripStatus] = None, user: User = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status.value
    trips = await db.trips.find(query, {"_id": 0}).to_list(1000)
    return trips

@api_router.get("/trips/{trip_id}", response_model=Trip)
async def get_trip(trip_id: str, user: User = Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

@api_router.post("/trips", response_model=Trip)
async def create_trip(trip_data: TripCreate, user: User = Depends(get_current_user)):
    trip = Trip(**trip_data.model_dump())
    doc = trip.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['scheduled_date'] = doc['scheduled_date'].isoformat()
    if doc.get('started_at'):
        doc['started_at'] = doc['started_at'].isoformat()
    if doc.get('completed_at'):
        doc['completed_at'] = doc['completed_at'].isoformat()
    await db.trips.insert_one(doc)
    return trip

@api_router.put("/trips/{trip_id}", response_model=Trip)
async def update_trip(trip_id: str, trip_data: TripCreate, user: User = Depends(get_current_user)):
    existing = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    update_data = trip_data.model_dump()
    update_data['scheduled_date'] = update_data['scheduled_date'].isoformat()
    await db.trips.update_one({"trip_id": trip_id}, {"$set": update_data})
    
    updated = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    return updated

@api_router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, user: User = Depends(get_current_user)):
    result = await db.trips.delete_one({"trip_id": trip_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"message": "Trip deleted"}

@api_router.patch("/trips/{trip_id}/status")
async def update_trip_status(trip_id: str, status: TripStatus, user: User = Depends(get_current_user)):
    update_data = {"status": status.value}
    
    if status == TripStatus.IN_PROGRESS:
        update_data["started_at"] = datetime.now(timezone.utc).isoformat()
        # Update driver and vehicle status
        trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
        if trip:
            if trip.get("driver_id"):
                await db.drivers.update_one(
                    {"driver_id": trip["driver_id"]},
                    {"$set": {"status": DriverStatus.ON_TRIP.value}}
                )
            if trip.get("vehicle_id"):
                await db.vehicles.update_one(
                    {"vehicle_id": trip["vehicle_id"]},
                    {"$set": {"status": VehicleStatus.IN_TRANSIT.value}}
                )
    
    elif status == TripStatus.COMPLETED:
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        # Update driver and vehicle status back to available
        trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
        if trip:
            if trip.get("driver_id"):
                await db.drivers.update_one(
                    {"driver_id": trip["driver_id"]},
                    {"$set": {"status": DriverStatus.AVAILABLE.value}}
                )
            if trip.get("vehicle_id"):
                await db.vehicles.update_one(
                    {"vehicle_id": trip["vehicle_id"]},
                    {"$set": {"status": VehicleStatus.AVAILABLE.value}}
                )
    
    result = await db.trips.update_one({"trip_id": trip_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"message": "Status updated"}

@api_router.post("/trips/{trip_id}/assign")
async def assign_trip(trip_id: str, driver_id: str, vehicle_id: str, user: User = Depends(get_current_user)):
    # Verify driver and vehicle exist
    driver = await db.drivers.find_one({"driver_id": driver_id}, {"_id": 0})
    vehicle = await db.vehicles.find_one({"vehicle_id": vehicle_id}, {"_id": 0})
    
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    result = await db.trips.update_one(
        {"trip_id": trip_id},
        {"$set": {
            "driver_id": driver_id,
            "vehicle_id": vehicle_id,
            "status": TripStatus.ASSIGNED.value
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    return {"message": "Trip assigned successfully"}

# ============== COMPLIANCE ROUTES ==============

@api_router.post("/compliance/pre-trip-check", response_model=PreTripCheck)
async def create_pre_trip_check(check_data: dict, user: User = Depends(get_current_user)):
    check = PreTripCheck(**check_data)
    doc = check.model_dump()
    doc['checked_at'] = doc['checked_at'].isoformat()
    await db.pre_trip_checks.insert_one(doc)
    return check

@api_router.get("/compliance/pre-trip-checks/{trip_id}")
async def get_pre_trip_checks(trip_id: str, user: User = Depends(get_current_user)):
    checks = await db.pre_trip_checks.find({"trip_id": trip_id}, {"_id": 0}).to_list(100)
    return checks

# ============== DASHBOARD & ANALYTICS ==============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(user: User = Depends(get_current_user)):
    total_vehicles = await db.vehicles.count_documents({})
    available_vehicles = await db.vehicles.count_documents({"status": VehicleStatus.AVAILABLE.value})
    total_drivers = await db.drivers.count_documents({})
    available_drivers = await db.drivers.count_documents({"status": DriverStatus.AVAILABLE.value})
    active_trips = await db.trips.count_documents({"status": {"$in": [TripStatus.IN_PROGRESS.value, TripStatus.ASSIGNED.value]}})
    
    # Completed trips today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    completed_trips_today = await db.trips.count_documents({
        "status": TripStatus.COMPLETED.value,
        "completed_at": {"$gte": today_start.isoformat()}
    })
    
    pending_maintenance = await db.vehicles.count_documents({"status": VehicleStatus.MAINTENANCE.value})
    
    return DashboardStats(
        total_vehicles=total_vehicles,
        available_vehicles=available_vehicles,
        total_drivers=total_drivers,
        available_drivers=available_drivers,
        active_trips=active_trips,
        completed_trips_today=completed_trips_today,
        total_km_today=0,  # Would calculate from completed trips
        pending_maintenance=pending_maintenance
    )

@api_router.get("/analytics/trip-summary")
async def get_trip_summary(user: User = Depends(get_current_user)):
    """Get trip statistics for charts"""
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    results = await db.trips.aggregate(pipeline).to_list(100)
    return {item["_id"]: item["count"] for item in results}

# ============== AI INSIGHTS ==============

@api_router.post("/ai/insights", response_model=AIInsightResponse)
async def get_ai_insights(request: AIInsightRequest, user: User = Depends(get_current_user)):
    """Generate useful local insights without an external AI service."""
    stats = await get_dashboard_stats(user)
    insights = []
    if stats.pending_maintenance:
        insights.append(f"Prioritize the {stats.pending_maintenance} vehicle(s) awaiting maintenance.")
    if stats.available_vehicles > stats.available_drivers:
        insights.append("Driver availability is limiting usable fleet capacity; review rosters and leave schedules.")
    if stats.active_trips and not stats.available_vehicles:
        insights.append("Fleet utilization is at capacity; consolidate loads or schedule new work after active trips finish.")
    if not insights:
        insights.append("Capacity is balanced. Review upcoming trips and group nearby destinations to reduce empty kilometres.")
    response = " ".join(insights)
    
    return AIInsightResponse(
        insight=response,
        generated_at=datetime.now(timezone.utc)
    )

# ============== HEALTH CHECK ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Bookmyload API"}

@api_router.get("/")
async def root():
    return {"message": "Welcome to Bookmyload API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get(
            "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    db.close()
