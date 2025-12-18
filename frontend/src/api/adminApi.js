import apiClient from "./apiClient";

const getCandidates = () => {
  return apiClient.get("/admin/users/candidates");
};

const getEmployers = () => {
  return apiClient.get("/admin/users/employers");
};

const deleteUser = (uid) => {
  return apiClient.delete(`/admin/users/${uid}`);
};

const toggleBanUser = (uid, isBanned) => {
  return apiClient.put(`/admin/users/${uid}/ban`, { isBanned });
};

const getSystemAdmins = () => {
  return apiClient.get("/admin/system-admins");
};

const createSystemAdmin = (data) => {
  return apiClient.post("/admin/system-admins", data);
};

const getUsersNoRole = () => {
  return apiClient.get("/admin/users/no-role");
};

const getUserSubscriptions = (uid) => {
  return apiClient.get(`/admin/users/${uid}/subscriptions`);
};

const getPendingJobs = () => {
  return apiClient.get("/admin/jobs/pending");
};

const getJobDetail = (jobId) => {
  return apiClient.get(`/admin/jobs/${jobId}`);
};

const approveJob = (jobId) => {
  return apiClient.patch(`/admin/jobs/${jobId}/approve`);
};

const rejectJob = (jobId, data) => {
  return apiClient.patch(`/admin/jobs/${jobId}/reject`, data);
};

const getActiveJobs = () => {
  return apiClient.get("/admin/jobs/active");
};

const getRevenueReport = (params = {}) => {
  return apiClient.get("/admin/reports/revenue", { params });
};

const getNewUsersReport = (params = {}) => {
  return apiClient.get("/admin/reports/new-users", { params });
};

const getNewPostsReport = (params = {}) => {
  return apiClient.get("/admin/reports/new-posts", { params });
};

export const adminApi = {
  getCandidates,
  getEmployers,
  deleteUser,
  toggleBanUser,
  getSystemAdmins,
  createSystemAdmin,
  getUsersNoRole,
  getUserSubscriptions,
  getPendingJobs,
  getJobDetail,
  approveJob,
  rejectJob,
  getActiveJobs,
  getRevenueReport,
  getNewUsersReport,
  getNewPostsReport,
};