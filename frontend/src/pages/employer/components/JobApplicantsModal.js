import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { FiExternalLink, FiRefreshCw, FiUsers } from "react-icons/fi";
import { jobApi } from "../../../api/jobApi";
import { formatDate } from "../../../utils/formatDate";

const JobApplicantsModal = ({ open, job, onClose }) => {
  const jobId = job?.JobID;
  const jobTitle = job?.JobTitle || "";

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ total: 0, applicants: [] });

  const load = async (isRefresh = false) => {
    if (!jobId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await jobApi.getJobApplicants(jobId);
      const payload = res?.data || {};
      setData({
        total:
          payload.total ??
          (Array.isArray(payload.applicants) ? payload.applicants.length : 0),
        applicants: Array.isArray(payload.applicants) ? payload.applicants : [],
      });
    } catch (err) {
      console.error("Lỗi load applicants:", err);
      toast.error(
        err?.response?.data?.message || "Không thể tải danh sách ứng viên."
      );
      setData({ total: 0, applicants: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId]);

  const sorted = useMemo(() => {
    const toTime = (v) => {
      const t = new Date(v).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    return [...(data.applicants || [])].sort(
      (a, b) => toTime(b?.appliedAt) - toTime(a?.appliedAt)
    );
  }, [data.applicants]);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black bg-opacity-40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl overflow-hidden bg-white border border-gray-100 shadow-2xl rounded-2xl">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FiUsers className="w-5 h-5 text-blue-600" />
              <div className="text-lg font-bold text-gray-900">
                Ứng viên đã ứng tuyển
              </div>
            </div>
            <div className="mt-1 text-sm text-gray-600 line-clamp-2">
              {jobTitle ? jobTitle : `JobID: ${jobId || "—"}`}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Tổng số:{" "}
              <span className="font-semibold text-gray-900">
                {loading ? "…" : data.total}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
            >
              <FiRefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Làm mới
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="py-10 text-center text-gray-600">
              Đang tải danh sách ứng viên...
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-10 text-center text-gray-600">
              Chưa có ứng viên nào ứng tuyển.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      Ứng viên
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      Email
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      SĐT
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      Thời gian
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase">
                      CV
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map((a) => (
                    <tr key={a.applicationId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {a.fullName || a.candidateId || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {a.candidateEmail || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {a.phoneNumber || a.phoneMasked || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {a.appliedAt ? formatDate(a.appliedAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {a.cv?.url ? (
                          <a
                            href={a.cv.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                          >
                            <FiExternalLink className="w-4 h-4" />
                            {a.cv.name || "Xem CV"}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default JobApplicantsModal;