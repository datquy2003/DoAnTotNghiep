import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FiBriefcase,
  FiHeart,
  FiMapPin,
  FiRefreshCw,
  FiSend,
} from "react-icons/fi";
import { jobApi } from "../../api/jobApi";
import { renderSalary } from "../../utils/renderSalary";
import CvSelectionModal from "../../components/modals/CvSelectionModal";

export default function FavoriteJobs() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [applyingId, setApplyingId] = useState(null);
  const [isCvModalOpen, setIsCvModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await jobApi.getSavedJobs();
      const list = Array.isArray(res?.data) ? res.data : [];
      setJobs(list);
    } catch (err) {
      console.error("Lỗi load saved jobs:", err);
      toast.error(
        err?.response?.data?.message ||
          "Không thể tải danh sách việc yêu thích."
      );
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
    return [...(jobs || [])].sort(
      (a, b) => toTime(b?.SavedAt) - toTime(a?.SavedAt)
    );
  }, [jobs]);

  const handleToggleSave = async (jobId, nextSaved) => {
    if (!jobId) return;
    setSavingId(jobId);
    try {
      if (nextSaved) {
        await jobApi.saveJob(jobId);
        toast.success("Đã thêm vào việc yêu thích.");
      } else {
        await jobApi.unsaveJob(jobId);
        toast.success("Đã bỏ yêu thích.");
      }
      if (!nextSaved) {
        setJobs((prev) =>
          (prev || []).filter((j) => Number(j?.JobID) !== Number(jobId))
        );
      } else {
        setJobs((prev) =>
          (prev || []).map((j) =>
            Number(j?.JobID) === Number(jobId) ? { ...j, HasSaved: true } : j
          )
        );
      }
    } catch (err) {
      console.error("Lỗi toggle save:", err);
      toast.error(
        err?.response?.data?.message || "Không thể cập nhật yêu thích."
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleApplyClick = (jobId) => {
    if (!jobId) return;
    const already = (jobs || []).some(
      (j) =>
        Number(j?.JobID) === Number(jobId) &&
        (j?.HasApplied === true || Number(j?.HasApplied) === 1)
    );
    if (already) return;
    setSelectedJobId(jobId);
    setIsCvModalOpen(true);
  };

  const handleCvSelect = async (cvId) => {
    if (!selectedJobId) return;
    setApplyingId(selectedJobId);
    try {
      const res = await jobApi.applyToJob(selectedJobId, { cvId });
      toast.success(res?.data?.message || "Ứng tuyển thành công.");
      setJobs((prev) =>
        (prev || []).map((j) =>
          Number(j?.JobID) === Number(selectedJobId)
            ? { ...j, HasApplied: true }
            : j
        )
      );
    } catch (err) {
      console.error("Lỗi apply:", err);
      toast.error(err?.response?.data?.message || "Không thể ứng tuyển.");
    } finally {
      setApplyingId(null);
      setSelectedJobId(null);
    }
  };

  return (
    <div className="max-w-6xl px-4 py-8 mx-auto">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="text-2xl font-bold text-gray-900">Việc yêu thích</div>
          <div className="mt-1 text-sm text-gray-600">
            Tổng số:{" "}
            <span className="font-semibold text-gray-900">
              {loading ? "…" : sorted.length}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
        >
          <FiRefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          <span>Làm mới</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh] text-gray-600">
          <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 shadow-sm rounded-xl">
            <FiRefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            <span>Đang tải danh sách việc yêu thích...</span>
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-10 text-center text-gray-600 bg-white border border-gray-100 shadow-sm rounded-xl">
          Bạn chưa yêu thích bài tuyển dụng nào.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((j) => {
            const hasApplied =
              j?.HasApplied === true || Number(j?.HasApplied) === 1;
            const hasSaved = j?.HasSaved === true || Number(j?.HasSaved) === 1;
            const applyDisabled = applyingId === j.JobID || hasApplied;
            return (
              <div
                key={j.JobID}
                className="flex flex-col p-4 bg-white border border-gray-100 shadow-sm rounded-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start flex-1 min-w-0 gap-3">
                    <div className="flex items-center justify-center w-16 h-16 overflow-hidden border border-gray-200 rounded-lg shrink-0 bg-gray-50">
                      {j.CompanyLogoURL ? (
                        <img
                          src={j.CompanyLogoURL}
                          alt={j.CompanyName || "Logo"}
                          className="object-cover w-full h-full"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full flex items-center justify-center text-gray-400 text-xs font-semibold ${
                          j.CompanyLogoURL ? "hidden" : ""
                        }`}
                      >
                        {j.CompanyName
                          ? j.CompanyName.charAt(0).toUpperCase()
                          : "—"}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-bold text-gray-900 line-clamp-2">
                        {j.JobTitle}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {j.CompanyName || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleSave(j.JobID, !hasSaved)}
                      disabled={savingId === j.JobID}
                      className={`h-10 w-10 rounded-full border flex items-center justify-center transition ${
                        hasSaved
                          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                          : "border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50"
                      }`}
                      title={hasSaved ? "Bỏ yêu thích" : "Yêu thích"}
                    >
                      <FiHeart className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 overflow-hidden max-w-[150px]">
                    <FiBriefcase className="w-3 h-3 shrink-0" />
                    <span className="min-w-0 truncate">
                      {j.SpecializationName || "—"}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 overflow-hidden max-w-[170px]">
                    <span className="min-w-0 truncate">
                      {renderSalary(j.SalaryMin, j.SalaryMax)}
                    </span>
                  </span>
                  {j.CompanyCity ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-100 overflow-hidden max-w-[130px]">
                      <FiMapPin className="w-3 h-3 shrink-0" />
                      <span className="min-w-0 truncate">{j.CompanyCity}</span>
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center justify-end pt-4 mt-auto">
                  <button
                    type="button"
                    onClick={() => handleApplyClick(j.JobID)}
                    disabled={applyDisabled}
                    className="inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    title={hasApplied ? "Bạn đã ứng tuyển công việc này" : ""}
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

      <CvSelectionModal
        isOpen={isCvModalOpen}
        onClose={() => {
          setIsCvModalOpen(false);
          setSelectedJobId(null);
        }}
        onSelect={handleCvSelect}
        jobTitle={
          selectedJobId
            ? jobs.find((j) => Number(j.JobID) === Number(selectedJobId))
                ?.JobTitle
            : null
        }
      />
    </div>
  );
}