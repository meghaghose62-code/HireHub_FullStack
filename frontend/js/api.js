/**
 * HireHub - Frontend API Client
 * Handles all communication with the backend API at http://localhost:5000/api
 */

const API_BASE = '/api';

// ─── TOKEN MANAGEMENT ─────────────────────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('hirehub_token'),
  getUser: () => {
    const u = localStorage.getItem('hirehub_user');
    return u ? JSON.parse(u) : null;
  },
  setSession: (token, user) => {
    localStorage.setItem('hirehub_token', token);
    localStorage.setItem('hirehub_user', JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem('hirehub_token');
    localStorage.removeItem('hirehub_user');
  },
  isLoggedIn: () => !!localStorage.getItem('hirehub_token'),
  getRole: () => {
    const user = Auth.getUser();
    return user ? user.role : null;
  }
};

// ─── BASE FETCH WRAPPER ───────────────────────────────────────────────────────
async function apiRequest(endpoint, options = {}) {
  const token = Auth.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  // Handle FormData (file upload) — don't set Content-Type, browser sets it
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
      // Token expired or unauthorized — clear and redirect to login
      Auth.clearSession();
      if (window.location.pathname !== '/login.html') {
        window.location.href = '/login.html';
      }
    }

    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    console.error(`API error [${endpoint}]:`, err);
    return {
      ok: false,
      status: 0,
      data: { success: false, message: 'Network error. Is the server running on port 5000?' }
    };
  }
}

// ─── AUTH API ─────────────────────────────────────────────────────────────────
const AuthAPI = {
  register: (payload) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => apiRequest('/auth/me')
};

// ─── JOBS API ─────────────────────────────────────────────────────────────────
const JobsAPI = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/jobs${qs ? '?' + qs : ''}`);
  },
  getById: (id) => apiRequest(`/jobs/${id}`),
  post: (data) => apiRequest('/jobs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  approve: (id, status) => apiRequest(`/jobs/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete: (id) => apiRequest(`/jobs/${id}`, { method: 'DELETE' }),
  getPending: () => apiRequest('/jobs/admin/pending'),
  getMyJobs: () => apiRequest('/jobs/recruiter/mine')
};

// ─── APPLICATIONS API ─────────────────────────────────────────────────────────
const ApplicationsAPI = {
  apply: (data) => apiRequest('/applications', { method: 'POST', body: JSON.stringify(data) }),
  getMine: () => apiRequest('/applications/mine'),
  getByJob: (jobId) => apiRequest(`/applications/job/${jobId}`),
  getRecruiterMine: () => apiRequest('/applications/recruiter/mine'),
  getAll: () => apiRequest('/applications/all'),
  getById: (id) => apiRequest(`/applications/${id}`),
  updateStatus: (id, status) => apiRequest(`/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  downloadInvoice: async (id) => {
    const token = Auth.getToken();
    const res = await fetch(`${API_BASE}/applications/${id}/invoice`, {
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to download invoice' }));
      throw new Error(err.message || 'Invoice download failed');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HireHub_Invoice_APP_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }
};

// ─── INTERVIEWS API ───────────────────────────────────────────────────────────
const InterviewsAPI = {
  schedule: (data) => apiRequest('/interviews', { method: 'POST', body: JSON.stringify(data) }),
  getMine: () => apiRequest('/interviews/mine'),
  getRecruiterInterviews: () => apiRequest('/interviews/recruiter/mine'),
  getById: (id) => apiRequest(`/interviews/${id}`),
  update: (id, data) => apiRequest(`/interviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/interviews/${id}`, { method: 'DELETE' })
};

// ─── RESUMES API ──────────────────────────────────────────────────────────────
const ResumesAPI = {
  upload: (formData) => apiRequest('/resumes/upload', { method: 'POST', body: formData }),
  getMine: () => apiRequest('/resumes/mine'),
  delete: (id) => apiRequest(`/resumes/${id}`, { method: 'DELETE' })
};

// ─── NOTIFICATIONS API ────────────────────────────────────────────────────────
const NotificationsAPI = {
  getAll: () => apiRequest('/notifications'),
  markRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => apiRequest('/notifications/read-all', { method: 'PATCH' }),
  delete: (id) => apiRequest(`/notifications/${id}`, { method: 'DELETE' }),
  broadcast: (data) => apiRequest('/notifications/broadcast', { method: 'POST', body: JSON.stringify(data) })
};

// ─── REVIEWS API ──────────────────────────────────────────────────────────────
const ReviewsAPI = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/reviews${qs ? '?' + qs : ''}`);
  },
  post: (data) => apiRequest('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  getByCompany: (name) => apiRequest(`/reviews/company/${encodeURIComponent(name)}`),
  delete: (id) => apiRequest(`/reviews/${id}`, { method: 'DELETE' })
};

// ─── REPORTS API ──────────────────────────────────────────────────────────────
const ReportsAPI = {
  adminDashboard: () => apiRequest('/reports/dashboard'),
  recruiterStats: () => apiRequest('/reports/recruiter'),
  candidateStats: () => apiRequest('/reports/candidate'),
  applicationReport: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/reports/applications${qs ? '?' + qs : ''}`);
  },
  usersReport: () => apiRequest('/reports/users'),
  jobsReport: () => apiRequest('/reports/jobs')
};

// ─── USERS API ────────────────────────────────────────────────────────────────
const UsersAPI = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/users${qs ? '?' + qs : ''}`);
  },
  getById: (id) => apiRequest(`/users/${id}`),
  updateProfile: (data) => apiRequest('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
  toggleActive: (id) => apiRequest(`/users/${id}/toggle-active`, { method: 'PATCH' }),
  delete: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),
  saveJob: (jobId) => apiRequest(`/users/saved-jobs/${jobId}`, { method: 'POST' }),
  getSavedJobs: () => apiRequest('/users/saved-jobs')
};

// ─── UTILITY: Show toast notifications ───────────────────────────────────────
function showToast(message, type = 'success') {
  // Remove existing toasts
  document.querySelectorAll('.hirehub-toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'hirehub-toast';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 99999;
    padding: 14px 22px;
    border-radius: 10px;
    font-family: Poppins, sans-serif;
    font-size: 15px;
    font-weight: 600;
    box-shadow: 0 6px 20px rgba(0,0,0,0.2);
    animation: slideInRight 0.3s ease;
    max-width: 380px;
    background: ${type === 'success' ? '#0a66c2' : type === 'error' ? '#e53e3e' : '#f6ad55'};
    color: white;
  `;
  toast.textContent = message;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── UTILITY: Redirect if not logged in ──────────────────────────────────────
// role can be a string ('ADMIN') or an array (['RECRUITER', 'ADMIN'])
function requireAuth(role = null) {
  if (!Auth.isLoggedIn()) {
    window.location.href = '/login.html';
    return false;
  }
  if (role) {
    const userRole = Auth.getRole();
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(userRole)) {
      showToast('Access denied. Redirecting...', 'error');
      setTimeout(() => { window.location.href = '/login.html'; }, 1500);
      return false;
    }
  }
  return true;
}

// ─── UTILITY: Format date nicely ─────────────────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'
  });
}
