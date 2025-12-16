import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiBriefcase, FiMapPin, FiRefreshCw, FiSend } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { jobApi } from "../api/jobApi";
import { renderSalary } from "../utils/renderSalary";
import { formatDateOnly } from "../utils/formatDateOnly";

export default function HomeJobs() {
  const { appUser } = useAuth();
  const roleId = Number(appUser?.RoleID || 0);
  const isEmployer = roleId === 3;
  const isCandidate = roleId === 4;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [applyingId, setApplyingId] = useState(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await jobApi.getActiveJobs();
      const list = Array.isArray(res?.data) ? res.data : [];
      setJobs(list);
    } catch (err) {
      console.error("Lỗi load active jobs:", err);
      toast.error(err?.response?.data?.message || "Không thể tải danh sách việc.");
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const sorted = useMemo(() => {
    const toTime = (v) => {
      const t = new Date(v).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    return [...(jobs || [])].sort((a, b) => {
      const lp = toTime(b.LastPushedAt) - toTime(a.LastPushedAt);
      if (lp !== 0) return lp;
      return toTime(b.CreatedAt) - toTime(a.CreatedAt);
    });
  }, [jobs]);

  const handleApply = async (jobId) => {
    if (!isCandidate) return;
    const already = (jobs || []).some(
      (j) => Number(j?.JobID) === Number(jobId) && (j?.HasApplied === true || Number(j?.HasApplied) === 1)
    );
    if (already) return;
    setApplyingId(jobId);
    try {
      const res = await jobApi.applyToJob(jobId, {});
      toast.success(res?.data?.message || "Ứng tuyển thành công.");
      setJobs((prev) =>
        (prev || []).map((j) =>
          Number(j?.JobID) === Number(jobId) ? { ...j, HasApplied: true } : j
        )
      );
    } catch (err) {
      console.error("Lỗi apply:", err);
      toast.error(err?.response?.data?.message || "Không thể ứng tuyển.");
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="max-w-6xl px-4 py-8 mx-auto">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            Việc làm đang tuyển
          </div>
          <div className="mt-1 text-sm text-gray-600">
            Tổng số:{" "}
            <span className="font-semibold text-gray-900">{sorted.length}</span>
          </div>
          {isEmployer ? (
            <div className="mt-1 text-sm text-amber-700">
              Tài khoản nhà tuyển dụng không thể ứng tuyển.
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
        >
          <FiRefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh] text-gray-600">
          <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 shadow-sm rounded-xl">
            <FiRefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            <span>Đang tải danh sách việc...</span>
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-10 text-center text-gray-600 bg-white border border-gray-100 shadow-sm rounded-xl">
          Chưa có tin tuyển dụng đang tuyển.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sorted.map((j) => {
            const hasApplied = j?.HasApplied === true || Number(j?.HasApplied) === 1;
            const disabled =
              isEmployer || !isCandidate || applyingId === j.JobID || hasApplied;
            return (
              <div
                key={j.JobID}
                className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-gray-900 line-clamp-2">
                      {j.JobTitle}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-700">
                      {j.CompanyName || "—"}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 shrink-0">
                    Hết hạn:{" "}
                    <span className="font-semibold text-gray-900">
                      {formatDateOnly(j.ExpiresAt) || "—"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3 text-sm">
                  <span className="inline-flex items-center gap-2 px-3 py-1 text-blue-700 border border-blue-100 rounded-full bg-blue-50">
                    <FiBriefcase className="w-4 h-4" />
                    {j.SpecializationName || "—"}
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1 border rounded-full bg-emerald-50 text-emerald-700 border-emerald-100">
                    {renderSalary(j.SalaryMin, j.SalaryMax)}
                  </span>
                  {j.Location ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1 text-gray-700 border border-gray-100 rounded-full bg-gray-50">
                      <FiMapPin className="w-4 h-4" />
                      <span className="line-clamp-1">{j.Location}</span>
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center justify-end mt-4">
                  <button
                    type="button"
                    onClick={() => handleApply(j.JobID)}
                    disabled={disabled}
                    className="inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    title={
                      isEmployer
                        ? "Nhà tuyển dụng không thể ứng tuyển"
                        : !isCandidate
                        ? "Chỉ ứng viên mới có thể ứng tuyển"
                        : hasApplied
                        ? "Bạn đã ứng tuyển công việc này"
                        : ""
                    }
                  >
                    <FiSend className="w-4 h-4" />
                    <span>
                      {applyingId === j.JobID
                        ? "Đang gửi..."
                        : hasApplied
                        ? "Đã ứng tuyển"
                        : "Ứng tuyển"}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

