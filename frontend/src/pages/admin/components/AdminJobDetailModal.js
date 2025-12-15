import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import { renderSalary } from "../../../utils/renderSalary";
import { renderJobPostRichText } from "../../../utils/jobPostRichText";
import { STATUS_CONFIG } from "../../../constants/statusConfig";
import { formatDateOnly } from "../../../utils/formatDateOnly";
import { formatDate } from "../../../utils/formatDate";

export default function AdminJobDetailModal({ open, job, loading, onClose }) {
  const workingTimes = useMemo(() => {
    const raw = job?.WorkingTimes;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }, [job]);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl overflow-hidden bg-white border border-gray-100 shadow-2xl rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Chi tiết bài đăng
            </h3>
            {job?.CompanyName ? (
              <div className="mt-1 text-sm text-gray-700">
                Công ty:{" "}
                <span className="font-semibold text-gray-900">
                  {job.CompanyName}
                </span>
              </div>
            ) : null}
          </div>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6 space-y-6 text-sm text-gray-800 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="text-sm text-gray-600">Đang tải...</div>
          ) : !job ? (
            <div className="text-sm text-gray-600">Không có dữ liệu.</div>
          ) : (
            <>
              <div className="text-xl font-bold text-gray-900">
                <span className="font-semibold text-gray-700">Tiêu đề:</span>{" "}
                {job.JobTitle || "—"}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-700 min-w-[140px]">
                      Danh mục:
                    </span>
                    <span className="flex-1 text-gray-900">
                      {job.CategoryName || "—"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-700 min-w-[140px]">
                      Mức lương:
                    </span>
                    <span className="flex-1 text-gray-900">
                      {renderSalary(job.SalaryMin, job.SalaryMax)}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-700 min-w-[140px]">
                      Trình độ học vấn:
                    </span>
                    <span className="flex-1 text-gray-900">
                      {job.EducationLevel || "—"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-700 min-w-[140px]">
                      Vị trí công việc:
                    </span>
                    <span className="flex-1 text-gray-900">
                      {job.JobType || "—"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-700 min-w-[140px]">
                      Địa điểm:
                    </span>
                    <span className="flex-1 text-gray-900">
                      {job.Location || "—"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-700 min-w-[140px]">
                      Thời gian làm việc:
                    </span>
                    <span className="flex-1 text-gray-900">
                      {workingTimes.length > 0 ? (
                        <div className="space-y-1">
                          {workingTimes.map((wt, idx) => (
                            <div
                              key={wt?.shiftGroupId || idx}
                              className="flex flex-wrap items-center gap-2 text-sm"
                            >
                              <span className="px-2 py-1 text-blue-700 border border-blue-100 rounded-full bg-blue-50">
                                {wt.dayFrom || "—"}
                                {wt.dayTo && wt.dayTo !== wt.dayFrom
                                  ? ` - ${wt.dayTo}`
                                  : ""}
                              </span>
                              <span className="px-2 py-1 text-green-700 border border-green-100 rounded-full bg-green-50">
                                {wt.timeFrom || "—"}{" "}
                                {wt.timeTo ? `- ${wt.timeTo}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        "Thời gian làm việc linh hoạt"
                      )}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-700 min-w-[140px]">
                      Chuyên môn:
                    </span>
                    <span className="flex-1 text-gray-900">
                      {job.SpecializationName ? (
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100 inline-block max-w-[320px] whitespace-normal text-left">
                          {job.SpecializationName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-700 min-w-[140px]">
                      Kinh nghiệm:
                    </span>
                    <span className="flex-1 text-gray-900">
                      {job.Experience || "—"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-700 min-w-[140px]">
                      Số lượng tuyển dụng:
                    </span>
                    <span className="flex-1 text-gray-900">
                      {job.VacancyCount || "—"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-700 min-w-[140px]">
                      Trạng thái:
                    </span>
                    <span className="flex-1 text-gray-900">
                      {STATUS_CONFIG[job.Status]?.label ||
                        `Trạng thái ${job.Status}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="font-semibold text-gray-700">
                    Mô tả công việc:
                  </div>
                  <div className="min-h-[120px] rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900">
                    {renderJobPostRichText(job?.JobDescription)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold text-gray-700">Yêu cầu:</div>
                  <div className="min-h-[120px] rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900">
                    {renderJobPostRichText(job?.Requirements)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold text-gray-700">Phúc lợi:</div>
                  <div className="min-h-[100px] rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900">
                    {renderJobPostRichText(job?.Benefits)}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-gray-700">
                        Tạo lúc:
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-gray-700">
                        Được duyệt lúc:
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-gray-700">
                        Hết hạn:
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-gray-700">
                        Đẩy top lúc:
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 text-gray-900">
                        {formatDate(job?.CreatedAt) || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {formatDate(job?.ApprovedAt) || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {formatDateOnly(job?.ExpiresAt) || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {formatDate(job?.LastPushedAt) || "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t">
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}