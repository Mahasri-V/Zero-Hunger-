// Application state
const state = {
  token: localStorage.getItem('zh_token') || null,
  user: JSON.parse(localStorage.getItem('zh_user')) || null,
  coords: {
    lat: parseFloat(localStorage.getItem('zh_lat')) || 12.9716, // Default Bangalore
    lon: parseFloat(localStorage.getItem('zh_lon')) || 77.5946,
    name: localStorage.getItem('zh_location_name') || 'Default (City Center)'
  },
  seenDonations: new Set(),
  seenRequests: new Set(),
  pollingInterval: null
};

// API endpoint URL base
const API_BASE = window.location.origin;

// DOM Elements
const screenAuth = document.getElementById('screen-auth');
const screenDonor = document.getElementById('screen-donor');
const screenReceiver = document.getElementById('screen-receiver');

const userDisplay = document.getElementById('user-display');
const btnLogout = document.getElementById('btn-logout');
const simStatusContainer = document.getElementById('sim-status-container');
const currentSimName = document.getElementById('current-sim-name');
const btnChangeLocation = document.getElementById('btn-change-location');

// Modals
const modalPostDonation = document.getElementById('modal-post-donation');
const modalPostRequest = document.getElementById('modal-post-request');
const modalSimulator = document.getElementById('modal-simulator');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  detectBrowserLocation();
  checkAuth();
});

// Detect browser coordinates
function detectBrowserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Only set if not already overridden by simulator
        if (!localStorage.getItem('zh_location_name')) {
          state.coords.lat = position.coords.latitude;
          state.coords.lon = position.coords.longitude;
          state.coords.name = 'Browser GPS Location';
          updateLocationUI();
        }
      },
      (error) => {
        console.log('Browser geolocation denied/failed. Using defaults.', error);
      }
    );
  }
}

// Update location widgets
function updateLocationUI() {
  currentSimName.textContent = state.coords.name;
  document.getElementById('sim-lat').value = state.coords.lat;
  document.getElementById('sim-lon').value = state.coords.lon;
  
  // Update signup hidden GPS fields
  document.getElementById('reg-lat').value = state.coords.lat;
  document.getElementById('reg-lon').value = state.coords.lon;
  document.getElementById('gps-status').textContent = `Captured: ${state.coords.lat.toFixed(4)}, ${state.coords.lon.toFixed(4)}`;
  document.getElementById('gps-status').style.color = 'var(--accent-emerald)';

  localStorage.setItem('zh_lat', state.coords.lat);
  localStorage.setItem('zh_lon', state.coords.lon);
  localStorage.setItem('zh_location_name', state.coords.name);
}

