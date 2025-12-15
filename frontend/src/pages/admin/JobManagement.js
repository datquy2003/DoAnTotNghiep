import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiEye, FiRefreshCw } from "react-icons/fi";
import { adminApi } from "../../api/adminApi";
import { renderSalary } from "../../utils/renderSalary";
import { formatDate } from "../../utils/formatDate";
import { formatDateOnly } from "../../utils/formatDateOnly";
import AdminJobDetailModal from "./components/AdminJobDetailModal";

const JobManagement = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [jobDetail, setJobDetail] = useState(null);

  const loadActiveJobs = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await adminApi.getActiveJobs();
      setJobs(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error("Lỗi load active jobs:", error);
      toast.error(
        error?.response?.data?.message ||
          "Không thể tải danh sách bài đang tuyển."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActiveJobs(false);
  }, []);

  const openDetail = async (jobId) => {
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

  const rows = useMemo(() => jobs, [jobs]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-bold text-gray-900">
            Quản lý bài tuyển dụng
          </div>
          <div className="text-sm text-gray-600">
            Tổng số:{" "}
            <span className="font-semibold text-gray-900">{rows.length}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadActiveJobs(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
        >
          <FiRefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
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
                  Chi tiết
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
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-sm text-center text-gray-500"
                  >
                    Không có bài nào đang tuyển.
                  </td>
                </tr>
              ) : (
                rows.map((j) => (
                  <tr key={j.JobID} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      <div className="line-clamp-2">{j.JobTitle}</div>
                      {j.Location ? (
                        <div className="mt-1 text-xs text-gray-600 line-clamp-1">
                          {j.Location}
                        </div>
                      ) : null}
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
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(j.CreatedAt) || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDateOnly(j.ExpiresAt) || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <button
                        title="Xem chi tiết"
                        onClick={() => openDetail(j.JobID)}
                        className="text-blue-700 hover:text-blue-900"
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
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
          setJobDetail(null);
        }}
      />
    </div>
  );
};

export default JobManagement;