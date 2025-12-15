import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { JOB_TYPES } from "../../../constants/jobTypes";
import { EXPERIENCE_AMOUNT } from "../../../constants/experienceAmount";
import { EDUCATION_LEVEL } from "../../../constants/educationLevel";
import { DAY_OF_WEEK } from "../../../constants/dayOfWeek";
import { formatCurrency } from "../../../utils/formatCurrency";
import { renderJobPostRichText } from "../../../utils/jobPostRichText";

const getInitialJobState = () => ({
  JobTitle: "",
  CategoryID: "",
  SpecializationID: "",
  Location: "",
  JobType: "",
  SalaryMin: "",
  SalaryMax: "",
  Experience: "",
  EducationLevel: "",
  VacancyCount: "",
  WorkingTimes: [{ dayFrom: "", dayTo: "", timeFrom: "", timeTo: "" }],
  JobDescription: "",
  Requirements: "",
  Benefits: "",
  ExpiresAt: "",
});

export default function JobPostAddEditModal({
  open,
  categories,
  specializations,
  onClose,
  onCreate,
  onUpdate,
  mode = "create",
  initialJob = null,
}) {
  const [job, setJob] = useState(getInitialJobState);

  const [jdPreview, setJdPreview] = useState(false);
  const [reqPreview, setReqPreview] = useState(false);
  const [benPreview, setBenPreview] = useState(false);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [specOpen, setSpecOpen] = useState(false);
  const [jobTypeOpen, setJobTypeOpen] = useState(false);
  const [experienceOpen, setExperienceOpen] = useState(false);
  const [educationOpen, setEducationOpen] = useState(false);

  const [categorySearch, setCategorySearch] = useState("");
  const [specSearch, setSpecSearch] = useState("");
  const [jobTypeSearch, setJobTypeSearch] = useState("");
  const [experienceSearch, setExperienceSearch] = useState("");
  const [educationSearch, setEducationSearch] = useState("");

  const categoryRef = useRef(null);
  const specRef = useRef(null);
  const jobTypeRef = useRef(null);
  const experienceRef = useRef(null);
  const educationRef = useRef(null);

  const jobDescriptionRef = useRef(null);
  const requirementsRef = useRef(null);
  const benefitsRef = useRef(null);
  const expiresAtRef = useRef(null);
  const justSelectedDropdownRef = useRef(false);
  const markJustSelected = () => {
    justSelectedDropdownRef.current = true;
    setTimeout(() => {
      justSelectedDropdownRef.current = false;
    }, 0);
  };

  const safeShowDatePicker = (el) => {
    try {
      el?.showPicker?.();
    } catch (e) {}
  };

  useEffect(() => {
    if (!open) return;

    const toDateInputValue = (value) => {
      if (!value) return "";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    const parseWorkingTimes = (raw) => {
      if (!raw) return [];
      let wt = raw;
      if (typeof wt === "string") {
        try {
          wt = JSON.parse(wt);
        } catch (e) {
          wt = [];
        }
      }
      if (!Array.isArray(wt)) return [];
      return wt.map((x) => ({
        dayFrom: (x?.dayFrom || "").toString(),
        dayTo: (x?.dayTo || "").toString(),
        timeFrom: (x?.timeFrom || "").toString(),
        timeTo: (x?.timeTo || "").toString(),
      }));
    };

    if (mode === "edit" && initialJob) {
      const wt = parseWorkingTimes(initialJob.WorkingTimes);

      setJob({
        JobTitle: initialJob.JobTitle || "",
        CategoryID:
          initialJob.CategoryID != null ? String(initialJob.CategoryID) : "",
        SpecializationID:
          initialJob.SpecializationID != null
            ? String(initialJob.SpecializationID)
            : "",
        Location: initialJob.Location || "",
        JobType: initialJob.JobType || "",
        SalaryMin:
          initialJob.SalaryMin == null || Number(initialJob.SalaryMin) === 0
            ? ""
            : String(initialJob.SalaryMin),
        SalaryMax:
          initialJob.SalaryMax == null || Number(initialJob.SalaryMax) === 0
            ? ""
            : String(initialJob.SalaryMax),
        Experience: initialJob.Experience || "",
        EducationLevel: initialJob.EducationLevel || "",
        VacancyCount:
          initialJob.VacancyCount != null
            ? String(initialJob.VacancyCount)
            : "",
        WorkingTimes:
          wt.length > 0
            ? wt
            : [{ dayFrom: "", dayTo: "", timeFrom: "", timeTo: "" }],
        JobDescription: initialJob.JobDescription || "",
        Requirements: initialJob.Requirements || "",
        Benefits: initialJob.Benefits || "",
        ExpiresAt: toDateInputValue(initialJob.ExpiresAt),
      });

      const catName =
        (categories || []).find(
          (c) => String(c.CategoryID) === String(initialJob.CategoryID)
        )?.CategoryName || "";
      const specName =
        (specializations || []).find(
          (s) =>
            String(s.SpecializationID) === String(initialJob.SpecializationID)
        )?.SpecializationName || "";

      setCategorySearch(catName);
      setSpecSearch(specName);
      setJobTypeSearch(initialJob.JobType || "");
      setExperienceSearch(initialJob.Experience || "");
      setEducationSearch(initialJob.EducationLevel || "");
    } else {
      setJob(getInitialJobState());
      setCategorySearch("");
      setSpecSearch("");
      setJobTypeSearch("");
      setExperienceSearch("");
      setEducationSearch("");
    }

    setJdPreview(false);
    setReqPreview(false);
    setBenPreview(false);
    setCategoryOpen(false);
    setSpecOpen(false);
    setJobTypeOpen(false);
    setExperienceOpen(false);
    setEducationOpen(false);
  }, [open, mode, initialJob, categories, specializations]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target)) {
        setCategoryOpen(false);
      }
      if (specRef.current && !specRef.current.contains(e.target)) {
        setSpecOpen(false);
      }
      if (jobTypeRef.current && !jobTypeRef.current.contains(e.target)) {
        setJobTypeOpen(false);
      }
      if (experienceRef.current && !experienceRef.current.contains(e.target)) {
        setExperienceOpen(false);
      }
      if (educationRef.current && !educationRef.current.contains(e.target)) {
        setEducationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const sortByName = (list, key) =>
    [...list].sort((a, b) =>
      ((a?.[key] || "") + "")
        .trim()
        .localeCompare(((b?.[key] || "") + "").trim(), "vi", {
          sensitivity: "base",
        })
    );

  const sortedCategories = useMemo(
    () => sortByName(categories || [], "CategoryName"),
    [categories]
  );
  const sortedSpecializations = useMemo(
    () => sortByName(specializations || [], "SpecializationName"),
    [specializations]
  );

  const filteredCategories = useMemo(() => {
    const keyword = categorySearch.trim().toLowerCase();
    if (!keyword) return sortedCategories;
    return sortedCategories.filter((c) =>
      (c.CategoryName || "").toLowerCase().includes(keyword)
    );
  }, [sortedCategories, categorySearch]);

  const filteredSpecsGlobal = useMemo(() => {
    const keyword = specSearch.trim().toLowerCase();
    if (!keyword) return sortedSpecializations;
    return sortedSpecializations.filter((s) =>
      (s.SpecializationName || "").toLowerCase().includes(keyword)
    );
  }, [sortedSpecializations, specSearch]);

  const jobTypeList = useMemo(
    () =>
      Object.entries(JOB_TYPES)
        .filter(([key]) => key !== "ALL")
        .map(([key, value]) => ({ key, value })),
    []
  );
  const filteredJobTypes = useMemo(() => {
    const keyword = jobTypeSearch.trim().toLowerCase();
    if (!keyword) return jobTypeList;
    return jobTypeList.filter((t) =>
      (t.value || "").toLowerCase().includes(keyword)
    );
  }, [jobTypeList, jobTypeSearch]);

  const experienceList = useMemo(
    () =>
      Object.entries(EXPERIENCE_AMOUNT)
        .filter(([key]) => key !== "ALL")
        .map(([key, value]) => ({ key, value })),
    []
  );
  const filteredExperiences = useMemo(() => {
    const keyword = experienceSearch.trim().toLowerCase();
    if (!keyword) return experienceList;
    return experienceList.filter((e) =>
      (e.value || "").toLowerCase().includes(keyword)
    );
  }, [experienceList, experienceSearch]);

  const educationList = useMemo(
    () =>
      Object.entries(EDUCATION_LEVEL)
        .filter(([key]) => key !== "ALL")
        .map(([key, value]) => ({ key, value })),
    []
  );

  const handleInputChange = (key, value) => {
    setJob((prev) => ({ ...prev, [key]: value }));
  };

  const formatSalaryDisplay = (value) => {
    if (value === "" || value == null) return "";
    const num = Number(value);
    if (Number.isNaN(num)) return "";
    return formatCurrency(num, { showSymbol: false, fractionDigits: 0 });
  };

  const handleSalaryChange = (key, raw) => {
    const digitsOnly = (raw || "").replace(/[^\d]/g, "");
    handleInputChange(key, digitsOnly);
  };

  const applyBoldToField = (fieldKey, ref) => {
    const el = ref?.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    setJob((prev) => {
      const value = (prev[fieldKey] ?? "").toString();
      if (start === end) {
        const nextValue = value.slice(0, start) + "****" + value.slice(end);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + 2, start + 2);
        });
        return { ...prev, [fieldKey]: nextValue };
      }
      const selected = value.slice(start, end);
      const nextValue =
        value.slice(0, start) + `**${selected}**` + value.slice(end);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(end + 4, end + 4);
      });
      return { ...prev, [fieldKey]: nextValue };
    });
  };

  const applyBulletToField = (fieldKey, ref) => {
    const el = ref?.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    setJob((prev) => {
      const value = (prev[fieldKey] ?? "").toString();

      if (start !== end) {
        const selected = value.slice(start, end);
        const lines = selected.split(/\r?\n/);
        const prefixed = lines
          .map((l) =>
            l.trim() ? (l.trim().startsWith("- ") ? l : `- ${l}`) : ""
          )
          .join("\n");
        const nextValue = value.slice(0, start) + prefixed + value.slice(end);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start, start + prefixed.length);
        });
        return { ...prev, [fieldKey]: nextValue };
      }

      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const already = value.slice(lineStart, lineStart + 2) === "- ";
      if (already) return prev;

      const nextValue =
        value.slice(0, lineStart) + "- " + value.slice(lineStart);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + 2, start + 2);
      });
      return { ...prev, [fieldKey]: nextValue };
    });
  };

  const filteredSpecs = useMemo(() => {
    return [...filteredSpecsGlobal]
      .filter((s) =>
        job.CategoryID ? s.CategoryID === Number(job.CategoryID) : true
      )
      .sort((a, b) =>
        ((a.SpecializationName || "") + "")
          .trim()
          .localeCompare(((b.SpecializationName || "") + "").trim(), "vi", {
            sensitivity: "base",
          })
      );
  }, [filteredSpecsGlobal, job.CategoryID]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!job.JobTitle || !job.JobDescription || !job.ExpiresAt) {
      toast.error("Vui lòng nhập Tiêu đề, Mô tả và Ngày hết hạn.");
      return;
    }

    const min = job.SalaryMin !== "" ? Number(job.SalaryMin) : null;
    const max = job.SalaryMax !== "" ? Number(job.SalaryMax) : null;
    if (min !== null && max !== null && max < min) {
      toast.error("Lương tối đa phải lớn hơn hoặc bằng lương tối thiểu.");
      return;
    }

    const norm = (v) => (v || "").toString().trim().toLowerCase();
    const findByLabel = (list, getLabel, text) => {
      const t = norm(text);
      if (!t) return null;
      return (list || []).find((x) => norm(getLabel(x)) === t) || null;
    };

    const matchedCategory = findByLabel(
      sortedCategories,
      (c) => c.CategoryName,
      categorySearch
    );
    const matchedEducation = findByLabel(
      educationList,
      (x) => x.value,
      educationSearch
    );
    const matchedJobType = findByLabel(
      jobTypeList,
      (x) => x.value,
      jobTypeSearch
    );
    const matchedExperience = findByLabel(
      experienceList,
      (x) => x.value,
      experienceSearch
    );

    const categoryIdToSend = matchedCategory
      ? Number(matchedCategory.CategoryID)
      : null;
    const matchedSpec =
      categoryIdToSend && specSearch.trim()
        ? (sortedSpecializations || []).find(
            (s) =>
              Number(s.CategoryID) === Number(categoryIdToSend) &&
              norm(s.SpecializationName) === norm(specSearch)
          ) || null
        : null;
    const specIdToSend = matchedSpec
      ? Number(matchedSpec.SpecializationID)
      : null;
    const educationToSend = matchedEducation ? matchedEducation.value : "";
    const jobTypeToSend = matchedJobType ? matchedJobType.value : "";
    const experienceToSend = matchedExperience ? matchedExperience.value : "";

    if (categorySearch.trim() && !matchedCategory) {
      toast.error("Danh mục không hợp lệ, vui lòng chọn từ danh sách.");
      return;
    }
    if (specSearch.trim() && (!categoryIdToSend || !matchedSpec)) {
      toast.error("Chuyên môn không hợp lệ, vui lòng chọn từ danh sách.");
      return;
    }
    if (jobTypeSearch.trim() && !matchedJobType) {
      toast.error("Vị trí công việc không hợp lệ, vui lòng chọn từ danh sách.");
      return;
    }
    if (educationSearch.trim() && !matchedEducation) {
      toast.error("Trình độ học vấn không hợp lệ, vui lòng chọn từ danh sách.");
      return;
    }
    if (experienceSearch.trim() && !matchedExperience) {
      toast.error("Kinh nghiệm không hợp lệ, vui lòng chọn từ danh sách.");
      return;
    }

    const salaryMinNum = job.SalaryMin !== "" ? Number(job.SalaryMin) : null;
    const salaryMaxNum = job.SalaryMax !== "" ? Number(job.SalaryMax) : null;
    const agree =
      salaryMinNum !== null &&
      salaryMaxNum !== null &&
      salaryMinNum === 0 &&
      salaryMaxNum === 0;

    const payload = {
      ...job,
      CategoryID: categoryIdToSend,
      SpecializationID: specIdToSend,
      EducationLevel: educationToSend,
      JobType: jobTypeToSend,
      Experience: experienceToSend,
      SalaryMin: agree ? null : salaryMinNum,
      SalaryMax: agree ? null : salaryMaxNum,
      VacancyCount: job.VacancyCount !== "" ? Number(job.VacancyCount) : null,
      ExpiresAt: job.ExpiresAt,
    };

    try {
      if (mode === "edit") {
        const jobId = initialJob?.JobID;
        if (!jobId) {
          toast.error("Không tìm thấy JobID để cập nhật.");
          return;
        }
        if (typeof onUpdate !== "function") {
          toast.error("Thiếu handler cập nhật bài đăng.");
          return;
        }
        await onUpdate(jobId, payload);
        toast.success("Cập nhật bài đăng thành công.");
      } else {
        await onCreate(payload);
        toast.success("Tạo bài đăng thành công.");
      }

      setJob(getInitialJobState());
      setJdPreview(false);
      setReqPreview(false);
      setBenPreview(false);
      setCategoryOpen(false);
      setSpecOpen(false);
      setJobTypeOpen(false);
      setExperienceOpen(false);
      setEducationOpen(false);
      setCategorySearch("");
      setSpecSearch("");
      setJobTypeSearch("");
      setExperienceSearch("");
      setEducationSearch("");

      onClose?.();
    } catch (error) {
      console.error("Lỗi submit bài đăng:", error);
      const message =
        error?.response?.data?.message ||
        (mode === "edit"
          ? "Không thể cập nhật bài đăng. Vui lòng thử lại."
          : "Không thể tạo bài đăng. Vui lòng thử lại.");
      toast.error(message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-white border border-gray-100 shadow-2xl rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {mode === "edit" ? "Chỉnh sửa bài đăng" : "Thêm mới bài đăng"}
            </h3>
          </div>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 space-y-4 text-gray-700 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 gap-4">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-gray-800">Tiêu đề</span>
                <input
                  type="text"
                  required
                  value={job.JobTitle}
                  onChange={(e) =>
                    handleInputChange("JobTitle", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm" ref={categoryRef}>
                <span className="font-semibold text-gray-800">Danh mục</span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="-- Chọn danh mục --"
                    value={categorySearch}
                    onFocus={() => {
                      if (justSelectedDropdownRef.current) return;
                      setCategoryOpen(true);
                    }}
                    onChange={(e) => {
                      const nextText = e.target.value;
                      setCategorySearch(nextText);
                      setCategoryOpen(true);
                      if (job.CategoryID) {
                        handleInputChange("CategoryID", "");
                        handleInputChange("SpecializationID", "");
                        setSpecSearch("");
                        setSpecOpen(false);
                      }
                    }}
                    className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {(categorySearch !== "" || job.CategoryID) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleInputChange("CategoryID", "");
                        handleInputChange("SpecializationID", "");
                        setCategorySearch("");
                        setSpecSearch("");
                        setSpecOpen(false);
                        setCategoryOpen(true);
                      }}
                      className="absolute inset-y-0 px-2 text-gray-400 right-2 hover:text-gray-600"
                      aria-label="Xóa danh mục"
                    >
                      ×
                    </button>
                  )}
                  {categoryOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <div className="overflow-y-auto max-h-56">
                        {filteredCategories.map((c) => (
                          <button
                            type="button"
                            key={c.CategoryID}
                            onClick={() => {
                              markJustSelected();
                              handleInputChange("CategoryID", c.CategoryID);
                              handleInputChange("SpecializationID", "");
                              setCategoryOpen(false);
                              setCategorySearch(c.CategoryName || "");
                              setSpecSearch("");
                              setSpecOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                              String(job.CategoryID) === String(c.CategoryID)
                                ? "bg-blue-50 text-blue-700"
                                : ""
                            }`}
                          >
                            {c.CategoryName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>

              <label className="space-y-1 text-sm" ref={specRef}>
                <span className="font-semibold text-gray-800">Chuyên môn</span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={
                      job.CategoryID
                        ? "-- Chọn chuyên môn --"
                        : "Chọn danh mục trước"
                    }
                    value={specSearch}
                    onFocus={() => {
                      if (justSelectedDropdownRef.current) return;
                      job.CategoryID && setSpecOpen(true);
                    }}
                    onChange={(e) => {
                      if (!job.CategoryID) return;
                      const nextText = e.target.value;
                      setSpecSearch(nextText);
                      setSpecOpen(true);
                      if (job.SpecializationID) {
                        handleInputChange("SpecializationID", "");
                      }
                    }}
                    disabled={!job.CategoryID}
                    className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  {(specSearch !== "" || job.SpecializationID) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleInputChange("SpecializationID", "");
                        setSpecSearch("");
                        setSpecOpen(!!job.CategoryID);
                      }}
                      className="absolute inset-y-0 px-2 text-gray-400 right-2 hover:text-gray-600"
                      aria-label="Xóa chuyên môn"
                    >
                      ×
                    </button>
                  )}
                  {specOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-blue-100 rounded-lg shadow-lg shadow-blue-100">
                      <div className="overflow-y-auto max-h-56">
                        {filteredSpecs.map((s) => (
                          <button
                            type="button"
                            key={s.SpecializationID}
                            onClick={() => {
                              markJustSelected();
                              handleInputChange(
                                "SpecializationID",
                                s.SpecializationID
                              );
                              setSpecOpen(false);
                              setSpecSearch(s.SpecializationName || "");
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                              String(job.SpecializationID) ===
                              String(s.SpecializationID)
                                ? "bg-blue-50 text-blue-700"
                                : ""
                            }`}
                          >
                            {s.SpecializationName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm" ref={educationRef}>
                <span className="font-semibold text-gray-800">
                  Trình độ học vấn
                </span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="-- Chọn trình độ --"
                    value={educationSearch}
                    onFocus={() => {
                      if (justSelectedDropdownRef.current) return;
                      setEducationOpen(true);
                    }}
                    onChange={(e) => {
                      const nextText = e.target.value;
                      setEducationSearch(nextText);
                      setEducationOpen(true);
                      if (job.EducationLevel) {
                        handleInputChange("EducationLevel", "");
                      }
                    }}
                    className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {(educationSearch !== "" || job.EducationLevel) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleInputChange("EducationLevel", "");
                        setEducationSearch("");
                        setEducationOpen(false);
                      }}
                      className="absolute inset-y-0 px-2 text-gray-400 right-2 hover:text-gray-600"
                      aria-label="Xóa trình độ"
                    >
                      ×
                    </button>
                  )}
                  {educationOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <div className="overflow-y-auto max-h-56">
                        {educationList
                          .filter((e) =>
                            (educationSearch || "").toLowerCase().trim()
                              ? (e.value || "")
                                  .toLowerCase()
                                  .includes(
                                    educationSearch.toLowerCase().trim()
                                  )
                              : true
                          )
                          .map((e) => (
                            <button
                              type="button"
                              key={e.key}
                              onClick={() => {
                                markJustSelected();
                                handleInputChange("EducationLevel", e.value);
                                setEducationOpen(false);
                                setEducationSearch(e.value || "");
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                job.EducationLevel === e.value
                                  ? "bg-blue-50 text-blue-700"
                                  : ""
                              }`}
                            >
                              {e.value}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>

              <label className="space-y-1 text-sm" ref={jobTypeRef}>
                <span className="font-semibold text-gray-800">
                  Vị trí công việc
                </span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="-- Chọn vị trí công việc --"
                    value={jobTypeSearch}
                    onFocus={() => {
                      if (justSelectedDropdownRef.current) return;
                      setJobTypeOpen(true);
                    }}
                    onChange={(e) => {
                      const nextText = e.target.value;
                      setJobTypeSearch(nextText);
                      setJobTypeOpen(true);
                      if (job.JobType) {
                        handleInputChange("JobType", "");
                      }
                    }}
                    className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {(jobTypeSearch !== "" || job.JobType) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleInputChange("JobType", "");
                        setJobTypeSearch("");
                        setJobTypeOpen(true);
                      }}
                      className="absolute inset-y-0 px-2 text-gray-400 right-2 hover:text-gray-600"
                      aria-label="Xóa vị trí công việc"
                    >
                      ×
                    </button>
                  )}
                  {jobTypeOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <div className="overflow-y-auto max-h-56">
                        {filteredJobTypes.map((t) => (
                          <button
                            type="button"
                            key={t.key}
                            onClick={() => {
                              markJustSelected();
                              handleInputChange("JobType", t.value);
                              setJobTypeOpen(false);
                              setJobTypeSearch(t.value || "");
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                              job.JobType === t.value
                                ? "bg-blue-50 text-blue-700"
                                : ""
                            }`}
                          >
                            {t.value}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-gray-800">
                  Lương tối thiểu
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatSalaryDisplay(job.SalaryMin)}
                  onChange={(e) =>
                    handleSalaryChange("SalaryMin", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-gray-800">
                  Lương tối đa
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatSalaryDisplay(job.SalaryMax)}
                  onChange={(e) =>
                    handleSalaryChange("SalaryMax", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
              <p className="-mt-1 text-xs italic text-gray-500">
                Nhập cả hai mức lương là 0 hoặc để trống để hiển thị
                <b> Thỏa thuận</b>.
                <br />
                Chỉ nhập lương tối thiểu thì hiển thị là <b>Từ</b>.
              </p>

              <p className="-mt-1 text-xs italic text-gray-500">
                Chỉ nhập lương tối đa thì hiển thị là <b>Lên đến</b>.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm" ref={experienceRef}>
                <span className="font-semibold text-gray-800">Kinh nghiệm</span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="-- Chọn kinh nghiệm --"
                    value={experienceSearch}
                    onFocus={() => {
                      if (justSelectedDropdownRef.current) return;
                      setExperienceOpen(true);
                    }}
                    onChange={(e) => {
                      const nextText = e.target.value;
                      setExperienceSearch(nextText);
                      setExperienceOpen(true);
                      if (job.Experience) {
                        handleInputChange("Experience", "");
                      }
                    }}
                    className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {(experienceSearch !== "" || job.Experience) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleInputChange("Experience", "");
                        setExperienceSearch("");
                        setExperienceOpen(false);
                      }}
                      className="absolute inset-y-0 px-2 text-gray-400 right-2 hover:text-gray-600"
                      aria-label="Xóa kinh nghiệm"
                    >
                      ×
                    </button>
                  )}
                  {experienceOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <div className="overflow-y-auto max-h-56">
                        {filteredExperiences.map((e) => (
                          <button
                            type="button"
                            key={e.key}
                            onClick={() => {
                              markJustSelected();
                              handleInputChange("Experience", e.value);
                              setExperienceOpen(false);
                              setExperienceSearch(e.value || "");
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                              job.Experience === e.value
                                ? "bg-blue-50 text-blue-700"
                                : ""
                            }`}
                          >
                            {e.value}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-semibold text-gray-800">
                  Số lượng tuyển
                </span>
                <input
                  type="number"
                  min="1"
                  value={job.VacancyCount}
                  onChange={(e) =>
                    handleInputChange("VacancyCount", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
              <label className="col-start-2 -mt-2 text-xs italic text-gray-500">
                Nếu không nhập thì mặc định là 1
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-gray-800">
                  Địa điểm làm việc
                </span>
                <input
                  type="text"
                  value={job.Location}
                  onChange={(e) =>
                    handleInputChange("Location", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-gray-800">
                  Ngày hết hạn
                </span>
                <input
                  type="date"
                  ref={expiresAtRef}
                  value={job.ExpiresAt}
                  onClick={(e) => safeShowDatePicker(e.currentTarget)}
                  onChange={(e) =>
                    handleInputChange("ExpiresAt", e.target.value)
                  }
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-800">
                    Thời gian làm việc
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleInputChange("WorkingTimes", [
                      ...(job.WorkingTimes || []),
                      { dayFrom: "", dayTo: "", timeFrom: "", timeTo: "" },
                    ])
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 text-blue-700 transition hover:text-blue-900"
                >
                  <FiPlus size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {(job.WorkingTimes || []).map((wt, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.5fr_1.5fr_auto] gap-3 items-end rounded-lg border border-gray-200 p-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-600">Từ thứ</span>
                      <select
                        value={wt.dayFrom}
                        onChange={(e) => {
                          const next = [...job.WorkingTimes];
                          next[idx] = { ...wt, dayFrom: e.target.value };
                          handleInputChange("WorkingTimes", next);
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">—</option>
                        {Object.values(DAY_OF_WEEK).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs text-gray-600">Đến thứ</span>
                      <select
                        value={wt.dayTo}
                        onChange={(e) => {
                          const next = [...job.WorkingTimes];
                          next[idx] = { ...wt, dayTo: e.target.value };
                          handleInputChange("WorkingTimes", next);
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">—</option>
                        {Object.values(DAY_OF_WEEK).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs text-gray-600">Giờ bắt đầu</span>
                      <div className="flex gap-2">
                        <select
                          value={(wt.timeFrom || "").split(":")[0] || ""}
                          onChange={(e) => {
                            const hour = e.target.value;
                            const minute =
                              (wt.timeFrom || "").split(":")[1] || "00";
                            const next = [...job.WorkingTimes];
                            next[idx] = {
                              ...wt,
                              timeFrom: hour ? `${hour}:${minute}` : "",
                            };
                            handleInputChange("WorkingTimes", next);
                          }}
                          className="flex-1 px-3 py-2 border rounded-lg"
                        >
                          <option value="">--</option>
                          {Array.from({ length: 24 }).map((_, h) => {
                            const val = h.toString().padStart(2, "0");
                            return (
                              <option key={val} value={val}>
                                {val}
                              </option>
                            );
                          })}
                        </select>
                        <select
                          value={(wt.timeFrom || "").split(":")[1] || ""}
                          onChange={(e) => {
                            const minute = e.target.value;
                            const hour =
                              (wt.timeFrom || "").split(":")[0] || "00";
                            const next = [...job.WorkingTimes];
                            next[idx] = {
                              ...wt,
                              timeFrom: minute ? `${hour}:${minute}` : "",
                            };
                            handleInputChange("WorkingTimes", next);
                          }}
                          className="flex-1 px-3 py-2 border rounded-lg"
                        >
                          <option value="">--</option>
                          {[
                            "00",
                            "05",
                            "10",
                            "15",
                            "20",
                            "25",
                            "30",
                            "35",
                            "40",
                            "45",
                            "50",
                            "55",
                          ].map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs text-gray-600">
                        Giờ kết thúc
                      </span>
                      <div className="flex gap-2">
                        <select
                          value={(wt.timeTo || "").split(":")[0] || ""}
                          onChange={(e) => {
                            const hour = e.target.value;
                            const minute =
                              (wt.timeTo || "").split(":")[1] || "00";
                            const next = [...job.WorkingTimes];
                            next[idx] = {
                              ...wt,
                              timeTo: hour ? `${hour}:${minute}` : "",
                            };
                            handleInputChange("WorkingTimes", next);
                          }}
                          className="flex-1 px-3 py-2 border rounded-lg"
                        >
                          <option value="">--</option>
                          {Array.from({ length: 24 }).map((_, h) => {
                            const val = h.toString().padStart(2, "0");
                            return (
                              <option key={val} value={val}>
                                {val}
                              </option>
                            );
                          })}
                        </select>
                        <select
                          value={(wt.timeTo || "").split(":")[1] || ""}
                          onChange={(e) => {
                            const minute = e.target.value;
                            const hour =
                              (wt.timeTo || "").split(":")[0] || "00";
                            const next = [...job.WorkingTimes];
                            next[idx] = {
                              ...wt,
                              timeTo: minute ? `${hour}:${minute}` : "",
                            };
                            handleInputChange("WorkingTimes", next);
                          }}
                          className="flex-1 px-3 py-2 border rounded-lg"
                        >
                          <option value="">--</option>
                          {[
                            "00",
                            "05",
                            "10",
                            "15",
                            "20",
                            "25",
                            "30",
                            "35",
                            "40",
                            "45",
                            "50",
                            "55",
                          ].map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const next = [...job.WorkingTimes];
                        next.splice(idx, 1);
                        handleInputChange(
                          "WorkingTimes",
                          next.length > 0
                            ? next
                            : [
                                {
                                  dayFrom: "",
                                  dayTo: "",
                                  timeFrom: "",
                                  timeTo: "",
                                },
                              ]
                        );
                      }}
                      className="h-10 px-3 text-red-600 hover:text-red-900"
                      title="Xóa"
                    >
                      <FiTrash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <span className="text-xs italic text-gray-500">
              Nếu chọn cùng chung một thứ thì sẽ hiển thị mỗi thứ đó. <br />
              Nếu không chọn thì sẽ hiển thị là{" "}
              <b>Thời gian làm việc linh hoạt</b>.
            </span>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">Mô tả</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() =>
                        applyBoldToField("JobDescription", jobDescriptionRef)
                      }
                      disabled={jdPreview}
                      className="w-8 h-8 font-bold text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
                      title="In đậm"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyBulletToField("JobDescription", jobDescriptionRef)
                      }
                      disabled={jdPreview}
                      className="w-8 h-8 text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
                      title="Gạch đầu dòng (-)"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setJdPreview((v) => !v)}
                      className="ml-2 text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      {jdPreview ? "Chỉnh sửa" : "Xem trước"}
                    </button>
                  </div>
                </div>
                {jdPreview ? (
                  <div className="min-h-[120px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                    {renderJobPostRichText(job.JobDescription)}
                  </div>
                ) : (
                  <textarea
                    ref={jobDescriptionRef}
                    rows={3}
                    value={job.JobDescription}
                    onChange={(e) =>
                      handleInputChange("JobDescription", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">Yêu cầu</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() =>
                        applyBoldToField("Requirements", requirementsRef)
                      }
                      disabled={reqPreview}
                      className="w-8 h-8 font-bold text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
                      title="In đậm"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyBulletToField("Requirements", requirementsRef)
                      }
                      disabled={reqPreview}
                      className="w-8 h-8 text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
                      title="Gạch đầu dòng (-)"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setReqPreview((v) => !v)}
                      className="ml-2 text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      {reqPreview ? "Chỉnh sửa" : "Xem trước"}
                    </button>
                  </div>
                </div>
                {reqPreview ? (
                  <div className="min-h-[120px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                    {renderJobPostRichText(job.Requirements)}
                  </div>
                ) : (
                  <textarea
                    ref={requirementsRef}
                    rows={3}
                    value={job.Requirements}
                    onChange={(e) =>
                      handleInputChange("Requirements", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">Phúc lợi</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => applyBoldToField("Benefits", benefitsRef)}
                      disabled={benPreview}
                      className="w-8 h-8 font-bold text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
                      title="In đậm"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyBulletToField("Benefits", benefitsRef)
                      }
                      disabled={benPreview}
                      className="w-8 h-8 text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
                      title="Gạch đầu dòng (-)"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setBenPreview((v) => !v)}
                      className="ml-2 text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      {benPreview ? "Chỉnh sửa" : "Xem trước"}
                    </button>
                  </div>
                </div>
                {benPreview ? (
                  <div className="min-h-[100px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                    {renderJobPostRichText(job.Benefits)}
                  </div>
                ) : (
                  <textarea
                    ref={benefitsRef}
                    rows={3}
                    value={job.Benefits}
                    onChange={(e) =>
                      handleInputChange("Benefits", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              {mode === "edit" ? "Lưu thay đổi" : "Lưu bài đăng"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}