// Setup all click / submit events
function setupEventListeners() {
  // Navigation
  document.getElementById('logo-link').addEventListener('click', (e) => {
    e.preventDefault();
    checkAuth();
  });

  // Auth screen toggle links
  document.getElementById('link-to-register').addEventListener('click', () => {
    document.getElementById('form-login').style.display = 'none';
    document.getElementById('auth-title-login').style.display = 'none';
    document.getElementById('form-register').style.display = 'block';
    document.getElementById('auth-title-register').style.display = 'block';
    document.getElementById('auth-error').style.display = 'none';
  });

  document.getElementById('link-to-login').addEventListener('click', () => {
    document.getElementById('form-register').style.display = 'none';
    document.getElementById('auth-title-register').style.display = 'none';
    document.getElementById('form-login').style.display = 'block';
    document.getElementById('auth-title-login').style.display = 'block';
    document.getElementById('auth-error').style.display = 'none';
  });

  // Capture GPS on signup form
  document.getElementById('btn-fetch-gps').addEventListener('click', () => {
    if (navigator.geolocation) {
      document.getElementById('gps-status').textContent = 'Acquiring GPS...';
      document.getElementById('gps-status').style.color = 'var(--accent-amber)';
      navigator.geolocation.getCurrentPosition(
        (position) => {
          state.coords.lat = position.coords.latitude;
          state.coords.lon = position.coords.longitude;
          state.coords.name = 'Browser GPS Location';
          updateLocationUI();
        },
        (err) => {
          showToast('GPS Error', 'Could not access browser location. Please manually input coordinates.', 'warning');
          document.getElementById('gps-status').textContent = 'Failed. Using defaults.';
          document.getElementById('gps-status').style.color = 'var(--accent-rose)';
        }
      );
    } else {
      showToast('Not Supported', 'Geolocation is not supported by your browser.', 'danger');
    }
  });

  // Auth Submissions
  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('form-register').addEventListener('submit', handleRegister);
  btnLogout.addEventListener('click', logout);

  // Modals Open/Close
  btnChangeLocation.addEventListener('click', () => modalSimulator.classList.add('active'));
  document.getElementById('btn-close-sim-modal').addEventListener('click', () => modalSimulator.classList.remove('active'));

  // Donor post surplus modals
  const btnOpenDonation = document.getElementById('btn-open-donation-modal');
  if (btnOpenDonation) {
    btnOpenDonation.addEventListener('click', () => modalPostDonation.classList.add('active'));
  }
  document.getElementById('btn-close-donation-modal').addEventListener('click', () => modalPostDonation.classList.remove('active'));
  document.getElementById('form-post-donation').addEventListener('submit', handlePostDonation);

  // Receiver request modals
  const btnOpenRequest = document.getElementById('btn-open-request-modal');
  if (btnOpenRequest) {
    btnOpenRequest.addEventListener('click', () => modalPostRequest.classList.add('active'));
  }
  document.getElementById('btn-close-request-modal').addEventListener('click', () => modalPostRequest.classList.remove('active'));
  document.getElementById('form-post-request').addEventListener('submit', handlePostRequest);

  // Simulator preset location clicks
  document.querySelectorAll('.preset-sim-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const lat = parseFloat(e.currentTarget.dataset.lat);
      const lon = parseFloat(e.currentTarget.dataset.lon);
      const name = e.currentTarget.dataset.name;
      state.coords.lat = lat;
      state.coords.lon = lon;
      state.coords.name = name;
      updateLocationUI();
      modalSimulator.classList.remove('active');
      showToast('Simulator Location Set', `Switched location to: ${name}`, 'info');
      // Trigger immediate refresh
      fetchDashboardData();
    });
  });

  // Manual simulator apply
  document.getElementById('btn-apply-manual-sim').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('sim-lat').value);
    const lon = parseFloat(document.getElementById('sim-lon').value);
    state.coords.lat = lat;
    state.coords.lon = lon;
    state.coords.name = `Simulated (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    updateLocationUI();
    modalSimulator.classList.remove('active');
    showToast('Simulator Coordinates Set', `Updated current coordinates manually.`, 'info');
    fetchDashboardData();
  });
}

// Check if user is authenticated and navigate to dashboard
function checkAuth() {
  if (state.token && state.user) {
    userDisplay.textContent = `${state.user.name} (${state.user.role.toUpperCase()})`;
    userDisplay.style.display = 'block';
    btnLogout.style.display = 'inline-flex';
    simStatusContainer.style.display = 'flex';
    screenAuth.classList.remove('active');
    
    updateLocationUI();

    if (state.user.role === 'donor') {
      screenDonor.classList.add('active');
      screenReceiver.classList.remove('active');
      document.getElementById('donor-welcome').textContent = `Hello, ${state.user.name}`;
    } else {
      screenReceiver.classList.add('active');
      screenDonor.classList.remove('active');
      document.getElementById('receiver-welcome').textContent = `Hello, ${state.user.name}`;
    }

    fetchDashboardData();
    // Start Polling
    startPolling();
  } else {
    userDisplay.style.display = 'none';
    btnLogout.style.display = 'none';
    simStatusContainer.style.display = 'none';
    screenAuth.classList.add('active');
    screenDonor.classList.remove('active');
    screenReceiver.classList.remove('active');
    stopPolling();
  }
}

// Polling interval
function startPolling() {
  stopPolling();
  // Poll every 5 seconds for updates
  state.pollingInterval = setInterval(fetchDashboardData, 5000);
}

function stopPolling() {
  if (state.pollingInterval) {
    clearInterval(state.pollingInterval);
    state.pollingInterval = null;
  }
}

// Fetch all necessary data for current active dashboard
async function fetchDashboardData() {
  if (!state.token || !state.user) return;

  try {
    if (state.user.role === 'donor') {
      // 1. Fetch donor's own donations history
      const resHistory = await fetch(`${API_BASE}/api/donations/donor`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      const donations = await resHistory.json();
      renderDonorFeeds(donations);

      // 2. Fetch nearby emergency requests
      const resReqs = await fetch(`${API_BASE}/api/requests/donor?lat=${state.coords.lat}&lon=${state.coords.lon}`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      const requests = await resReqs.json();
      renderDonorRequests(requests);

      // 3. Update Donor Stats
      updateDonorStats(donations, requests);
    } else {
      // 1. Fetch available donations
      const resAvail = await fetch(`${API_BASE}/api/donations/receiver?lat=${state.coords.lat}&lon=${state.coords.lon}`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      const available = await resAvail.json();
      renderReceiverAvailable(available);

      // 2. Fetch accepted collections
      const resAccepted = await fetch(`${API_BASE}/api/donations/receiver/accepted`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      const accepted = await resAccepted.json();
      renderReceiverPending(accepted);

      // 3. Fetch requests history
      const resReqHistory = await fetch(`${API_BASE}/api/requests/receiver`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      const reqHistory = await resReqHistory.json();
      renderReceiverRequestHistory(reqHistory);

      // 4. Update Receiver Stats
      updateReceiverStats(available, accepted, reqHistory);
    }
  } catch (err) {
    console.error('Error polling dashboard data:', err);
  }
}

// Calculate and render Donor statistics
function updateDonorStats(donations, requests) {
  const activePosts = donations.filter(d => d.status !== 'Collected').length;
  const foodSaved = donations
    .filter(d => d.status === 'Collected')
    .reduce((sum, d) => sum + parseInt(d.quantity || 0), 0);
  const emergencies = requests.length;

  document.getElementById('stat-donor-active').textContent = activePosts;
  document.getElementById('stat-donor-saved').textContent = foodSaved;
  document.getElementById('stat-donor-emergencies').textContent = emergencies;
}

// Calculate and render Receiver statistics
function updateReceiverStats(available, accepted, reqHistory) {
  const avCount = available.length;
  const pendingCount = accepted.filter(d => d.status === 'Accepted').length;
  const myOpenReqs = reqHistory.filter(r => r.status === 'Open').length;

  document.getElementById('stat-rec-available').textContent = avCount;
  document.getElementById('stat-rec-pending').textContent = pendingCount;
  document.getElementById('stat-rec-requests').textContent = myOpenReqs;
}

// Render Donor's active donations and history log
function renderDonorFeeds(donations) {
  const activeFeed = document.getElementById('donor-active-feed');
  const historyTbody = document.getElementById('donor-history-tbody');
  
  activeFeed.innerHTML = '';
  historyTbody.innerHTML = '';

  const activeItems = donations.filter(d => d.status !== 'Collected');
  const historyItems = donations.filter(d => d.status === 'Collected');

  if (activeItems.length === 0) {
    activeFeed.innerHTML = `<div class="empty-state">No active food surplus posts. Post one now!</div>`;
  } else {
    activeItems.forEach(d => {
      const card = document.createElement('div');
      card.className = 'feed-card';
      
      const badgeClass = d.status === 'Accepted' ? 'badge-accepted' : 'badge-waiting';
      const foodBadgeClass = d.foodType === 'Veg' ? 'badge-veg' : 'badge-nonveg';

      card.innerHTML = `
        <div class="feed-card-header">
          <h4 class="feed-card-title">${escapeHTML(d.foodName)}</h4>
          <span class="badge ${badgeClass}">${d.status}</span>
        </div>
        <div class="feed-card-body">
          <span class="badge ${foodBadgeClass}">${d.foodType}</span>
          <div class="feed-meta-item" style="margin-top: 0.8rem;">
            <strong>Serves:</strong> ${d.quantity} people
          </div>
          <div class="feed-meta-item">
            <strong>Address:</strong> ${escapeHTML(d.pickupAddress)}
          </div>
          ${d.notes ? `<div class="feed-meta-item"><strong>Notes:</strong> ${escapeHTML(d.notes)}</div>` : ''}
          <div class="radius-expander-tag">
            Current Match Radius: <strong>${d.radius} km</strong>
          </div>
          ${d.receiverName ? `
            <div style="margin-top: 0.8rem; padding: 0.5rem; background: rgba(59, 130, 246, 0.1); border-radius: var(--radius-sm); font-size: 0.8rem; border: 1px dashed rgba(59,130,246,0.3);">
              Accepted by: <strong>${escapeHTML(d.receiverName)}</strong>
            </div>
          ` : ''}
        </div>
        <div style="margin-top: auto; display: flex; gap: 0.5rem;">
          ${d.status === 'Accepted' ? `
            <button class="btn btn-primary" onclick="markCollected('${d.id}')" style="width: 100%; font-size: 0.8rem; padding: 0.4rem 0.8rem;">
              Confirm Collection Handover
            </button>
          ` : `
            <div style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; width: 100%;">
              Waiting for nearby NGOs/orphanages to accept...
            </div>
          `}
        </div>
      `;
      activeFeed.appendChild(card);
    });
  }

  if (historyItems.length === 0) {
    historyTbody.innerHTML = `<tr><td colspan="6" class="empty-state">No donations completed yet.</td></tr>`;
  } else {
    historyItems.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHTML(d.foodName)}</strong></td>
        <td>${d.quantity}</td>
        <td><span class="badge ${d.foodType === 'Veg' ? 'badge-veg' : 'badge-nonveg'}">${d.foodType}</span></td>
        <td>${new Date(d.createdAt).toLocaleDateString()}</td>
        <td>${escapeHTML(d.receiverName || 'N/A')}</td>
        <td><span class="badge badge-collected">Collected</span></td>
      `;
      historyTbody.appendChild(tr);
    });
  }
}

