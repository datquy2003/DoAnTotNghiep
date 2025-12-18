import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { FiCalendar, FiRefreshCw } from "react-icons/fi";
import { adminApi } from "../../../api/adminApi";
import { RANGE_OPTIONS } from "../../../constants/rangeOptions";
import { formatDateOnly } from "../../../utils/formatDateOnly";
import { sliceColor } from "../../../utils/sliceColor";
import ChartLegendVertical from "../../../components/charts/ChartLegendVertical";

const formatBarLabel = (label, granularity) => {
  if (!label) return "";
  if (granularity === "month") {
    const [y, m] = String(label).split("-");
    return `${m}/${y}`;
  }
  const parts = String(label).split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return String(label);
};

const formatBarLabelFull = (label, granularity) => {
  if (!label) return "";
  if (granularity === "month") {
    const [y, m] = String(label).split("-");
    return `${m}/${y}`;
  }
  const parts = String(label).split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return String(label);
};

const TooltipCount = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  const fullLabel = payload?.[0]?.payload?.labelFull || label;
  return (
    <div className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="font-semibold text-gray-900">{fullLabel}</div>
      <div className="text-gray-700">Bài viết mới: {val}</div>
    </div>
  );
};

const renderLegend = (valueFormatter) => (props) =>
  <ChartLegendVertical {...props} valueFormatter={valueFormatter} />;

export default function NewPostsStats() {
  return <NewPostsStatsInner />;
}

function NewPostsStatsInner() {
  const [range, setRange] = useState("1m");
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = range === "year" ? { range, year } : { range };
      const res = await adminApi.getNewPostsReport(params);
      setData(res?.data || null);
    } catch (err) {
      console.error("Lỗi load new posts report:", err);
      toast.error(
        err?.response?.data?.message || "Không thể tải thống kê bài viết mới."
      );
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, year]);

  const barData = useMemo(() => {
    const bar = data?.bar || [];
    const granularity = data?.granularity || "day";
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    return (Array.isArray(bar) ? bar : [])
      .filter((x) => {
        if (granularity === "month") return true;
        const label = String(x?.label || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(label)) return true;
        return label <= todayKey;
      })
      .map((x) => ({
        ...x,
        labelShort: formatBarLabel(x.label, granularity),
        labelFull: formatBarLabelFull(x.label, granularity),
      }));
  }, [data]);

  const pieData = useMemo(
    () => (Array.isArray(data?.pieCategories) ? data.pieCategories : []),
    [data]
  );

  const pieSpecData = useMemo(
    () =>
      Array.isArray(data?.pieSpecializations) ? data.pieSpecializations : [],
    [data]
  );

  const rangeLabel = useMemo(() => {
    if (loading) return "…";
    if (barData.length > 0) {
      const start = barData[0]?.labelFull || barData[0]?.labelShort || "—";
      const end =
        barData[barData.length - 1]?.labelFull ||
        barData[barData.length - 1]?.labelShort ||
        "—";
      return `${start} → ${end}`;
    }
    return `${formatDateOnly(data?.startDate)} → ${formatDateOnly(
      data?.endDate
    )}`;
  }, [barData, data?.endDate, data?.startDate, loading]);

  return (
    <div className="w-full">
      <div className="text-2xl font-bold text-gray-900">Bài viết mới</div>

      <div className="p-4 mt-6 bg-white border border-gray-100 shadow-sm rounded-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                className={
                  range === opt.key
                    ? "px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold"
                    : "px-3 py-2 rounded-lg bg-gray-50 text-gray-700 text-sm font-semibold hover:bg-gray-100"
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {range === "year" && (
              <>
                <FiCalendar className="text-gray-600" />
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg"
                >
                  {Array.from({ length: 6 }, (_, i) => {
                    const y = new Date().getFullYear() - i;
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </>
            )}

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
        </div>

        <div className="grid grid-cols-1 gap-3 mt-4 md:grid-cols-2">
          <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
            <div className="text-sm text-gray-600">Tổng bài viết mới</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {loading ? "…" : Number(data?.totalNewPosts || 0)}
            </div>
          </div>
          <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
            <div className="text-sm text-gray-600">Khoảng thời gian</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {rangeLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 mt-6 lg:grid-cols-2">
        <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl lg:order-2">
          <div className="text-lg font-bold text-gray-900">
            Bài viết mới theo thời gian
          </div>
          <div className="mt-4 h-[360px]">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-600">
                Đang tải biểu đồ...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="labelShort"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip content={<TooltipCount />} />
                  <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl lg:order-1">
          <div className="text-lg font-bold text-gray-900">
            Cơ cấu theo danh mục
          </div>
          <div className="mt-4 h-[360px]">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-600">
                Đang tải biểu đồ...
              </div>
            ) : pieData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600">
                Không có dữ liệu trong khoảng thời gian này.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={false}
                    labelLine={false}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={sliceColor(idx)} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    content={renderLegend((v) => Number(v || 0))}
                    wrapperStyle={{ right: 0 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 mt-4 lg:grid-cols-2">
        <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl">
          <div className="text-lg font-bold text-gray-900">
            Cơ cấu theo chuyên môn
          </div>
          <div className="mt-4 h-[360px]">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-600">
                Đang tải biểu đồ...
              </div>
            ) : pieSpecData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600">
                Không có dữ liệu trong khoảng thời gian này.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieSpecData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={false}
                    labelLine={false}
                  >
                    {pieSpecData.map((_, idx) => (
                      <Cell key={idx} fill={sliceColor(idx)} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    content={renderLegend((v) => Number(v || 0))}
                    wrapperStyle={{ right: 0 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}