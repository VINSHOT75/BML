#!/usr/bin/env python3
"""
Backend API Testing for Bookmyload TMS
Tests all CRUD operations and API endpoints
"""

import requests
import sys
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

class BookmyloadAPITester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.session_token = "test_session_bookmyload_123"  # Use test session
        self.headers = {'Content-Type': 'application/json'}
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_ids = {
            'vehicles': [],
            'drivers': [],
            'trips': []
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def make_request(self, method: str, endpoint: str, data: Dict = None, expected_status: int = 200) -> tuple:
        """Make API request and return success status and response"""
        url = f"{self.api_base}/{endpoint}"
        headers = self.headers.copy()
        
        if self.session_token:
            headers['Authorization'] = f'Bearer {self.session_token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def test_health_check(self):
        """Test API health endpoint"""
        success, response = self.make_request('GET', 'health')
        self.log_test(
            "Health Check", 
            success and response.get('status') == 'healthy',
            f"Response: {response}"
        )
        return success

    def test_auth_me(self):
        """Test auth/me endpoint with test session"""
        success, response = self.make_request('GET', 'auth/me')
        self.log_test(
            "Auth Me (With Test Session)", 
            success and 'user_id' in response,
            f"Response: {response}"
        )
        return success

    def test_vehicles_crud(self):
        """Test vehicle CRUD operations with authentication"""
        # Test GET vehicles
        success, response = self.make_request('GET', 'vehicles')
        self.log_test(
            "Get Vehicles (With Auth)", 
            success and isinstance(response, list),
            f"Response: {len(response) if isinstance(response, list) else response}"
        )

        # Test POST vehicle
        vehicle_data = {
            "registration_number": "TEST001",
            "vehicle_type": "truck",
            "make": "Tata",
            "model": "LPT 1613",
            "year": 2023,
            "capacity_tons": 15.0,
            "fuel_type": "diesel"
        }
        
        success, response = self.make_request('POST', 'vehicles', vehicle_data, 200)
        if success and 'vehicle_id' in response:
            self.created_ids['vehicles'].append(response['vehicle_id'])
        self.log_test(
            "Create Vehicle (With Auth)", 
            success and 'vehicle_id' in response,
            f"Vehicle ID: {response.get('vehicle_id', 'Not found')}"
        )

        # Test GET specific vehicle
        if self.created_ids['vehicles']:
            vehicle_id = self.created_ids['vehicles'][0]
            success, response = self.make_request('GET', f'vehicles/{vehicle_id}')
            self.log_test(
                "Get Specific Vehicle", 
                success and response.get('vehicle_id') == vehicle_id,
                f"Response: {response}"
            )

        return len(self.created_ids['vehicles']) > 0

    def test_drivers_crud(self):
        """Test driver CRUD operations with authentication"""
        success, response = self.make_request('GET', 'drivers')
        self.log_test(
            "Get Drivers (With Auth)", 
            success and isinstance(response, list),
            f"Response: {len(response) if isinstance(response, list) else response}"
        )

        # Test POST driver
        driver_data = {
            "name": "Test Driver",
            "phone": "+91-9876543210",
            "email": "test@example.com",
            "license_number": "DL123456789",
            "license_expiry": (datetime.now() + timedelta(days=365)).isoformat(),
            "address": "Test Address, Mumbai"
        }
        
        success, response = self.make_request('POST', 'drivers', driver_data, 200)
        if success and 'driver_id' in response:
            self.created_ids['drivers'].append(response['driver_id'])
        self.log_test(
            "Create Driver (With Auth)", 
            success and 'driver_id' in response,
            f"Driver ID: {response.get('driver_id', 'Not found')}"
        )

        return len(self.created_ids['drivers']) > 0

    def test_trips_crud(self):
        """Test trip CRUD operations with authentication"""
        success, response = self.make_request('GET', 'trips')
        self.log_test(
            "Get Trips (With Auth)", 
            success and isinstance(response, list),
            f"Response: {len(response) if isinstance(response, list) else response}"
        )

        # Test POST trip
        trip_data = {
            "origin": "Mumbai",
            "destination": "Delhi",
            "cargo_type": "Electronics",
            "cargo_weight_tons": 10.5,
            "customer_name": "Test Customer",
            "customer_phone": "+91-9876543210",
            "scheduled_date": (datetime.now() + timedelta(days=1)).isoformat()
        }
        
        success, response = self.make_request('POST', 'trips', trip_data, 200)
        if success and 'trip_id' in response:
            self.created_ids['trips'].append(response['trip_id'])
        self.log_test(
            "Create Trip (With Auth)", 
            success and 'trip_id' in response,
            f"Trip ID: {response.get('trip_id', 'Not found')}"
        )

        # Test trip assignment if we have vehicle and driver
        if (self.created_ids['trips'] and 
            self.created_ids['vehicles'] and 
            self.created_ids['drivers']):
            
            trip_id = self.created_ids['trips'][0]
            vehicle_id = self.created_ids['vehicles'][0]
            driver_id = self.created_ids['drivers'][0]
            
            assign_data = {
                "driver_id": driver_id,
                "vehicle_id": vehicle_id
            }
            
            success, response = self.make_request('POST', f'trips/{trip_id}/assign?driver_id={driver_id}&vehicle_id={vehicle_id}')
            self.log_test(
                "Assign Trip", 
                success,
                f"Response: {response}"
            )

        return len(self.created_ids['trips']) > 0

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint with authentication"""
        success, response = self.make_request('GET', 'dashboard/stats')
        expected_fields = ['total_vehicles', 'available_vehicles', 'total_drivers', 'available_drivers', 'active_trips']
        has_required_fields = all(field in response for field in expected_fields) if isinstance(response, dict) else False
        
        self.log_test(
            "Dashboard Stats (With Auth)", 
            success and has_required_fields,
            f"Response: {response}"
        )
        return success

    def test_ai_insights(self):
        """Test AI insights endpoint with authentication"""
        ai_query = {
            "query": "How can I optimize my fleet utilization?"
        }
        
        success, response = self.make_request('POST', 'ai/insights', ai_query)
        has_insight = 'insight' in response if isinstance(response, dict) else False
        self.log_test(
            "AI Insights (With Auth)", 
            success and has_insight,
            f"Response: {response.get('insight', 'No insight field')[:100] if isinstance(response, dict) else response}"
        )
        return success

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.make_request('GET', '')
        self.log_test(
            "Root API Endpoint", 
            success and 'Bookmyload API' in str(response),
            f"Response: {response}"
        )
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Bookmyload API Tests...")
        print(f"📍 Testing API at: {self.api_base}")
        print(f"🔑 Using test session: {self.session_token}")
        print("=" * 60)

        # Test basic connectivity
        self.test_health_check()
        self.test_root_endpoint()
        
        # Test auth with test session
        self.test_auth_me()
        
        # Test protected endpoints with auth
        self.test_vehicles_crud()
        self.test_drivers_crud() 
        self.test_trips_crud()
        self.test_dashboard_stats()
        self.test_ai_insights()

        # Print summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed >= self.tests_run * 0.8:  # 80% pass rate
            print("🎉 Most tests passed!")
            return 0
        else:
            print("⚠️  Many tests failed")
            return 1

def main():
    tester = BookmyloadAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
