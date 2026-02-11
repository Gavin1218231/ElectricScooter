const BASE_URL = '/api';
const TOKEN_KEY = 'vim_auth_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.message || errorData.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

const api = {
  auth: {
    register(data) {
      return request('POST', '/auth/register', data);
    },
    login(data) {
      return request('POST', '/auth/login', data);
    },
    me() {
      return request('GET', '/auth/me');
    },
    update(data) {
      return request('PUT', '/auth/me', data);
    },
  },

  scooters: {
    list(params = {}) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query.append(key, value);
        }
      });
      const queryString = query.toString();
      return request('GET', `/scooters${queryString ? `?${queryString}` : ''}`);
    },
    getById(id) {
      return request('GET', `/scooters/${id}`);
    },
    getByCode(code) {
      return request('GET', `/scooters/code/${code}`);
    },
  },

  rentals: {
    start(scooterId) {
      return request('POST', '/rentals/start', { scooter_id: scooterId });
    },
    end(id, data) {
      return request('POST', `/rentals/${id}/end`, data);
    },
    active() {
      return request('GET', '/rentals/active');
    },
    history() {
      return request('GET', '/rentals/history');
    },
    getById(id) {
      return request('GET', `/rentals/${id}`);
    },
  },

  payments: {
    topup(amount) {
      return request('POST', '/payments/topup', { amount });
    },
    history() {
      return request('GET', '/payments/history');
    },
    balance() {
      return request('GET', '/payments/balance');
    },
  },
};

export default api;
