import apiClient from "./apiClient";

const getMyJobs = () => apiClient.get("/jobs/my-jobs");
const createJob = (data) => apiClient.post("/jobs", data);
const updateJob = (jobId, data) => apiClient.patch(`/jobs/${jobId}`, data);
const resubmitJob = (jobId, data) => apiClient.patch(`/jobs/${jobId}/resubmit`, data);
const getActiveJobs = () => apiClient.get("/jobs/active");
const applyToJob = (jobId, data) => apiClient.post(`/jobs/${jobId}/apply`, data);
const getJobApplicants = (jobId) => apiClient.get(`/jobs/${jobId}/applicants`);
const getAppliedJobs = () => apiClient.get("/jobs/applied");
const getSavedJobs = () => apiClient.get("/jobs/saved");
const saveJob = (jobId) => apiClient.post(`/jobs/${jobId}/save`, {});
const unsaveJob = (jobId) => apiClient.delete(`/jobs/${jobId}/save`);
const pushTop = (jobId) => apiClient.post(`/jobs/${jobId}/push-top`);
const closeJob = (jobId) => apiClient.patch(`/jobs/${jobId}/close`);
const reopenJob = (jobId) => apiClient.patch(`/jobs/${jobId}/reopen`);
const deleteJob = (jobId) => apiClient.delete(`/jobs/${jobId}`);
const getPushTopDashboard = () => apiClient.get("/jobs/push-top-dashboard");

export const jobApi = {
  getMyJobs,
  createJob,
  updateJob,
  resubmitJob,
  getActiveJobs,
  applyToJob,
  getJobApplicants,
  getAppliedJobs,
  getSavedJobs,
  saveJob,
  unsaveJob,
  pushTop,
  closeJob,
  reopenJob,
  deleteJob,
  getPushTopDashboard,
};