// Render emergency requests visible to the donor
function renderDonorRequests(requests) {
  const requestsFeed = document.getElementById('donor-requests-feed');
  requestsFeed.innerHTML = '';

  if (requests.length === 0) {
    requestsFeed.innerHTML = `<div class="empty-state">No nearby emergency requests from NGOs/Orphanages.</div>`;
    return;
  }

  requests.forEach(r => {
    // Notify donor of a new critical/urgent emergency request if unseen
    if (!state.seenRequests.has(r.id)) {
      state.seenRequests.add(r.id);
      if (r.urgency === 'Critical' || r.urgency === 'Urgent') {
        showToast(`🚨 ${r.urgency} Request Nearby`, `${r.receiverName} needs food for ${r.peopleCount} people.`, 'warning');
      }
    }

    const card = document.createElement('div');
    card.className = 'feed-card';
    card.style.borderColor = r.urgency === 'Critical' ? 'var(--accent-rose)' : (r.urgency === 'Urgent' ? 'var(--accent-amber)' : 'var(--border-color)');

    card.innerHTML = `
      <div class="feed-card-header">
        <h4 class="feed-card-title">${escapeHTML(r.receiverName)}</h4>
        <span class="badge badge-urgency-${r.urgency.toLowerCase()}">${r.urgency}</span>
      </div>
      <div class="feed-card-body">
        <div class="feed-meta-item">
          <strong>Servings Needed:</strong> ${r.peopleCount} people
        </div>
        <div class="feed-meta-item">
          <strong>Location:</strong> ${escapeHTML(r.address)}
        </div>
        ${r.reason ? `<div class="feed-meta-item"><strong>Reason:</strong> ${escapeHTML(r.reason)}</div>` : ''}
        <div class="distance-tag">
          📍 ${r.distance} km away
        </div>
      </div>
      <div style="margin-top: auto;">
        <button class="btn btn-primary" onclick="fulfillRequest('${r.id}')" style="width: 100%; font-size: 0.8rem; padding: 0.4rem 0.8rem; background: var(--accent-amber);">
          Commit to Fulfill Need
        </button>
      </div>
    `;
    requestsFeed.appendChild(card);
  });
}

