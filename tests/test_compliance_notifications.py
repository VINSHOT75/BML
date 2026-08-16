import sys,unittest,base64
from datetime import datetime,timedelta,timezone
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
BACKEND_DIR=Path(__file__).resolve().parents[1]/"backend";sys.path.insert(0,str(BACKEND_DIR))
import application as app
import orm_models as orm
from persistence import Base
class ComplianceNotificationTests(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine("sqlite:///:memory:",connect_args={"check_same_thread":False},poolclass=StaticPool);Base.metadata.create_all(self.engine);self.db=sessionmaker(bind=self.engine,expire_on_commit=False)();u=orm.User(id="u",google_sub="u",email="u@x",name="U");o=orm.Organization(id="o",name="O",slug="o");m=orm.Membership(id="m",user_id="u",organization_id="o",role="organization_owner");d=orm.Driver(id="d",organization_id="o",name="D",phone="1",license_number="L",license_expiry=datetime.now(timezone.utc)+timedelta(days=30));v=orm.Vehicle(id="v",organization_id="o",registration_number="V",vehicle_type="T",make="M",model="X",year=2025,capacity_tons=10);self.db.add_all([u,o,m,d,v]);self.db.commit();self.auth=app.AuthContext(u,o,m,None,{"*"});self.d=d;self.v=v
 def tearDown(self):self.db.close();Base.metadata.drop_all(self.engine);self.engine.dispose()
 def payload(self):return app.DocumentCreate(entity_type="vehicle",entity_id="v",document_type="insurance",expires_at=datetime.now(timezone.utc)+timedelta(days=30),file_name="x.pdf",mime_type="application/pdf",file_data="data:application/pdf;base64,"+base64.b64encode(b"pdf").decode())
 def test_document_upload_and_verification(self):
  doc=app.create_document(self.payload(),self.auth,self.db);self.assertEqual(doc["verification_status"],"pending");verified=app.verify_document(doc["document_id"],app.DocumentVerification(status="verified"),self.auth,self.db);self.assertEqual(verified["verification_status"],"verified");self.assertTrue(app.get_notifications(self.auth,self.db))
 def test_expired_critical_document_blocks_assignment(self):
  p=self.payload();p.expires_at=datetime.now(timezone.utc)-timedelta(days=1);app.create_document(p,self.auth,self.db)
  with self.assertRaises(HTTPException) as context:app.assert_assignment_compliance(self.db,"o",self.d,self.v)
  self.assertEqual(context.exception.status_code,409)
 def test_invalid_file_is_rejected(self):
  p=self.payload();p.file_data="not-base64"
  with self.assertRaises(HTTPException) as context:app.create_document(p,self.auth,self.db)
  self.assertEqual(context.exception.status_code,400)
if __name__=="__main__":unittest.main()
