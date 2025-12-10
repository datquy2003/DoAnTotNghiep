import apiClient from "./apiClient";

const updateBaseProfile = (data) => {
  return apiClient.put("/users/me/base", data);
};

const getCandidateProfile = () => {
  return apiClient.get("/candidates/me");
};

const getPushTopRemaining = () => {
  return apiClient.get("/candidates/me/push-top/remaining");
};

const updateCandidateProfile = (data) => {
  return apiClient.put("/candidates/me", data);
};

const getCompanyProfile = () => {
  return apiClient.get("/companies/me");
};

const updateCompanyProfile = (data) => {
  return apiClient.put("/companies/me", data);
};

const geocodeAddress = (address) => {
  return apiClient.post("/utils/geocode", { address });
};

const searchSearchableCandidates = (params) => {
  return apiClient.get("/candidates/searchable", { params });
};

const revealCandidateContact = (candidateId, jobId) => {
  const payload = { candidateId };
  if (jobId) payload.jobId = jobId;
  return apiClient.post("/vip-features/employer/reveal-contact", payload);
};

const createOneTimeCheckout = (featureKey, candidateId) => {
  return apiClient.post("/payment/create-one-time-session", {
    featureKey,
    candidateId,
  });
};

export const profileApi = {
  updateBaseProfile,
  getCandidateProfile,
  getPushTopRemaining,
  updateCandidateProfile,
  getCompanyProfile,
  updateCompanyProfile,
  geocodeAddress,
  searchSearchableCandidates,
  revealCandidateContact,
  createOneTimeCheckout,
};