// Render available donations for receivers
function renderReceiverAvailable(donations) {
  const feed = document.getElementById('receiver-available-feed');
  feed.innerHTML = '';

  if (donations.length === 0) {
    feed.innerHTML = `<div class="empty-state">No matching donations found within your area yet.</div>`;
    return;
  }

  donations.forEach(d => {
    // Notify receiver of new surplus food nearby if unseen
    if (!state.seenDonations.has(d.id)) {
      state.seenDonations.add(d.id);
      showToast(`🍲 Food Surplus Nearby!`, `${d.donorName} posted "${d.foodName}" (serves ${d.quantity}) just ${d.distance} km away!`, 'info');
    }

    const card = document.createElement('div');
    card.className = 'feed-card';

    card.innerHTML = `
      <div class="feed-card-header">
        <h4 class="feed-card-title">${escapeHTML(d.foodName)}</h4>
        <span class="badge ${d.foodType === 'Veg' ? 'badge-veg' : 'badge-nonveg'}">${d.foodType}</span>
      </div>
      <div class="feed-card-body">
        <div class="feed-meta-item">
          <strong>Donor:</strong> ${escapeHTML(d.donorName)}
        </div>
        <div class="feed-meta-item">
          <strong>Serves:</strong> ${d.quantity} people
        </div>
        <div class="feed-meta-item">
          <strong>Pickup Address:</strong> ${escapeHTML(d.pickupAddress)}
        </div>
        ${d.notes ? `<div class="feed-meta-item"><strong>Notes:</strong> ${escapeHTML(d.notes)}</div>` : ''}
        
        <div class="distance-tag">
          📍 ${d.distance} km away
        </div>
      </div>
      <div style="margin-top: auto;">
        <button class="btn btn-primary" onclick="acceptDonation('${d.id}')" style="width: 100%; font-size: 0.85rem; padding: 0.5rem;">
          Accept Donation (Lock Pickup)
        </button>
      </div>
    `;
    feed.appendChild(card);
  });
}

