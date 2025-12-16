import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiPlus,
  FiInfo,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiArrowUpCircle,
  FiUsers,
  FiXCircle,
  FiRotateCcw,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { jobApi } from "../../api/jobApi";
import { categoryApi } from "../../api/categoryApi";
import { renderSalary } from "../../utils/renderSalary";
import { STATUS_CONFIG } from "../../constants/statusConfig";
import { EXPERIENCE_AMOUNT } from "../../constants/experienceAmount";
import { GUIDE_ITEMS } from "../../constants/guideItemsJobPost";
import { formatDate } from "../../utils/formatDate";
import JobPostAddEditModal from "./components/JobPostAddEditModal";
import JobPostDetailModal from "./components/JobPostDetailModal";
import ConfirmationModal from "../../components/modals/ConfirmationModal";
import JobApplicantsModal from "./components/JobApplicantsModal";

const JobPostsManagement = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pushTopDashboard, setPushTopDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalResetKey, setAddModalResetKey] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalResetKey, setEditModalResetKey] = useState(0);
  const [editJob, setEditJob] = useState(null);
  const [detailJob, setDetailJob] = useState(null);
  const [applicantsJob, setApplicantsJob] = useState(null);
  const [specMap, setSpecMap] = useState({});
  const [categories, setCategories] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [pushingId, setPushingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [searchTitle, setSearchTitle] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterSpecId, setFilterSpecId] = useState("ALL");
  const [filterExperience, setFilterExperience] = useState("ALL");
  const [specSearch, setSpecSearch] = useState("");
  const [specDropdownOpen, setSpecDropdownOpen] = useState(false);
  const specDropdownRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    isDanger: false,
    confirmText: "Xác nhận",
  });

  const resetFormState = () => setAddModalResetKey((k) => k + 1);
  const resetEditFormState = () => setEditModalResetKey((k) => k + 1);

  const openEditModal = (job) => {
    setEditJob(job || null);
    resetEditFormState();
    setEditModalOpen(true);
  };

  const normalizeText = (s) =>
    (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const filteredJobs = useMemo(() => {
    const keyword = normalizeText(searchTitle);

    return (jobs || []).filter((job) => {
      if (keyword) {
        const t = normalizeText(job?.JobTitle);
        if (!t.includes(keyword)) return false;
      }

      if (filterStatus !== "ALL") {
        if (Number(job?.Status) !== Number(filterStatus)) return false;
      }

      if (filterSpecId !== "ALL") {
        if (String(job?.SpecializationID || "") !== String(filterSpecId))
          return false;
      }

      if (filterExperience !== "ALL") {
        if ((job?.Experience || "") !== filterExperience) return false;
      }

      return true;
    });
  }, [jobs, searchTitle, filterStatus, filterSpecId, filterExperience]);

  const experienceOptions = useMemo(() => {
    return Object.entries(EXPERIENCE_AMOUNT)
      .filter(([key]) => key !== "ALL")
      .map(([key, value]) => ({ key, value }));
  }, []);

  const filteredSpecializations = useMemo(() => {
    const keyword = normalizeText(specSearch);
    const list = Array.isArray(specializations) ? specializations : [];
    if (!keyword) return list;
    return list.filter((s) =>
      normalizeText(s?.SpecializationName).includes(keyword)
    );
  }, [specializations, specSearch]);

  const selectedSpecLabel = useMemo(() => {
    if (filterSpecId === "ALL") return "Tất cả";
    const found = (specializations || []).find(
      (s) => String(s.SpecializationID) === String(filterSpecId)
    );
    return found?.SpecializationName || "Chọn chuyên môn";
  }, [filterSpecId, specializations]);

  useEffect(() => {
    if (!specDropdownOpen) return;
    const onDocMouseDown = (e) => {
      if (
        specDropdownRef.current &&
        !specDropdownRef.current.contains(e.target)
      ) {
        setSpecDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [specDropdownOpen]);

  const loadPushTopDashboard = async () => {
    setDashboardLoading(true);
    try {
      const res = await jobApi.getPushTopDashboard();
      setPushTopDashboard(res?.data || res || null);
    } catch (error) {
      console.error("Lỗi lấy push-top dashboard:", error);
      setPushTopDashboard(null);
    } finally {
      setDashboardLoading(false);
    }
  };

  const loadJobs = async () => {
    setRefreshing(true);
    try {
      const res = await jobApi.getMyJobs();
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      const toTime = (v) => {
        const t = new Date(v).getTime();
        return Number.isNaN(t) ? 0 : t;
      };
      const activityTime = (job) => {
        const approvedAt = toTime(job?.ApprovedAt);
        const lastPushedAt = toTime(job?.LastPushedAt);
        const createdAt = toTime(job?.CreatedAt);
        return Math.max(approvedAt, lastPushedAt, createdAt);
      };
      const sorted = [...list].sort((a, b) => {
        const diff = activityTime(b) - activityTime(a);
        if (diff !== 0) return diff;
        return toTime(b?.CreatedAt) - toTime(a?.CreatedAt);
      });
      setJobs(sorted);
    } catch (error) {
      console.error("Lỗi lấy danh sách bài đăng:", error);
      const message =
        error.response?.data?.message ||
        "Không thể tải danh sách bài đăng. Vui lòng thử lại.";
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const sortByName = (list, key) =>
    [...list].sort((a, b) =>
      ((a?.[key] || "") + "")
        .trim()
        .localeCompare(((b?.[key] || "") + "").trim(), "vi", {
          sensitivity: "base",
        })
    );

  const loadSpecializations = async () => {
    try {
      const res = await categoryApi.getAllSpecializations();
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      const sorted = sortByName(list, "SpecializationName");
      setSpecializations(sorted);
      const map = {};
      sorted.forEach((item) => {
        if (item?.SpecializationID) {
          map[item.SpecializationID] = item.SpecializationName || "—";
        }
      });
      setSpecMap(map);
    } catch (error) {
      console.error("Lỗi tải chuyên môn:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await categoryApi.getCategories();
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      const sorted = sortByName(list, "CategoryName");
      setCategories(sorted);
    } catch (error) {
      console.error("Lỗi tải danh mục:", error);
    }
  };

  useEffect(() => {
    loadJobs();
    loadPushTopDashboard();
    loadSpecializations();
    loadCategories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const renderExpiresAt = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("vi-VN", { timeZone: "UTC" });
  };

  const renderCreatedAt = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("vi-VN", { timeZone: "UTC" });
  };

  const handlePushTop = async (jobId) => {
    if (!jobId) return;

    if (pushTopDashboard) {
      if (
        pushTopDashboard.isVip &&
        typeof pushTopDashboard.remainingToday === "number" &&
        pushTopDashboard.remainingToday <= 0
      ) {
        toast.error("Bạn đã hết lượt đẩy top hôm nay.");
        return;
      }
      if (
        !pushTopDashboard.isVip &&
        typeof pushTopDashboard.remainingThisWeek === "number" &&
        pushTopDashboard.remainingThisWeek <= 0
      ) {
        toast.error("Bạn đã hết lượt đẩy top trong tuần này.");
        return;
      }
    }

    setPushingId(jobId);
    try {
      const res = await jobApi.pushTop(jobId);
      const message = res?.data?.message || "Đẩy top thành công.";
      toast.success(message);
      await loadJobs();
      await loadPushTopDashboard();
    } catch (error) {
      console.error("Lỗi đẩy top:", error);
      const message =
        error.response?.data?.message || "Không thể đẩy top. Vui lòng thử lại.";
      toast.error(message);
    } finally {
      setPushingId(null);
    }
  };

  const handleCloseJob = async (jobId) => {
    if (!jobId) return;
    try {
      const res = await jobApi.closeJob(jobId);
      toast.success(res?.data?.message || "Đóng bài tuyển dụng thành công.");
      await loadJobs();
    } catch (error) {
      console.error("Lỗi đóng bài:", error);
      const message =
        error.response?.data?.message ||
        "Không thể đóng bài. Vui lòng thử lại.";
      toast.error(message);
    }
  };

  const handleReopenJob = async (jobId) => {
    if (!jobId) return;
    try {
      const res = await jobApi.reopenJob(jobId);
      toast.success(res?.data?.message || "Mở lại bài tuyển dụng thành công.");
      await loadJobs();
    } catch (error) {
      console.error("Lỗi mở lại bài:", error);
      const message =
        error.response?.data?.message ||
        "Không thể mở lại bài. Vui lòng thử lại.";
      toast.error(message);
    }
  };

  const confirmCloseJob = (job) => {
    const jobId = job?.JobID;
    if (!jobId) return;
    if (Number(job?.Status) !== 1) return;

    setConfirmModal({
      isOpen: true,
      title: "Đóng bài tuyển dụng",
      message: `Bạn có chắc chắn muốn đóng bài "${
        job?.JobTitle || "—"
      }" không?`,
      isDanger: true,
      confirmText: "Đóng bài",
      onConfirm: () => handleCloseJob(jobId),
    });
  };

  const confirmReopenJob = (job) => {
    const jobId = job?.JobID;
    if (!jobId) return;
    if (Number(job?.Status) !== 2) return;

    setConfirmModal({
      isOpen: true,
      title: "Mở lại bài tuyển dụng",
      message: `Bạn có chắc chắn muốn mở lại bài "${
        job?.JobTitle || "—"
      }" để tiếp tục tuyển dụng không?`,
      isDanger: false,
      confirmText: "Mở lại",
      onConfirm: () => handleReopenJob(jobId),
    });
  };

  const handleDeleteJob = async (jobId) => {
    if (!jobId) return;
    setDeletingId(jobId);
    try {
      const res = await jobApi.deleteJob(jobId);
      toast.success(res?.data?.message || "Xóa bài đăng thành công.");
      await loadJobs();
      loadPushTopDashboard();
    } catch (error) {
      console.error("Lỗi xóa bài:", error);
      const message =
        error.response?.data?.message || "Không thể xóa bài. Vui lòng thử lại.";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDeleteJob = (job) => {
    const jobId = job?.JobID;
    if (!jobId) return;
    if (Number(job?.Status) === 1) return;

    setConfirmModal({
      isOpen: true,
      title: "Xóa bài đăng",
      message: `Bạn có chắc chắn muốn XÓA bài đăng "${
        job?.JobTitle || "—"
      }" không? Hành động này không thể hoàn tác.`,
      isDanger: true,
      confirmText: "Xóa",
      onConfirm: () => handleDeleteJob(jobId),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-600">
        <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 shadow-sm rounded-xl">
          <FiRefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
          <span>Đang tải danh sách bài đăng...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-8 lg:px-0">
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_320px] gap-4 xl:gap-6">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl">
            <div className="text-sm font-semibold text-gray-900">
              Một số quy tắc với các nút bấm
            </div>
            <ul className="pl-5 mt-3 space-y-2 text-sm text-gray-700 list-disc">
              {GUIDE_ITEMS.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="lg:px-4">
          <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Quản lý tin tuyển dụng
              </h1>
              {typeof pushTopDashboard?.jobPostDailyLimit === "number" ? (
                <div className="mt-1 text-sm text-gray-700">
                  Đăng bài hôm nay:{" "}
                  <span className="font-semibold text-gray-900">
                    {pushTopDashboard.jobPostUsedToday ?? 0}/
                    {pushTopDashboard.jobPostDailyLimit}
                  </span>
                  {typeof pushTopDashboard?.jobPostRemainingToday ===
                  "number" ? (
                    <>
                      {" "}
                      (Còn{" "}
                      <span className="font-semibold text-blue-700">
                        {pushTopDashboard.jobPostRemainingToday}
                      </span>
                      )
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            {(() => {
              const isPostQuotaExceeded =
                typeof pushTopDashboard?.jobPostRemainingToday === "number" &&
                pushTopDashboard.jobPostRemainingToday <= 0;

              return (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        await loadJobs();
                        loadPushTopDashboard();
                      }}
                      disabled={refreshing}
                      className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                    >
                      <FiRefreshCw
                        className={`h-4 w-4 ${
                          refreshing ? "animate-spin" : ""
                        }`}
                      />
                      <span>Làm mới</span>
                    </button>
                    <button
                      onClick={() => {
                        resetFormState();
                        setAddModalOpen(true);
                      }}
                      disabled={isPostQuotaExceeded}
                      className="inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <FiPlus className="w-4 h-4" />
                      <span>Thêm mới</span>
                    </button>
                  </div>
                  {isPostQuotaExceeded ? (
                    <div className="text-xs text-red-600">
                      Đã hết lượt đăng bài hôm nay.
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>

          <div className="p-4 mb-4 bg-white border border-gray-100 shadow-sm rounded-xl">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <div className="mb-1 text-xs font-semibold text-gray-600">
                    Tìm theo tiêu đề
                  </div>
                  <input
                    value={searchTitle}
                    onChange={(e) => setSearchTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="min-w-[180px]">
                  <div className="mb-1 text-xs font-semibold text-gray-600">
                    Trạng thái
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg"
                  >
                    <option value="ALL">Tất cả</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v?.label || `Trạng thái ${k}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-[220px]">
                  <div className="mb-1 text-xs font-semibold text-gray-600">
                    Chuyên môn
                  </div>
                  <div className="relative" ref={specDropdownRef}>
                    <div className="relative">
                      <input
                        value={specSearch}
                        onChange={(e) => {
                          setSpecSearch(e.target.value);
                          setSpecDropdownOpen(true);
                        }}
                        onFocus={() => setSpecDropdownOpen(true)}
                        placeholder={selectedSpecLabel}
                        className="w-full px-3 py-2 pr-12 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {specSearch ? (
                        <button
                          type="button"
                          title="Xóa"
                          onClick={() => {
                            setSpecSearch("");
                            setFilterSpecId("ALL");
                            setSpecDropdownOpen(false);
                          }}
                          className="absolute text-gray-400 -translate-y-1/2 right-8 top-1/2 hover:text-gray-700"
                        >
                          ×
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setSpecDropdownOpen((v) => !v)}
                        className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2 hover:text-gray-700"
                        aria-label="Mở danh sách chuyên môn"
                      >
                        ▾
                      </button>
                    </div>

                    {specDropdownOpen ? (
                      <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
                        <div className="py-1 overflow-auto max-h-64">
                          <button
                            type="button"
                            onClick={() => {
                              setFilterSpecId("ALL");
                              setSpecSearch("");
                              setSpecDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                              filterSpecId === "ALL"
                                ? "bg-blue-50 text-blue-700 font-semibold"
                                : "text-gray-800"
                            }`}
                          >
                            Tất cả
                          </button>
                          {filteredSpecializations.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              Không có chuyên môn phù hợp.
                            </div>
                          ) : (
                            filteredSpecializations.map((s) => {
                              const active =
                                String(filterSpecId) ===
                                String(s.SpecializationID);
                              return (
                                <button
                                  key={s.SpecializationID}
                                  type="button"
                                  onClick={() => {
                                    setFilterSpecId(String(s.SpecializationID));
                                    setSpecSearch(s.SpecializationName || "");
                                    setSpecDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                    active
                                      ? "bg-blue-50 text-blue-700 font-semibold"
                                      : "text-gray-800"
                                  }`}
                                >
                                  {s.SpecializationName}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-[200px]">
                  <div className="mb-1 text-xs font-semibold text-gray-600">
                    Kinh nghiệm
                  </div>
                  <select
                    value={filterExperience}
                    onChange={(e) => setFilterExperience(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg"
                  >
                    <option value="ALL">Tất cả</option>
                    {experienceOptions.map((x) => (
                      <option key={x.key} value={x.value}>
                        {x.value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-end">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-700">
                    Kết quả:{" "}
                    <span className="font-semibold text-gray-900">
                      {filteredJobs.length}
                    </span>
                    /{jobs.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTitle("");
                      setFilterStatus("ALL");
                      setFilterSpecId("ALL");
                      setFilterExperience("ALL");
                      setSpecSearch("");
                      setSpecDropdownOpen(false);
                    }}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Xóa lọc
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden bg-white border border-gray-100 shadow-sm rounded-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      Tiêu đề
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      Mức lương
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      Kinh nghiệm
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      Chuyên môn
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      Ngày tạo
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      Ngày hết hạn
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      Trạng thái
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredJobs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-sm text-center text-gray-500"
                      >
                        Không có kết quả phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map((job) => (
                      <tr key={job.JobID} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          {job.JobTitle}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {renderSalary(job.SalaryMin, job.SalaryMax)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {job.Experience || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {specMap[job.SpecializationID] ? (
                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100 inline-block max-w-[320px] whitespace-normal text-left">
                              {specMap[job.SpecializationID]}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {renderCreatedAt(job.CreatedAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {renderExpiresAt(job.ExpiresAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                              STATUS_CONFIG[job.Status]?.className ||
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {STATUS_CONFIG[job.Status]?.label ||
                              `Trạng thái ${job.Status}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <button
                              title="Chi tiết"
                              onClick={() => setDetailJob(job)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <FiInfo className="w-4 h-4" />
                            </button>
                            <button
                              title="Sửa"
                              onClick={() => openEditModal(job)}
                              disabled={Number(job.Status) !== 0}
                              className={`text-blue-600 hover:text-blue-900 ${
                                Number(job.Status) !== 0
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button
                              title="Đẩy top"
                              onClick={() => handlePushTop(job.JobID)}
                              disabled={
                                pushingId === job.JobID ||
                                job.Status !== 1 ||
                                dashboardLoading ||
                                (pushTopDashboard?.isVip &&
                                  Number(pushTopDashboard?.remainingToday) <=
                                    0) ||
                                (!pushTopDashboard?.isVip &&
                                  Number(
                                    pushTopDashboard?.remainingThisWeek ?? 0
                                  ) <= 0)
                              }
                              className={`text-blue-600 hover:text-blue-900 ${
                                job.Status !== 1 ||
                                dashboardLoading ||
                                (pushTopDashboard?.isVip &&
                                  Number(pushTopDashboard?.remainingToday) <=
                                    0) ||
                                (!pushTopDashboard?.isVip &&
                                  Number(
                                    pushTopDashboard?.remainingThisWeek ?? 0
                                  ) <= 0)
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <FiArrowUpCircle
                                className={`h-4 w-4 ${
                                  pushingId === job.JobID ? "animate-pulse" : ""
                                }`}
                              />
                            </button>
                            <button
                              title="Ứng viên đã ứng tuyển"
                              onClick={() => setApplicantsJob(job)}
                              disabled={job.Status === 0 || job.Status === 4}
                              className={`text-blue-600 hover:text-gray-900 ${
                                job.Status === 0 || job.Status === 4
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <FiUsers className="w-4 h-4" />
                            </button>
                            <button
                              title="Đóng bài tuyển dụng"
                              onClick={() => confirmCloseJob(job)}
                              disabled={job.Status !== 1}
                              className={`text-red-600 hover:text-red-900 ${
                                job.Status !== 1
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <FiXCircle className="w-4 h-4" />
                            </button>
                            <button
                              title="Mở lại bài tuyển dụng"
                              onClick={() => confirmReopenJob(job)}
                              disabled={job.Status !== 2}
                              className={`text-emerald-600 hover:text-emerald-900 ${
                                job.Status !== 2
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <FiRotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              title="Xóa"
                              onClick={() => confirmDeleteJob(job)}
                              disabled={
                                Number(job.Status) === 1 ||
                                deletingId === job.JobID
                              }
                              className={`text-red-600 hover:text-red-900 ${
                                Number(job.Status) === 1 ||
                                deletingId === job.JobID
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">
                Quản lý đẩy top
              </div>
            </div>

            <div className="p-3 mt-3 border border-gray-100 rounded-lg bg-gray-50">
              {pushTopDashboard ? (
                <div className="space-y-2 text-sm text-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">
                      Tài khoản:
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        pushTopDashboard.isVip
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {pushTopDashboard.isVip ? "VIP" : "Thường"}
                    </span>
                  </div>

                  {pushTopDashboard.isVip ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Còn lại hôm nay</span>
                        <span className="font-semibold">
                          {pushTopDashboard.remainingToday}/
                          {pushTopDashboard.vipDailyLimit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Đã dùng</span>
                        <span className="font-semibold">
                          {pushTopDashboard.usedToday}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-gray-700">
                        Khả dụng:{" "}
                        <span className="font-semibold">1 bài viết/tuần</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Còn lại tuần này</span>
                        <span className="font-semibold">
                          {pushTopDashboard.remainingThisWeek ?? "—"}/
                          {pushTopDashboard.weeklyLimit ?? 1}
                        </span>
                      </div>
                      {pushTopDashboard.lastPushedThisWeek ? (
                        <div className="text-xs text-gray-600">
                          Đã đẩy:{" "}
                          <span className="font-semibold text-gray-800">
                            {pushTopDashboard.lastPushedThisWeek.JobTitle}
                          </span>
                          {" · "}
                          {formatDate(
                            pushTopDashboard.lastPushedThisWeek.LastPushedAt
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-600">Chưa có dữ liệu.</div>
              )}
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900">
                Top 10 bài đẩy gần nhất
              </div>
              <div className="mt-2 space-y-2">
                {(pushTopDashboard?.recent || []).length === 0 ? (
                  <div className="text-sm text-gray-600">
                    Chưa có lượt đẩy top.
                  </div>
                ) : (
                  pushTopDashboard.recent.map((j) => (
                    <div
                      key={j.LogID ?? `${j.JobID}-${j.LastPushedAt}`}
                      className="p-3 border border-gray-100 rounded-lg"
                    >
                      <div className="text-sm font-semibold text-gray-900 line-clamp-2">
                        {j.JobTitle}
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        {formatDate(j.LastPushedAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <JobPostAddEditModal
        key={addModalResetKey}
        open={addModalOpen}
        mode="create"
        categories={categories}
        specializations={specializations}
        onClose={() => {
          resetFormState();
          setAddModalOpen(false);
        }}
        onCreate={async (payload) => {
          await jobApi.createJob(payload);
          await loadJobs();
          await loadPushTopDashboard();
        }}
      />
      <JobPostAddEditModal
        key={editModalResetKey}
        open={editModalOpen}
        mode="edit"
        initialJob={editJob}
        categories={categories}
        specializations={specializations}
        onClose={() => {
          setEditModalOpen(false);
          setEditJob(null);
        }}
        onUpdate={async (jobId, payload) => {
          await jobApi.updateJob(jobId, payload);
          await loadJobs();
          await loadPushTopDashboard();
        }}
      />
      <JobPostDetailModal
        open={!!detailJob}
        job={detailJob}
        categories={categories}
        specMap={specMap}
        onClose={() => setDetailJob(null)}
      />

      <JobApplicantsModal
        open={!!applicantsJob}
        job={applicantsJob}
        onClose={() => setApplicantsJob(null)}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDanger={confirmModal.isDanger}
        confirmText={confirmModal.confirmText}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm || (() => {})}
      />
    </div>
  );
};

export default JobPostsManagement;