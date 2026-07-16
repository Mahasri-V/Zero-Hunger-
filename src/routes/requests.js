const express = require('express');
const router = express.Router();
const db = require('../db/jsonDb');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getDistance } = require('../utils/distance');

// Post a new food request (Receiver only)
router.post('/', authenticateToken, requireRole('receiver'), async (req, res) => {
  try {
    const { peopleCount, urgency, reason, address, lat, lon } = req.body;

    if (!peopleCount || !urgency || !address || lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const request = await db.requests.insert({
      receiverId: req.user.id,
      receiverName: req.user.name,
      peopleCount: parseInt(peopleCount),
      urgency, // Normal, Urgent, Critical
      reason: reason || '',
      address,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      status: 'Open', // Open, Fulfilled
      donorId: null,
      donorName: null,
      fulfilledAt: null
    });

    res.status(201).json({
      message: 'Emergency request posted successfully',
      request
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get receiver's own request history
router.get('/receiver', authenticateToken, requireRole('receiver'), async (req, res) => {
  try {
    const requestsList = await db.requests.find({ receiverId: req.user.id });
    requestsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(requestsList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get nearby open receiver requests (Donor only)
router.get('/donor', authenticateToken, requireRole('donor'), async (req, res) => {
  try {
    const donor = await db.users.findById(req.user.id);
    if (!donor) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    const donLat = req.query.lat ? parseFloat(req.query.lat) : donor.lat;
    const donLon = req.query.lon ? parseFloat(req.query.lon) : donor.lon;

    const openRequests = await db.requests.find({ status: 'Open' });
    const nearbyRequests = [];

    // Let's filter within 25 km for emergency requests
    const MAX_EMERGENCY_RADIUS = 25; 

    for (const reqItem of openRequests) {
      const distance = getDistance(reqItem.lat, reqItem.lon, donLat, donLon);
      if (distance <= MAX_EMERGENCY_RADIUS) {
        nearbyRequests.push({
          ...reqItem,
          distance: parseFloat(distance.toFixed(2))
        });
      }
    }

    // Urgency weight: Critical = 3, Urgent = 2, Normal = 1
    const urgencyWeight = { 'Critical': 3, 'Urgent': 2, 'Normal': 1 };

    // Sort by Urgency descending, then distance ascending
    nearbyRequests.sort((a, b) => {
      const weightA = urgencyWeight[a.urgency] || 0;
      const weightB = urgencyWeight[b.urgency] || 0;
      if (weightB !== weightA) {
        return weightB - weightA;
      }
      return a.distance - b.distance;
    });

    res.json(nearbyRequests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fulfill a request (Donor only)
router.post('/:id/fulfill', authenticateToken, requireRole('donor'), async (req, res) => {
  try {
    const requestId = req.params.id;
    const request = await db.requests.findById(requestId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'Open') {
      return res.status(400).json({ error: 'Request is already fulfilled' });
    }

    const updated = await db.requests.updateOne(
      { id: requestId, status: 'Open' },
      {
        status: 'Fulfilled',
        donorId: req.user.id,
        donorName: req.user.name,
        fulfilledAt: new Date().toISOString()
      }
    );

    if (!updated) {
      return res.status(400).json({ error: 'Race condition: Request was already fulfilled.' });
    }

    res.json({
      message: 'Request fulfilled successfully',
      request: updated
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
