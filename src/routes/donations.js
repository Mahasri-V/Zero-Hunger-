const express = require('express');
const router = express.Router();
const db = require('../db/jsonDb');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getDistance } = require('../utils/distance');

// Post a new donation (Donor only)
router.post('/', authenticateToken, requireRole('donor'), async (req, res) => {
  try {
    const { foodName, quantity, foodType, pickupAddress, lat, lon, notes } = req.body;

    if (!foodName || !quantity || !foodType || !pickupAddress || lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const donation = await db.donations.insert({
      donorId: req.user.id,
      donorName: req.user.name,
      foodName,
      quantity: parseInt(quantity),
      foodType,
      pickupAddress,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      notes: notes || '',
      status: 'Waiting', // Waiting, Accepted, Collected
      radius: 5,         // Initial radius in km
      receiverId: null,
      receiverName: null,
      acceptedAt: null,
      collectedAt: null
    });

    res.status(201).json({
      message: 'Donation posted successfully',
      donation
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get donor's own donations history
router.get('/donor', authenticateToken, requireRole('donor'), async (req, res) => {
  try {
    const donationsList = await db.donations.find({ donorId: req.user.id });
    // Sort newest first
    donationsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(donationsList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available donations for receiver based on radius and distance (Receiver only)
router.get('/receiver', authenticateToken, requireRole('receiver'), async (req, res) => {
  try {
    const receiver = await db.users.findById(req.user.id);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver profile not found' });
    }

    // Allow override coordinates sent in query for testing/simulation
    const recLat = req.query.lat ? parseFloat(req.query.lat) : receiver.lat;
    const recLon = req.query.lon ? parseFloat(req.query.lon) : receiver.lon;

    const allWaiting = await db.donations.find({ status: 'Waiting' });
    const matchedDonations = [];

    for (const donation of allWaiting) {
      const distance = getDistance(donation.lat, donation.lon, recLat, recLon);
      // Check if distance is within the donation's current expanded notification radius
      if (distance <= donation.radius) {
        matchedDonations.push({
          ...donation,
          distance: parseFloat(distance.toFixed(2))
        });
      }
    }

    // Sort by distance (nearest first)
    matchedDonations.sort((a, b) => a.distance - b.distance);

    res.json(matchedDonations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get receiver's accepted donations list
router.get('/receiver/accepted', authenticateToken, requireRole('receiver'), async (req, res) => {
  try {
    const acceptedList = await db.donations.find({ receiverId: req.user.id });
    acceptedList.sort((a, b) => new Date(b.acceptedAt || b.createdAt) - new Date(a.acceptedAt || a.createdAt));
    res.json(acceptedList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept a donation (Receiver only) - Race-Safe first-to-accept check
router.post('/:id/accept', authenticateToken, requireRole('receiver'), async (req, res) => {
  try {
    const donationId = req.params.id;

    // Read the donation directly inside atomic function update flow
    // Find the current status first
    const donation = await db.donations.findById(donationId);
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    if (donation.status !== 'Waiting') {
      return res.status(400).json({ error: 'Donation has already been accepted or collected.' });
    }

    // Attempt to update only if status is still 'Waiting' (double-locking mechanism)
    const updated = await db.donations.updateOne(
      { id: donationId, status: 'Waiting' },
      {
        status: 'Accepted',
        receiverId: req.user.id,
        receiverName: req.user.name,
        acceptedAt: new Date().toISOString()
      }
    );

    if (!updated) {
      return res.status(400).json({ error: 'Race condition: Donation was accepted by another receiver just now.' });
    }

    res.json({
      message: 'Donation accepted successfully',
      donation: updated
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark donation as collected (Donor only)
router.post('/:id/collect', authenticateToken, requireRole('donor'), async (req, res) => {
  try {
    const donationId = req.params.id;
    const donation = await db.donations.findById(donationId);

    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    if (donation.donorId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: You are not the donor of this food item' });
    }

    if (donation.status !== 'Accepted') {
      return res.status(400).json({ error: 'Donation must be accepted before marking as collected' });
    }

    const updated = await db.donations.updateOne(
      { id: donationId },
      {
        status: 'Collected',
        collectedAt: new Date().toISOString()
      }
    );

    res.json({
      message: 'Donation marked as collected',
      donation: updated
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
