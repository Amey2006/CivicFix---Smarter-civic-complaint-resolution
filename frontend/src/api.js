import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cf_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('cf_token')) {
      localStorage.removeItem('cf_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export const errorMessage = (err) => {
  const detail = err?.response?.data?.detail
  if (Array.isArray(detail)) return detail.map((d) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(', ')
  return detail || err?.message || 'Something went wrong'
}

export default api
