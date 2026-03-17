import axios from 'axios'

export interface Run {
  id: string
  created_at: string
  scenario: 'smoke' | 'regression' | 'stress'
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  rounds: number
  current_round: number
  read_ratio: number
  inject_defect: boolean
  apply_fix: boolean
  total_ops: number | null
  fail_ops: number | null
  duration_ms: number | null
  validation_passed: boolean | null
}

export interface TrendPoint {
  id: string
  created_at: string
  scenario: string
  validation_passed: boolean | null
  duration_s: number | null
  fail_ops: number | null
  total_ops: number | null
}

export interface ThroughputBucket {
  t: number
  ops_per_sec: number
  fail_per_sec: number
}

export interface RunLog {
  id: number
  run_id: string
  ts: string
  level: string
  message: string
}

export interface PerfMetrics {
  p50_ms: number
  p95_ms: number
  avg_ms: number
}

export interface RunMetrics {
  before: PerfMetrics | null
  after: PerfMetrics | null
}

export interface RunValidation {
  id: number
  run_id: string
  test_name: string
  result_value: number
  passed: boolean
}

export interface Schedule {
  id: number
  name: string
  cron_expression: string
  scenario: string
  inject_defect: boolean
  read_ratio: number
  enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
}

export interface CompareResult {
  run_a: Run
  run_b: Run
  metrics_a: RunMetrics
  metrics_b: RunMetrics
  validations_a: RunValidation[]
  validations_b: RunValidation[]
}

export interface HealthStatus {
  status: string
  db2: string
  host: string
  port: number
}

const api = axios.create({ baseURL: '/api' })

export const getHealth = () => api.get<HealthStatus>('/health').then(r => r.data)

export const createRun = (data: {
  scenario: string
  inject_defect: boolean
  apply_fix: boolean
  read_ratio: number
  round_delay_ms: number
}) => api.post<{ id: string; status: string }>('/runs/', data).then(r => r.data)

export const getRuns = (params?: {
  skip?: number
  limit?: number
  status?: string
  scenario?: string
}) => api.get<Run[]>('/runs/', { params }).then(r => r.data)

export const getRun = (id: string) => api.get<Run>(`/runs/${id}`).then(r => r.data)
export const cancelRun = (id: string) => api.post(`/runs/${id}/cancel`).then(r => r.data)
export const deleteRun = (id: string) => api.delete(`/runs/${id}`).then(r => r.data)
export const deleteAllRuns = () => api.delete('/runs/').then(r => r.data)

export interface RunOperation {
  id: number
  op_index: number
  type: 'READ' | 'WRITE'
  query_name: string
  sql_text: string
  elapsed_ms: number
  status: 'OK' | 'FAIL'
  error: string
  ts_utc: string
}

export interface OpSummary {
  query_name: string
  type: string
  count: number
  avg_ms: number
  min_ms: number
  max_ms: number
  fail_count: number
}

export const getRunOperations = (
  id: string,
  params?: { skip?: number; limit?: number; type?: string; status?: string }
) => api.get<RunOperation[]>(`/runs/${id}/operations`, { params }).then(r => r.data)

export const getRunOperationsSummary = (id: string) =>
  api.get<OpSummary[]>(`/runs/${id}/operations/summary`).then(r => r.data)

export const getRunLogs = (id: string, params?: { skip?: number; limit?: number }) =>
  api.get<RunLog[]>(`/runs/${id}/logs`, { params }).then(r => r.data)

export const getRunMetrics = (id: string) =>
  api.get<RunMetrics>(`/runs/${id}/metrics`).then(r => r.data)

export const getRunValidations = (id: string) =>
  api.get<RunValidation[]>(`/runs/${id}/validations`).then(r => r.data)

export const compareRuns = (a: string, b: string) =>
  api.get<CompareResult>('/runs/compare', { params: { a, b } }).then(r => r.data)

export const exportRunUrl = (id: string, format: 'csv' | 'pdf') =>
  `/api/runs/${id}/export?format=${format}`

export const getSchedules = () => api.get<Schedule[]>('/schedules/').then(r => r.data)

export const createSchedule = (data: {
  name: string
  cron_expression: string
  scenario: string
  inject_defect: boolean
  read_ratio: number
}) => api.post<Schedule>('/schedules/', data).then(r => r.data)

export const updateSchedule = (id: number, data: Partial<Schedule>) =>
  api.patch<Schedule>(`/schedules/${id}`, data).then(r => r.data)

export const deleteSchedule = (id: number) => api.delete(`/schedules/${id}`)
export const runScheduleNow = (id: number) => api.post<{ id: string; status: string }>(`/schedules/${id}/run`).then(r => r.data)

export const getRunTrend = (params?: { limit?: number; scenario?: string }) =>
  api.get<TrendPoint[]>('/runs/trend', { params }).then(r => r.data)

export const getRunThroughput = (id: string, bucketSeconds = 10) =>
  api.get<ThroughputBucket[]>(`/runs/${id}/throughput`, { params: { bucket_seconds: bucketSeconds } }).then(r => r.data)
