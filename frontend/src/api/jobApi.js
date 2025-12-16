import apiClient from "./apiClient";

const getMyJobs = () => apiClient.get("/jobs/my-jobs");
const createJob = (data) => apiClient.post("/jobs", data);
const updateJob = (jobId, data) => apiClient.patch(`/jobs/${jobId}`, data);
const getActiveJobs = () => apiClient.get("/jobs/active");
const applyToJob = (jobId, data) => apiClient.post(`/jobs/${jobId}/apply`, data);
const pushTop = (jobId) => apiClient.post(`/jobs/${jobId}/push-top`);
const closeJob = (jobId) => apiClient.patch(`/jobs/${jobId}/close`);
const reopenJob = (jobId) => apiClient.patch(`/jobs/${jobId}/reopen`);
const deleteJob = (jobId) => apiClient.delete(`/jobs/${jobId}`);
const getPushTopDashboard = () => apiClient.get("/jobs/push-top-dashboard");

export const jobApi = {
  getMyJobs,
  createJob,
  updateJob,
  getActiveJobs,
  applyToJob,
  pushTop,
  closeJob,
  reopenJob,
  deleteJob,
  getPushTopDashboard,
};