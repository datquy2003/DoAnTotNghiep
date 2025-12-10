import apiClient from "./apiClient";

const createCheckoutSession = (planId, returnUrl, metadata) => {
  const payload = { planId };
  if (returnUrl) payload.returnUrl = returnUrl;
  if (metadata) payload.metadata = metadata;
  return apiClient.post("/payment/create-checkout-session", payload);
};

const verifyPayment = (sessionId, planId) => {
  return apiClient.post("/payment/verify-payment", { sessionId, planId });
};

export const paymentApi = {
  createCheckoutSession,
  verifyPayment,
};