// Render receiver's accepted pending collections
function renderReceiverPending(donations) {
  const feed = document.getElementById('receiver-pending-feed');
  feed.innerHTML = '';

  const pendingItems = donations.filter(d => d.status === 'Accepted');

  if (pendingItems.length === 0) {
    feed.innerHTML = `<div class="empty-state">No pending pickups. Accept available donations on the left!</div>`;
    return;
  }

  pendingItems.forEach(d => {
    const card = document.createElement('div');
    card.className = 'feed-card';

    card.innerHTML = `
      <div class="feed-card-header">
        <h4 class="feed-card-title">${escapeHTML(d.foodName)}</h4>
        <span class="badge badge-accepted">Accepted</span>
      </div>
      <div class="feed-card-body">
        <div class="feed-meta-item">
          <strong>Donor:</strong> ${escapeHTML(d.donorName)}
        </div>
        <div class="feed-meta-item">
          <strong>Serves:</strong> ${d.quantity} people
        </div>
        <div class="feed-meta-item">
          <strong>Pickup Address:</strong> ${escapeHTML(d.pickupAddress)}
        </div>
        ${d.notes ? `<div class="feed-meta-item"><strong>Notes:</strong> ${escapeHTML(d.notes)}</div>` : ''}
      </div>
      <div style="margin-top: auto; font-size: 0.8rem; text-align: center; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 0.5rem; border-radius: var(--radius-sm);">
        Please pick up from the donor. The donor will mark complete once collected.
      </div>
    `;
    feed.appendChild(card);
  });
}

