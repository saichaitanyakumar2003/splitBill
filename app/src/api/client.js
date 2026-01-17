import ENV from '../config/env';
import { getAuthToken } from '../utils/apiHelper';
import { scanBillWithGemini } from '../utils/geminiOCR';

const API_BASE_URL = ENV.API_BASE_URL;

// Cache for OCR config (API key)
let ocrConfigCache = null;
let ocrConfigExpiry = 0;
const OCR_CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const authToken = getAuthToken();
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    // Add auth token if available
    if (authToken) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      console.log(`📡 API Request: ${options.method || 'GET'} ${endpoint}`);
      const response = await fetch(url, config);
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text.substring(0, 100));
        throw new Error('Server returned non-JSON response. Is the endpoint correct?');
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error.message);
      throw error;
    }
  }

  // Get OCR config (Gemini API key) from backend
  async getOcrConfig() {
    // Return cached config if still valid
    if (ocrConfigCache && Date.now() < ocrConfigExpiry) {
      return ocrConfigCache;
    }

    try {
      const response = await this.request('/config/ocr');
      if (response.success && response.data?.apiKey) {
        ocrConfigCache = response.data;
        ocrConfigExpiry = Date.now() + OCR_CONFIG_CACHE_DURATION;
        return response.data;
      }
      throw new Error(response.error || 'Failed to get OCR configuration');
    } catch (error) {
      // Check if it's an HTML response (server returned error page)
      if (error.message?.includes('<!DOCTYPE') || error.message?.includes('Unexpected token')) {
        console.error('❌ Server returned HTML instead of JSON. Is the backend updated?');
        throw new Error('OCR service unavailable. Please try again later.');
      }
      throw error;
    }
  }

  // OCR - Client-side processing with Gemini
  async scanBill(imageUri) {
    console.log('📸 scanBill called with image:', imageUri.substring(0, 50) + '...');
    
    try {
      // Step 1: Get API key from backend (cached)
      const isCached = ocrConfigCache && Date.now() < ocrConfigExpiry;
      console.log(`🔑 Getting OCR config... ${isCached ? '(from cache)' : '(from server)'}`);
      const config = await this.getOcrConfig();
      console.log('✅ Got API key for provider:', config.provider);
      
      // Step 2: Process image locally with Gemini
      console.log('📱 Starting client-side OCR processing...');
      const result = await scanBillWithGemini(imageUri, config.apiKey);
      
      console.log('🎉 Bill scan complete!');
      return result;
    } catch (error) {
      console.error('❌ Scan failed:', error.message);
      throw new Error(error.message || 'Failed to scan bill');
    }
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

