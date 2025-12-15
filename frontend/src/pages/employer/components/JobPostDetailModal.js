import React, { useMemo } from "react";
import { STATUS_CONFIG } from "../../../constants/statusConfig";
import { renderSalary } from "../../../utils/renderSalary";
import { renderJobPostRichText } from "../../../utils/jobPostRichText";

const renderDateOnly = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", { timeZone: "UTC" });
};

export default function JobPostDetailModal({
  open,
  job,
  categories,
  specMap,
  onClose,
}) {
  const workingTimes = useMemo(() => {
    if (!job) return [];
    let wt = job.WorkingTimes;
    if (typeof wt === "string") {
      try {
        wt = JSON.parse(wt);
      } catch (e) {
        wt = [];
      }
    }
    const arr = Array.isArray(wt) ? wt : [];
    const meaningful = arr
      .map((x) => ({
        dayFrom: (x?.dayFrom || "").toString().trim(),
        dayTo: (x?.dayTo || "").toString().trim(),
        timeFrom: (x?.timeFrom || "").toString().trim(),
        timeTo: (x?.timeTo || "").toString().trim(),
        id: x?.id,
      }))
      .filter((x) => x.dayFrom || x.dayTo || x.timeFrom || x.timeTo);
    return meaningful;
  }, [job]);

  const leftRows = useMemo(() => {
    if (!job) return [];
    return [
      {
        label: "Danh mục",
        value:
          (categories || []).find(
            (c) => String(c.CategoryID) === String(job.CategoryID)
          )?.CategoryName || "—",
      },
      { label: "Mức lương", value: renderSalary(job.SalaryMin, job.SalaryMax) },
      { label: "Trình độ học vấn", value: job.EducationLevel || "—" },
      { label: "Vị trí công việc", value: job.JobType || "—" },
      { label: "Địa điểm", value: job.Location || "—" },
      {
        label: "Thời gian làm việc",
        value:
          workingTimes.length > 0 ? (
            <div className="space-y-1">
              {workingTimes.map((wt, idx) => (
                <div
                  key={wt?.id ?? idx}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="px-2 py-1 text-blue-700 border border-blue-100 rounded-full bg-blue-50">
                    {wt.dayFrom || "—"}
                    {wt.dayTo && wt.dayTo !== wt.dayFrom
                      ? ` - ${wt.dayTo}`
                      : ""}
                  </span>
                  <span className="px-2 py-1 text-green-700 border border-green-100 rounded-full bg-green-50">
                    {wt.timeFrom || "—"} {wt.timeTo ? `- ${wt.timeTo}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            "Thời gian làm việc linh hoạt"
          ),
      },
      {
        label: "Số ứng viên đã ứng tuyển",
        value:
          job.AppliedCount ?? job.ApplicantCount ?? job.TotalApplicants ?? "—",
      },
    ];
  }, [job, categories, workingTimes]);

  const rightRows = useMemo(() => {
    if (!job) return [];
    return [
      { label: "Chuyên môn", value: specMap?.[job.SpecializationID] || "—" },
      { label: "Kinh nghiệm", value: job.Experience || "—" },
      {
        label: "Số lượng tuyển dụng",
        value: job.VacancyCount || "—",
      },
      {
        label: "Trạng thái",
        value: STATUS_CONFIG[job.Status]?.label || `Trạng thái ${job.Status}`,
      },
    ];
  }, [job, specMap]);

  if (!open || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-white border border-gray-100 shadow-2xl rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Chi tiết bài đăng
            </h3>
          </div>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6 space-y-6 text-sm text-gray-800 max-h-[80vh] overflow-y-auto">
          <div className="text-xl font-bold text-gray-900">
            <span className="font-semibold text-gray-700">Tiêu đề:</span>{" "}
            {job.JobTitle || "—"}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            <div className="space-y-3">
              {leftRows.map((row) => (
                <div key={row.label} className="flex items-start gap-2">
                  <span className="font-semibold text-gray-700 min-w-[140px]">
                    {row.label}:
                  </span>
                  <span className="flex-1 text-gray-900">
                    {typeof row.value === "string" ? row.value : row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {rightRows.map((row) => (
                <div key={row.label} className="flex items-start gap-2">
                  <span className="font-semibold text-gray-700 min-w-[140px]">
                    {row.label}:
                  </span>
                  <span className="flex-1 text-gray-900">
                    {row.label === "Chuyên môn" &&
                    row.value &&
                    row.value !== "—" ? (
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100 inline-block max-w-[320px] whitespace-normal text-left">
                        {row.value}
                      </span>
                    ) : (
                      row.value || "—"
                    )}
                  </span>
                </div>
              ))}
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
                    Hết hạn lúc:
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold text-left text-gray-700">
                    Đẩy top lúc:
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 text-gray-900">
                    {renderDateOnly(job?.CreatedAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {renderDateOnly(job?.ApprovedAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {renderDateOnly(job?.ExpiresAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {renderDateOnly(job?.LastPushedAt)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
}