import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

BACKEND_DIR=Path(__file__).resolve().parents[1]/"backend"; sys.path.insert(0,str(BACKEND_DIR))
import application as app  # noqa: E402


class GeocodingTests(unittest.TestCase):
    def test_search_returns_hidden_coordinates_and_address_parts(self):
        raw=[{"display_name":"Connaught Place, Delhi","lat":"28.6315","lon":"77.2167","address":{"city":"New Delhi","state":"Delhi","postcode":"110001","country":"India"}}]
        with patch.object(app,"geocoding_request",return_value=raw):
            result=app.search_addresses("Connaught Place",None)
        self.assertEqual(result[0]["city"],"New Delhi"); self.assertEqual(result[0]["lat"],28.6315)

    def test_short_search_is_rejected_without_external_request(self):
        with self.assertRaises(HTTPException) as context: app.search_addresses("a",None)
        self.assertEqual(context.exception.status_code,400)

    def test_reverse_validates_coordinates(self):
        with self.assertRaises(HTTPException) as context: app.reverse_geocode(app.ReverseGeocodeRequest(lat=100,lng=0),None)
        self.assertEqual(context.exception.status_code,400)


if __name__=="__main__": unittest.main()
