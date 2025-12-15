import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiCheckCircle, FiEye, FiRefreshCw, FiXCircle } from "react-icons/fi";
import { adminApi } from "../../api/adminApi";
import { formatDate } from "../../utils/formatDate";
import { renderSalary } from "../../utils/renderSalary";
import { formatDateOnly } from "../../utils/formatDateOnly";
import ConfirmationModal from "../../components/modals/ConfirmationModal";
import AdminJobDetailModal from "./components/AdminJobDetailModal";

const JobApproval = () => {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [jobDetail, setJobDetail] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    isDanger: false,
    confirmText: "Xác nhận",
  });

  const loadPending = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getPendingJobs();
      setJobs(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error("Lỗi load pending jobs:", error);
      toast.error(
        error?.response?.data?.message ||
          "Không thể tải danh sách bài chờ duyệt."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const pendingCount = jobs.length;

  const openDetail = async (jobId) => {
    setSelectedJobId(jobId);
    setDetailOpen(true);
    setDetailLoading(true);
    setJobDetail(null);
    try {
      const res = await adminApi.getJobDetail(jobId);
      setJobDetail(res?.data || null);
    } catch (error) {
      console.error("Lỗi load job detail:", error);
      toast.error(
        error?.response?.data?.message || "Không thể tải chi tiết bài đăng."
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const approve = (jobId) => {
    setConfirmModal({
      isOpen: true,
      title: "Duyệt bài đăng",
      message: "Bạn chắc chắn muốn duyệt bài tuyển dụng này?",
      confirmText: "Duyệt",
      isDanger: false,
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, isOpen: false }));
        setActingId(jobId);
        try {
          const res = await adminApi.approveJob(jobId);
          toast.success(res?.data?.message || "Đã duyệt bài đăng.");
          setJobs((prev) => prev.filter((j) => j.JobID !== jobId));
          if (selectedJobId === jobId) {
            setDetailOpen(false);
            setSelectedJobId(null);
            setJobDetail(null);
          }
        } catch (error) {
          console.error("Lỗi duyệt job:", error);
          toast.error(
            error?.response?.data?.message || "Không thể duyệt bài đăng."
          );
        } finally {
          setActingId(null);
        }
      },
    });
  };

  const reject = (jobId) => {
    setConfirmModal({
      isOpen: true,
      title: "Từ chối bài đăng",
      message: "Bạn chắc chắn muốn từ chối bài tuyển dụng này?",
      confirmText: "Từ chối",
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, isOpen: false }));
        setActingId(jobId);
        try {
          const res = await adminApi.rejectJob(jobId);
          toast.success(res?.data?.message || "Đã từ chối bài đăng.");
          setJobs((prev) => prev.filter((j) => j.JobID !== jobId));
          if (selectedJobId === jobId) {
            setDetailOpen(false);
            setSelectedJobId(null);
            setJobDetail(null);
          }
        } catch (error) {
          console.error("Lỗi reject job:", error);
          toast.error(
            error?.response?.data?.message || "Không thể từ chối bài đăng."
          );
        } finally {
          setActingId(null);
        }
      },
    });
  };

  const tableRows = useMemo(() => jobs, [jobs]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-bold text-gray-900">
            Duyệt bài tuyển dụng
          </div>
          <div className="text-sm text-gray-600">
            Đang chờ duyệt:{" "}
            <span className="font-semibold text-gray-900">{pendingCount}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={loadPending}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span>Làm mới</span>
        </button>
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
                  Công ty
                </th>
                <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                  Mức lương
                </th>
                <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                  Chuyên môn
                </th>
                <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                  Ngày tạo
                </th>
                <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                  Hết hạn
                </th>
                <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-sm text-center text-gray-500"
                  >
                    Đang tải...
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-sm text-center text-gray-500"
                  >
                    Không có bài đăng chờ duyệt.
                  </td>
                </tr>
              ) : (
                tableRows.map((j) => (
                  <tr key={j.JobID} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      <div className="line-clamp-2">{j.JobTitle}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {j.CompanyName || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {renderSalary(j.SalaryMin, j.SalaryMax)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {j.SpecializationName ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          {j.SpecializationName}
                        </span>
                      ) : (
                        <span className="text-center text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(j.CreatedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDateOnly(j.ExpiresAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <button
                          title="Xem chi tiết"
                          onClick={() => openDetail(j.JobID)}
                          className="text-blue-700 hover:text-blue-900"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button
                          title="Duyệt"
                          onClick={() => approve(j.JobID)}
                          disabled={actingId === j.JobID}
                          className={`text-emerald-700 hover:text-emerald-900 ${
                            actingId === j.JobID
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          <FiCheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          title="Từ chối"
                          onClick={() => reject(j.JobID)}
                          disabled={actingId === j.JobID}
                          className={`text-red-700 hover:text-red-900 ${
                            actingId === j.JobID
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          <FiXCircle className="w-4 h-4" />
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

      <AdminJobDetailModal
        open={detailOpen}
        job={jobDetail}
        loading={detailLoading}
        onClose={() => {
          setDetailOpen(false);
          setSelectedJobId(null);
          setJobDetail(null);
        }}
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

export default JobApproval;