// Render receiver's request history table
function renderReceiverRequestHistory(requests) {
  const tbody = document.getElementById('receiver-requests-tbody');
  tbody.innerHTML = '';

  if (requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No emergency requests posted.</td></tr>`;
    return;
  }

  requests.forEach(r => {
    const tr = document.createElement('tr');
    
    const badgeClass = r.status === 'Fulfilled' ? 'badge-fulfilled' : 'badge-waiting';
    const urgencyClass = `badge-urgency-${r.urgency.toLowerCase()}`;

    tr.innerHTML = `
      <td><strong>Servings for ${r.peopleCount}</strong></td>
      <td><span class="badge ${urgencyClass}">${r.urgency}</span></td>
      <td>${escapeHTML(r.reason || 'None provided')}</td>
      <td>${new Date(r.createdAt).toLocaleDateString()}</td>
      <td>${r.donorName ? escapeHTML(r.donorName) : '<span style="color: var(--text-secondary);">Waiting for Donor...</span>'}</td>
      <td><span class="badge ${badgeClass}">${r.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('auth-error');

  errorDiv.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (res.ok) {
      state.token = data.token;
      state.user = data.user;
      
      // Inherit user coordinates if saved on database
      if (data.user.lat && data.user.lon) {
        state.coords.lat = data.user.lat;
        state.coords.lon = data.user.lon;
        state.coords.name = 'Profile Saved Coordinates';
      }

      localStorage.setItem('zh_token', state.token);
      localStorage.setItem('zh_user', JSON.stringify(state.user));
      
      checkAuth();
      showToast('Welcome!', `Logged in successfully as ${state.user.name}`, 'info');
    } else {
      errorDiv.textContent = data.error || 'Login failed';
      errorDiv.style.display = 'block';
    }
  } catch (err) {
    errorDiv.textContent = 'Server connection failed';
    errorDiv.style.display = 'block';
  }
}

// Handle register form submission
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;
  const address = document.getElementById('reg-address').value;
  const lat = parseFloat(document.getElementById('reg-lat').value);
  const lon = parseFloat(document.getElementById('reg-lon').value);
  const errorDiv = document.getElementById('auth-error');

  errorDiv.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, address, lat, lon })
    });

    const data = await res.json();
    if (res.ok) {
      state.token = data.token;
      state.user = data.user;
      
      state.coords.lat = data.user.lat;
      state.coords.lon = data.user.lon;
      state.coords.name = 'Profile Saved Coordinates';

      localStorage.setItem('zh_token', state.token);
      localStorage.setItem('zh_user', JSON.stringify(state.user));

      checkAuth();
      showToast('Welcome!', `Registered successfully as ${state.user.name}`, 'info');
    } else {
      errorDiv.textContent = data.error || 'Registration failed';
      errorDiv.style.display = 'block';
    }
  } catch (err) {
    errorDiv.textContent = 'Server connection failed';
    errorDiv.style.display = 'block';
  }
}

// Log out user
function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('zh_token');
  localStorage.removeItem('zh_user');
  localStorage.removeItem('zh_location_name');
  
  // Clear forms
  document.getElementById('form-login').reset();
  document.getElementById('form-register').reset();
  
  checkAuth();
  showToast('Logged Out', 'You have logged out safely.', 'info');
}

