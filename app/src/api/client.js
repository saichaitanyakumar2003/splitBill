import ENV from '../config/env';

const API_BASE_URL = ENV.API_BASE_URL;

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // OCR endpoints
  async scanBill(imageUri) {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'bill.jpg',
    });

    const response = await fetch(`${API_BASE_URL}/ocr/scan`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to scan bill');
    }

    return response.json();
  }

  // Bills endpoints
  async createBill(billData) {
    return this.request('/bills', {
      method: 'POST',
      body: JSON.stringify(billData),
    });
  }

  async getBills(groupId = null) {
    const query = groupId ? `?groupId=${groupId}` : '';
    return this.request(`/bills${query}`);
  }

  async getBill(id) {
    return this.request(`/bills/${id}`);
  }

  async updateBill(id, updates) {
    return this.request(`/bills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async assignItems(billId, assignments) {
    return this.request(`/bills/${billId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignments }),
    });
  }

  async getSplit(billId, splitTaxTip = 'proportional') {
    return this.request(`/bills/${billId}/split?splitTaxTip=${splitTaxTip}`);
  }

  // Groups endpoints
  async createGroup(groupData) {
    return this.request('/groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  }

  async getGroups() {
    return this.request('/groups');
  }

  async getGroup(id) {
    return this.request(`/groups/${id}`);
  }

  async addMembers(groupId, members) {
    return this.request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ members }),
    });
  }

  async removeMember(groupId, memberId) {
    return this.request(`/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async joinGroup(inviteCode, member) {
    return this.request('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode, member }),
    });
  }
}

export const api = new ApiClient();

