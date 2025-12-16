import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiBriefcase, FiMapPin, FiRefreshCw } from "react-icons/fi";
import { jobApi } from "../../api/jobApi";
import { renderSalary } from "../../utils/renderSalary";
import { formatDate } from "../../utils/formatDate";
import { APPLIED_STATUS } from "../../constants/appliedStatus";

export default function AppliedJobs() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await jobApi.getAppliedJobs();
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("Lỗi load applied jobs:", err);
      toast.error(
        err?.response?.data?.message || "Không thể tải danh sách đã ứng tuyển."
      );
      setItems([]);
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
    return [...(items || [])].sort(
      (a, b) => toTime(b?.AppliedAt) - toTime(a?.AppliedAt)
    );
  }, [items]);

  return (
    <div className="max-w-6xl px-4 py-8 mx-auto">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            Việc đã ứng tuyển
          </div>
          <div className="mt-1 text-sm text-gray-600">
            Tổng số:{" "}
            <span className="font-semibold text-gray-900">{sorted.length}</span>
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
          Làm mới
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-600 bg-white border border-gray-100 shadow-sm rounded-xl">
          Đang tải danh sách...
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-10 text-center text-gray-600 bg-white border border-gray-100 shadow-sm rounded-xl">
          Bạn chưa ứng tuyển công việc nào.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sorted.map((x) => {
            const st = APPLIED_STATUS[Number(x?.CurrentStatus)] || {
              label: `Trạng thái ${x?.CurrentStatus ?? "—"}`,
              className: "bg-gray-50 text-gray-700 border-gray-100",
            };
            return (
              <div
                key={x.ApplicationID}
                className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-gray-900 line-clamp-2">
                      {x.JobTitle || "—"}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-700">
                      {x.CompanyName || "—"}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${st.className}`}
                  >
                    {st.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mt-3 text-sm">
                  <span className="inline-flex items-center gap-2 px-3 py-1 border rounded-full bg-emerald-50 text-emerald-700 border-emerald-100">
                    {renderSalary(x.SalaryMin, x.SalaryMax)}
                  </span>
                  {x.Location ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1 text-gray-700 border border-gray-100 rounded-full bg-gray-50">
                      <FiMapPin className="w-4 h-4" />
                      <span className="line-clamp-1">{x.Location}</span>
                    </span>
                  ) : null}
                  {x.SpecializationName ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1 text-blue-700 border border-blue-100 rounded-full bg-blue-50">
                      <FiBriefcase className="w-4 h-4" />
                      {x.SpecializationName}
                    </span>
                  ) : null}
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">Ứng tuyển lúc</span>
                  <span className="text-gray-900 ">
                    {x.AppliedAt ? formatDate(x.AppliedAt) : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}