// Handle Post Donation Form Submission (Donor)
async function handlePostDonation(e) {
  e.preventDefault();
  const foodName = document.getElementById('post-food-name').value;
  const quantity = document.getElementById('post-quantity').value;
  const foodType = document.getElementById('post-food-type').value;
  const pickupAddress = document.getElementById('post-pickup-address').value;
  const notes = document.getElementById('post-notes').value;

  try {
    const res = await fetch(`${API_BASE}/api/donations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        foodName,
        quantity,
        foodType,
        pickupAddress,
        notes,
        lat: state.coords.lat,
        lon: state.coords.lon
      })
    });

    const data = await res.json();
    if (res.ok) {
      modalPostDonation.classList.remove('active');
      document.getElementById('form-post-donation').reset();
      showToast('Donation Posted', 'Surplus food has been registered. Radius starts at 5km.', 'info');
      fetchDashboardData();
    } else {
      showToast('Error', data.error || 'Could not post donation', 'danger');
    }
  } catch (err) {
    showToast('Error', 'Connection failed', 'danger');
  }
}

// Handle Post Emergency Request (Receiver)
async function handlePostRequest(e) {
  e.preventDefault();
  const peopleCount = document.getElementById('req-people-count').value;
  const urgency = document.getElementById('req-urgency').value;
  const address = document.getElementById('req-address').value;
  const reason = document.getElementById('req-reason').value;

  try {
    const res = await fetch(`${API_BASE}/api/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        peopleCount,
        urgency,
        address,
        reason,
        lat: state.coords.lat,
        lon: state.coords.lon
      })
    });

    const data = await res.json();
    if (res.ok) {
      modalPostRequest.classList.remove('active');
      document.getElementById('form-post-request').reset();
      showToast('Need Posted', 'Emergency relief request published to nearby donors.', 'info');
      fetchDashboardData();
    } else {
      showToast('Error', data.error || 'Could not post request', 'danger');
    }
  } catch (err) {
    showToast('Error', 'Connection failed', 'danger');
  }
}

// Accept donation (Receiver action)
async function acceptDonation(id) {
  try {
    const res = await fetch(`${API_BASE}/api/donations/${id}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Success!', 'You have secured this food collection. Please arrange transit.', 'info');
      fetchDashboardData();
    } else {
      showToast('Already Claimed', data.error || 'Failed to claim donation.', 'danger');
      fetchDashboardData(); // Refresh list to reflect latest state
    }
  } catch (err) {
    showToast('Error', 'Connection error', 'danger');
  }
}

// Confirm handover (Donor action)
async function markCollected(id) {
  try {
    const res = await fetch(`${API_BASE}/api/donations/${id}/collect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Completed', 'Donation successfully marked as Collected!', 'info');
      fetchDashboardData();
    } else {
      showToast('Error', data.error || 'Failed to mark complete.', 'danger');
    }
  } catch (err) {
    showToast('Error', 'Connection error', 'danger');
  }
}

// Fulfill emergency request (Donor action)
async function fulfillRequest(id) {
  try {
    const res = await fetch(`${API_BASE}/api/requests/${id}/fulfill`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Fulfillment Committed', 'You committed to supply this receiver. Thank you!', 'info');
      fetchDashboardData();
    } else {
      showToast('Error', data.error || 'Failed to fulfill.', 'danger');
    }
  } catch (err) {
    showToast('Error', 'Connection error', 'danger');
  }
}

// Custom Toast system
function showToast(title, desc, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${escapeHTML(title)}</div>
      <div class="toast-desc">${escapeHTML(desc)}</div>
    </div>
    <button class="toast-close">&times;</button>
  `;
  
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });
  
  toastContainer.appendChild(toast);
  
  // Auto-remove after 6 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 6000);
}

// Helper to escape HTML characters
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
