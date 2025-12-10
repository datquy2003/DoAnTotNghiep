import apiClient from "./apiClient";

const getCategories = () => {
  return apiClient.get("/categories");
};

const getAllSpecializations = () => {
  return apiClient.get("/categories/specializations-all");
};

const createCategory = (data) => {
  return apiClient.post("/categories", data);
};

const updateCategory = (id, data) => {
  return apiClient.put(`/categories/${id}`, data);
};

const deleteCategory = (id) => {
  return apiClient.delete(`/categories/${id}`);
};

const getSpecializations = (categoryId) => {
  return apiClient.get(`/categories/${categoryId}/specializations`);
};

const createSpecialization = (data) => {
  return apiClient.post("/categories/specializations", data);
};

const updateSpecialization = (id, data) => {
  return apiClient.put(`/categories/specializations/${id}`, data);
};

const deleteSpecialization = (id) => {
  return apiClient.delete(`/categories/specializations/${id}`);
};

export const categoryApi = {
  getCategories,
  getAllSpecializations,
  createCategory,
  updateCategory,
  deleteCategory,
  getSpecializations,
  createSpecialization,
  updateSpecialization,
  deleteSpecialization,
};