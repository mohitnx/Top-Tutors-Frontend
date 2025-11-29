import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage if it exists
    const token = localStorage.getItem('auth_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error: AxiosError) => {
    // Handle common errors
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Handle unauthorized - clear token and redirect to login
          localStorage.removeItem('auth_token')
          window.location.href = '/login'
          break
        case 403:
          console.error('Access forbidden')
          break
        case 404:
          console.error('Resource not found')
          break
        case 500:
          console.error('Internal server error')
          break
        default:
          console.error('An error occurred:', error.message)
      }
    } else if (error.request) {
      console.error('Network error - no response received')
    }
    return Promise.reject(error)
  }
)

export default apiClient

// Generic API methods
export const api = {
  get: <T>(url: string, params?: object) => 
    apiClient.get<T>(url, { params }),
  
  post: <T>(url: string, data?: object) => 
    apiClient.post<T>(url, data),
  
  put: <T>(url: string, data?: object) => 
    apiClient.put<T>(url, data),
  
  patch: <T>(url: string, data?: object) => 
    apiClient.patch<T>(url, data),
  
  delete: <T>(url: string) => 
    apiClient.delete<T>(url),
}

