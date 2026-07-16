const assert = require('assert').strict;
const db = require('../src/db/jsonDb');
const { getDistance } = require('../src/utils/distance');

async function testDatabase() {
  console.log('🧪 Testing Database collection adapter...');
  
  // Test Insertion
  const sampleUser = {
    name: 'Sanity Test NGO',
    email: `test-${Date.now()}@ngo.org`,
    role: 'receiver',
    address: '123 Test St',
    lat: 12.9901,
    lon: 77.5960
  };
  
  const inserted = await db.users.insert(sampleUser);
  assert.ok(inserted.id, 'Inserted user should have a unique ID');
  assert.equal(inserted.name, sampleUser.name);
  console.log('  ✅ Database insertion passed.');

  // Test findOne
  const found = await db.users.findOne({ id: inserted.id });
  assert.ok(found, 'Should find the user by ID');
  assert.equal(found.email, sampleUser.email);
  console.log('  ✅ Database query findOne passed.');

  // Test updateOne
  const updated = await db.users.updateOne({ id: inserted.id }, { name: 'Updated NGO Name' });
  assert.ok(updated, 'Should return the updated document');
  assert.equal(updated.name, 'Updated NGO Name');
  console.log('  ✅ Database updateOne passed.');
}

function testDistance() {
  console.log('🧪 Testing distance calculation (Haversine)...');
  
  // Bangalore Central to Bangalore Airport
  const lat1 = 12.9716, lon1 = 77.5946; // Center
  const lat2 = 13.1986, lon2 = 77.7066; // Airport
  
  const distance = getDistance(lat1, lon1, lat2, lon2);
  console.log(`  Calculated Distance: ${distance.toFixed(2)} km`);
  
  // Expected distance is ~28km
  assert.ok(distance > 20 && distance < 35, 'Distance calculation should be accurate within tolerances (~25-30km)');
  console.log('  ✅ Haversine distance formula passed.');
}

async function testRadiusExpansion() {
  console.log('🧪 Testing donation radius expansion matching rules...');
  
  const mockDonation = {
    donorId: 'donor123',
    donorName: 'Test Hotel',
    foodName: 'Rice',
    quantity: 100,
    foodType: 'Veg',
    pickupAddress: 'Address A',
    lat: 12.9716,
    lon: 77.5946,
    status: 'Waiting',
    radius: 5
  };
  
  const receiverCoords = {
    lat: 12.9901,
    lon: 77.5960 // Distance ~ 2 km
  };
  
  const receiverFarCoords = {
    lat: 13.0620,
    lon: 77.6250 // Distance ~ 10.5 km
  };
  
  // Distance checks
  const distanceNear = getDistance(mockDonation.lat, mockDonation.lon, receiverCoords.lat, receiverCoords.lon);
  const distanceFar = getDistance(mockDonation.lat, mockDonation.lon, receiverFarCoords.lat, receiverFarCoords.lon);
  
  // Near receiver is within 5km starting radius
  assert.ok(distanceNear <= mockDonation.radius, 'Near receiver should be within initial 5km radius');
  // Far receiver is outside 5km starting radius
  assert.ok(distanceFar > mockDonation.radius, 'Far receiver should be outside initial 5km radius');
  
  // Widen radius to 15km
  mockDonation.radius = 15;
  assert.ok(distanceFar <= mockDonation.radius, 'Far receiver should be within expanded 15km radius');
  
  console.log('  ✅ Radius expansion check logic passed.');
}

async function runAllTests() {
  try {
    await testDatabase();
    testDistance();
    await testRadiusExpansion();
    console.log('\n🎉 ALL SANITY TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ SANITY TESTS FAILED:', err);
    process.exit(1);
  }
}

runAllTests();
