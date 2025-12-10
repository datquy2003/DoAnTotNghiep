import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiStar,
  FiMapPin,
  FiUsers,
  FiEye,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { profileApi } from "../../api/profileApi";
import { categoryApi } from "../../api/categoryApi";
import { locationApi } from "../../api/locationApi";
import { vipApi } from "../../api/vipApi";
import { formatCurrency } from "../../utils/formatCurrency";
import { paymentApi } from "../../api/paymentApi";

const initialFilters = {
  ageUnder: "",
  specializationId: "",
  country: "",
  city: "",
};

const ApplicantManagement = () => {
  const [filters, setFilters] = useState(initialFilters);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [specializations, setSpecializations] = useState([]);
  const [specSearch, setSpecSearch] = useState("");
  const [specOpen, setSpecOpen] = useState(false);
  const specInputRef = useRef(null);
  const specWrapperRef = useRef(null);
  const countryWrapperRef = useRef(null);
  const cityWrapperRef = useRef(null);
  const countryInputRef = useRef(null);
  const cityInputRef = useRef(null);
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [countryOpen, setCountryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [detailCandidate, setDetailCandidate] = useState(null);
  const [revealLoadingId, setRevealLoadingId] = useState(null);
  const [purchaseModal, setPurchaseModal] = useState(null);
  const [oneTimePlans, setOneTimePlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  const filteredSpecs = useMemo(() => {
    if (!specSearch.trim()) return specializations;
    const term = specSearch.toLowerCase();
    return specializations.filter((s) =>
      s.SpecializationName.toLowerCase().includes(term)
    );
  }, [specSearch, specializations]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const term = countrySearch.toLowerCase();
    return countries.filter((c) => c.label.toLowerCase().includes(term));
  }, [countrySearch, countries]);

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return cities;
    const term = citySearch.toLowerCase();
    return cities.filter((c) => c.toLowerCase().includes(term));
  }, [citySearch, cities]);

  const handleRevealPhone = async (candidate) => {
    if (!candidate?.candidateId) return;
    setRevealLoadingId(candidate.candidateId);
    try {
      const res = await profileApi.revealCandidateContact(
        candidate.candidateId
      );
      const phone = res.data?.phoneNumber;
      if (!phone) {
        toast.error(
          res.data?.message ||
            "Không thể mở khóa số điện thoại, vui lòng thử lại."
        );
      } else {
        toast.success("Đã mở khóa số điện thoại.");
        setCandidates((prev) =>
          prev.map((c) =>
            c.candidateId === candidate.candidateId
              ? { ...c, phoneMasked: phone }
              : c
          )
        );
        setDetailCandidate((prev) =>
          prev?.candidateId === candidate.candidateId
            ? { ...prev, phoneMasked: phone }
            : prev
        );
      }
    } catch (error) {
      console.error("Lỗi mở khóa số điện thoại:", error);
      const status = error.response?.status;
      const message =
        error.response?.data?.message ||
        "Không thể mở khóa số điện thoại. Vui lòng thử lại.";
      if (status === 403) {
        setPurchaseModal({ candidate });
      } else {
        toast.error(message);
      }
    } finally {
      setRevealLoadingId(null);
    }
  };

  const renderDetailModal = () => {
    if (!detailCandidate) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-[1px] z-50 flex items-center justify-center px-4">
        <div className="w-full max-w-xl bg-white border border-gray-100 shadow-2xl rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Thông tin ứng viên
              </h3>
              <p className="text-sm text-gray-500">
                Họ tên: {detailCandidate.fullName || "—"}
              </p>
            </div>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setDetailCandidate(null)}
            >
              ✕
            </button>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm text-gray-800">
            <div className="flex justify-between gap-3">
              <span className="font-semibold text-gray-700">Ngày sinh</span>
              <span className="text-right">
                {detailCandidate?.birthday
                  ? new Date(detailCandidate?.birthday).toLocaleDateString(
                      "vi-VN",
                      {
                        timeZone: "UTC",
                      }
                    )
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="font-semibold text-gray-700">Chuyên môn</span>
              <span className="text-right">
                {detailCandidate.specializations?.length ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {[...detailCandidate.specializations]
                      .sort((a, b) =>
                        (a.name || "").localeCompare(b.name || "", "vi", {
                          sensitivity: "base",
                        })
                      )
                      .map((s) => (
                        <span
                          key={s.id || s.name}
                          className="px-3 py-1 text-xs font-medium text-blue-700 border border-blue-100 rounded-full bg-blue-50"
                        >
                          {s.name}
                        </span>
                      ))}
                  </div>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="font-semibold text-gray-700">Số điện thoại</span>
              <div className="flex items-center gap-2 text-right">
                <span>
                  {detailCandidate.phoneMasked ||
                    "Ứng viên này không có số điện thoại"}
                </span>
                {detailCandidate.phoneMasked?.includes("*") && (
                  <button
                    type="button"
                    onClick={() => handleRevealPhone(detailCandidate)}
                    className="px-3 py-1 text-xs font-semibold text-orange-700 border border-orange-100 rounded-lg bg-orange-50 hover:bg-orange-100 disabled:opacity-60"
                    disabled={revealLoadingId === detailCandidate.candidateId}
                  >
                    {revealLoadingId === detailCandidate.candidateId
                      ? "Đang mở…"
                      : "Mở khóa"}
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className="font-semibold text-gray-700">
                Giới thiệu bản thân
              </span>
              <p className="mt-1 text-gray-800 whitespace-pre-line">
                {detailCandidate.profileSummary || "—"}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-gray-700">CV</span>
              {detailCandidate.defaultCv ? (
                <a
                  href={detailCandidate.defaultCv.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {detailCandidate.defaultCv.name}
                </a>
              ) : (
                <span>Chưa có</span>
              )}
            </div>
          </div>
          <div className="flex justify-end px-5 py-4 border-t">
            <button
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              onClick={() => setDetailCandidate(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handlePurchaseFeature = async () => {
    if (!purchaseModal?.candidate) return;
    if (!selectedPlanId) {
      toast.error("Chưa tìm thấy gói ONE_TIME phù hợp. Vui lòng thử lại.");
      return;
    }
    try {
      const returnUrl = window.location.pathname + window.location.search;
      const metadata = {
        candidateName: purchaseModal.candidate.fullName || "",
        candidateId: purchaseModal.candidate.candidateId,
        featureKey: "EMPLOYER_REVEAL_PHONE",
      };
      const res = await paymentApi.createCheckoutSession(
        selectedPlanId,
        returnUrl,
        metadata
      );
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Không nhận được đường dẫn thanh toán Stripe.");
      }
    } catch (error) {
      console.error("Lỗi tạo phiên thanh toán:", error);
      toast.error(
        error.response?.data?.message ||
          "Không thể tạo phiên thanh toán. Vui lòng thử lại."
      );
    }
  };

  const renderPurchaseModal = () => {
    if (!purchaseModal?.candidate) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-[1px] z-50 flex items-center justify-center px-4">
        <div className="w-full max-w-lg bg-white border border-gray-100 shadow-2xl rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              Mở khóa số điện thoại
            </h3>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setPurchaseModal(null)}
            >
              ✕
            </button>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm text-gray-800">
            <p>
              Bạn cần mua để có thể hiển thị vĩnh viễn số điện thoại của ứng
              viên:
              <strong className="ml-1">
                {purchaseModal.candidate.fullName || "Ứng viên"}
              </strong>
            </p>
            <p className="text-gray-600">
              Sau khi thanh toán, số điện thoại sẽ được hiển thị ngay trong chi
              tiết ứng viên.
            </p>
            {oneTimePlans.length > 0 ? (
              <div className="p-3 border rounded-lg bg-gray-50">
                <select
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={selectedPlanId || ""}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                >
                  {oneTimePlans.map((p) => (
                    <option key={p.PlanID} value={p.PlanID}>
                      {p.PlanName} - {formatCurrency(p.Price || 0)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm text-red-600">
                Chưa tìm thấy gói ONE_TIME dành cho nhà tuyển dụng. Vui lòng cấu
                hình trong trang admin.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 px-5 py-4 border-t">
            <button
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              onClick={() => setPurchaseModal(null)}
            >
              Để sau
            </button>
            <button
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              onClick={handlePurchaseFeature}
            >
              Mua
            </button>
          </div>
        </div>
      </div>
    );
  };

  const loadCandidates = async (overrideFilters = filters) => {
    setFetching(true);
    try {
      const params = {};
      if (overrideFilters.ageUnder) params.ageUnder = overrideFilters.ageUnder;
      if (overrideFilters.specializationId)
        params.specializationId = overrideFilters.specializationId;
      if (overrideFilters.country) params.country = overrideFilters.country;
      if (overrideFilters.city) params.city = overrideFilters.city;

      const res = await profileApi.searchSearchableCandidates(params);
      setCandidates(res.data?.candidates || []);
      if (detailCandidate) {
        const updated = res.data?.candidates?.find(
          (c) => c.candidateId === detailCandidate.candidateId
        );
        if (updated) {
          setDetailCandidate(updated);
        }
      }
    } catch (error) {
      console.error("Lỗi lấy danh sách ứng viên:", error);
      toast.error(
        error.response?.data?.message ||
          "Không thể tải danh sách ứng viên. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
      setFetching(false);
    }
  };

  useEffect(() => {
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await locationApi.getCountries();
        const list = Array.isArray(res) ? res : res?.data || [];
        const sorted = [...list].sort((a, b) =>
          (a.label || "").localeCompare(b.label || "", "vi", {
            sensitivity: "base",
          })
        );
        setCountries(sorted);
      } catch (error) {
        console.error("Lỗi lấy danh sách quốc gia:", error);
      }
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    if (specOpen && specInputRef.current) {
      specInputRef.current.focus();
    }
  }, [specOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        specWrapperRef.current &&
        !specWrapperRef.current.contains(e.target)
      ) {
        setSpecOpen(false);
      }
      if (
        countryWrapperRef.current &&
        !countryWrapperRef.current.contains(e.target)
      ) {
        setCountryOpen(false);
        setCountrySearch("");
      }
      if (
        cityWrapperRef.current &&
        !cityWrapperRef.current.contains(e.target)
      ) {
        setCityOpen(false);
        setCitySearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSpecializations = async () => {
      try {
        const res = await categoryApi.getAllSpecializations();
        const list = Array.isArray(res.data) ? res.data : [];
        const normalize = (name) => (name || "").trim();
        const sorted = [...list].sort((a, b) =>
          normalize(a.SpecializationName).localeCompare(
            normalize(b.SpecializationName),
            "vi",
            { sensitivity: "base" }
          )
        );
        setSpecializations(sorted);
      } catch (error) {
        console.error("Lỗi lấy chuyên môn:", error);
      }
    };
    fetchSpecializations();
  }, []);

  useEffect(() => {
    const fetchOneTimePlans = async () => {
      try {
        const res = await vipApi.getVipPackages(3);
        const plans = Array.isArray(res.data)
          ? res.data.filter((p) => p.PlanType === "ONE_TIME")
          : [];
        setOneTimePlans(plans);
        setSelectedPlanId(plans[0]?.PlanID || null);
      } catch (error) {
        console.error("Lỗi tải gói ONE_TIME:", error);
      }
    };
    fetchOneTimePlans();
  }, []);

  const loadCities = async (countryObj) => {
    if (!countryObj) {
      setCities([]);
      return;
    }
    try {
      const isVietnam =
        (countryObj.code && countryObj.code.toUpperCase() === "VN") ||
        (countryObj.value || "").toLowerCase().includes("viet nam") ||
        (countryObj.value || "").toLowerCase().includes("vietnam");

      let list = [];
      if (isVietnam) {
        const res = await locationApi.getVietnamProvinces();
        list = Array.isArray(res) ? res : res?.data || [];
      } else {
        const res = await locationApi.getStates(countryObj.value);
        list = Array.isArray(res) ? res : res?.data || [];
      }

      const sorted = [...list]
        .map((c) => c.trim())
        .sort((a, b) =>
          (a || "").localeCompare(b || "", "vi", { sensitivity: "base" })
        );
      setCities(sorted);
    } catch (error) {
      console.error("Lỗi lấy danh sách thành phố:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    loadCandidates();
  };

  const handleReset = () => {
    setFilters(initialFilters);
    loadCandidates(initialFilters);
  };

  return (
    <div className="px-4 py-6 mx-auto max-w-7xl">
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Danh sách ứng viên hiện có
          </h1>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 mb-6 bg-white border border-gray-100 shadow-sm rounded-xl"
      >
        <div className="flex items-center gap-2 mb-3 font-semibold text-gray-700">
          <FiFilter /> Bộ lọc
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm text-gray-600">Tuổi</label>
            <input
              type="number"
              name="ageUnder"
              value={filters.ageUnder}
              onChange={handleChange}
              min={0}
              className="w-full px-3 py-2 mt-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập độ tuổi giới hạn..."
            />
          </div>
          <div className="relative" ref={specWrapperRef}>
            <label className="text-sm text-gray-600">Chuyên môn</label>
            <div
              className="flex items-center justify-between w-full gap-2 px-3 py-2 mt-1 bg-white border rounded-lg cursor-pointer"
              onClick={() => setSpecOpen((o) => !o)}
            >
              {specOpen ? (
                <input
                  ref={specInputRef}
                  type="text"
                  value={specSearch}
                  onChange={(e) => setSpecSearch(e.target.value)}
                  placeholder="Tìm chuyên môn..."
                  className="flex-1 text-sm text-gray-800 border-none focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm text-gray-800">
                  {specializations.find(
                    (s) =>
                      s.SpecializationID === Number(filters.specializationId)
                  )?.SpecializationName || "Chọn chuyên môn"}
                </span>
              )}
              <div className="flex items-center gap-2">
                {filters.specializationId && (
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-gray-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilters((prev) => ({ ...prev, specializationId: "" }));
                      setSpecSearch("");
                      setSpecOpen(false);
                    }}
                    title="Xóa chuyên môn đã chọn"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            {specOpen && (
              <div className="absolute z-20 w-full mt-1 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-lg max-h-64">
                <div className="overflow-y-auto max-h-60">
                  {filteredSpecs.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      Không tìm thấy
                    </div>
                  ) : (
                    filteredSpecs.map((s) => (
                      <button
                        type="button"
                        key={s.SpecializationID}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                          s.SpecializationID ===
                          Number(filters.specializationId)
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-gray-800"
                        }`}
                        onClick={() => {
                          setFilters((prev) => ({
                            ...prev,
                            specializationId: s.SpecializationID,
                          }));
                          setSpecSearch("");
                          setSpecOpen(false);
                        }}
                      >
                        {s.SpecializationName}
                      </button>
                    ))
                  )}
                </div>
                <div className="flex justify-end gap-3 p-2 text-sm border-t bg-gray-50">
                  <button
                    type="button"
                    className="text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      setSpecSearch("");
                      if (specInputRef.current) specInputRef.current.focus();
                    }}
                  >
                    Xóa tìm
                  </button>
                  <button
                    type="button"
                    className="text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, specializationId: "" }));
                      setSpecSearch("");
                      setSpecOpen(false);
                    }}
                  >
                    Xóa chọn
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="relative" ref={countryWrapperRef}>
            <label className="text-sm text-gray-600">Quốc gia</label>
            <div
              className="flex items-center justify-between w-full gap-2 px-3 py-2 mt-1 bg-white border rounded-lg cursor-pointer"
              onClick={() => setCountryOpen((o) => !o)}
            >
              {countryOpen ? (
                <input
                  ref={countryInputRef}
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Tìm quốc gia..."
                  className="flex-1 text-sm text-gray-800 border-none focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm text-gray-800">
                  {filters.country || "Chọn quốc gia"}
                </span>
              )}
              {(filters.country || countrySearch) && (
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilters((prev) => ({ ...prev, country: "", city: "" }));
                    setCountrySearch("");
                    setCities([]);
                    setCountryOpen(false);
                    setCityOpen(false);
                  }}
                  title="Xóa quốc gia"
                >
                  ✕
                </button>
              )}
            </div>
            {countryOpen && (
              <div className="absolute z-20 w-full mt-1 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-lg max-h-64">
                <div className="overflow-y-auto max-h-60">
                  {filteredCountries.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      Không tìm thấy
                    </div>
                  ) : (
                    filteredCountries.map((c) => (
                      <button
                        type="button"
                        key={c.value}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                          c.label === filters.country
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-gray-800"
                        }`}
                        onClick={() => {
                          setFilters((prev) => ({
                            ...prev,
                            country: c.label,
                            city: "",
                          }));
                          setCountrySearch("");
                          setCountryOpen(false);
                          setCityOpen(false);
                          setCitySearch("");
                          loadCities(c);
                        }}
                      >
                        {c.label}
                      </button>
                    ))
                  )}
                </div>
                <div className="flex justify-end gap-3 p-2 text-sm border-t bg-gray-50">
                  <button
                    type="button"
                    className="text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      setCountrySearch("");
                      if (countryInputRef.current)
                        countryInputRef.current.focus();
                    }}
                  >
                    Xóa tìm
                  </button>
                  <button
                    type="button"
                    className="text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      setFilters((prev) => ({
                        ...prev,
                        country: "",
                        city: "",
                      }));
                      setCountrySearch("");
                      setCities([]);
                      setCountryOpen(false);
                      setCityOpen(false);
                    }}
                  >
                    Xóa chọn
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="relative" ref={cityWrapperRef}>
            <label className="text-sm text-gray-600">Thành phố</label>
            <div
              className={`mt-1 w-full border rounded-lg px-3 py-2 bg-white flex items-center justify-between cursor-pointer gap-2 ${
                !filters.country ? "opacity-60 cursor-not-allowed" : ""
              }`}
              onClick={() => {
                if (!filters.country) return;
                if (cities.length === 0) return;
                setCityOpen((o) => !o);
              }}
            >
              {cities.length === 0 ? (
                <input
                  type="text"
                  name="city"
                  value={filters.city}
                  onChange={(e) => {
                    if (!filters.country) return;
                    setFilters((prev) => ({ ...prev, city: e.target.value }));
                  }}
                  placeholder="Nhập thành phố..."
                  className="w-full text-sm text-gray-800 border-none focus:outline-none"
                  disabled={!filters.country}
                />
              ) : cityOpen ? (
                <input
                  ref={cityInputRef}
                  type="text"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="Tìm thành phố..."
                  className="flex-1 text-sm text-gray-800 border-none focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                  disabled={!filters.country}
                />
              ) : (
                <span className="text-sm text-gray-800">
                  {filters.city || "Chọn thành phố"}
                </span>
              )}
              {(filters.city || citySearch) && (
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!filters.country) return;
                    setFilters((prev) => ({ ...prev, city: "" }));
                    setCitySearch("");
                    setCityOpen(false);
                  }}
                  title="Xóa thành phố"
                  disabled={!filters.country}
                >
                  ✕
                </button>
              )}
            </div>
            {cityOpen && cities.length > 0 && (
              <div className="absolute z-20 w-full mt-1 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-lg max-h-64">
                <div className="overflow-y-auto max-h-60">
                  {filteredCities.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      Không tìm thấy
                    </div>
                  ) : (
                    filteredCities.map((c) => (
                      <button
                        type="button"
                        key={c}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                          c === filters.city
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-gray-800"
                        }`}
                        onClick={() => {
                          setFilters((prev) => ({
                            ...prev,
                            city: c,
                          }));
                          setCitySearch("");
                          setCityOpen(false);
                        }}
                      >
                        {c}
                      </button>
                    ))
                  )}
                </div>
                <div className="flex justify-end gap-3 p-2 text-sm border-t bg-gray-50">
                  <button
                    type="button"
                    className="text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      setCitySearch("");
                      if (cityInputRef.current) cityInputRef.current.focus();
                    }}
                  >
                    Xóa tìm
                  </button>
                  <button
                    type="button"
                    className="text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, city: "" }));
                      setCitySearch("");
                      setCityOpen(false);
                    }}
                  >
                    Xóa chọn
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
            disabled={fetching}
          >
            <FiSearch />
            {fetching ? "Đang lọc..." : "Áp dụng"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            disabled={fetching}
          >
            <FiRefreshCw />
            Xóa lọc
          </button>
        </div>
      </form>

      <div className="overflow-hidden bg-white border border-gray-100 shadow-sm rounded-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 font-semibold text-gray-700">
            <FiUsers />
            <span>
              Ứng viên tìm thấy:{" "}
              <span className="text-blue-600">{candidates.length}</span>
            </span>
          </div>
          {fetching && (
            <span className="text-sm text-gray-500">Đang tải dữ liệu…</span>
          )}
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Đang tải...</div>
        ) : candidates.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Không có ứng viên phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-3/12 px-4 py-3 text-sm font-semibold text-left text-gray-700">
                    Họ tên
                  </th>
                  <th className="w-1/12 px-4 py-3 text-sm font-semibold text-left text-gray-700">
                    Tuổi
                  </th>
                  <th className="w-2/12 px-4 py-3 text-sm font-semibold text-left text-gray-700">
                    Địa điểm
                  </th>
                  <th className="w-4/12 px-4 py-3 text-sm font-semibold text-left text-gray-700">
                    Chuyên môn
                  </th>
                  <th className="w-1/12 px-4 py-3 text-sm font-semibold text-left text-right text-gray-700">
                    Chi tiết
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidates.map((c) => (
                  <tr key={c.candidateId} className="hover:bg-gray-50">
                    <td className="w-3/12 px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {c.fullName || "Ẩn danh"}
                          </span>
                          {c.isVip && (
                            <FiStar size={14} className="text-yellow-500" />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="w-1/12 px-4 py-3 align-top">
                      <div className="font-medium text-gray-800">
                        {c.age ?? "—"}
                      </div>
                    </td>
                    <td className="w-2/12 px-4 py-3 align-top">
                      <div className="flex items-center gap-1 text-sm text-gray-700">
                        <FiMapPin className="text-gray-500" />
                        <span>
                          {[c.city, c.country].filter(Boolean).join(", ") ||
                            "—"}
                        </span>
                      </div>
                    </td>
                    <td className="w-4/12 px-4 py-3 align-top">
                      {c.specializations?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {[...c.specializations]
                            .sort((a, b) =>
                              (a.name || "").localeCompare(b.name || "", "vi", {
                                sensitivity: "base",
                              })
                            )
                            .map((s) => (
                              <span
                                key={s.id || s.name}
                                className="px-3 py-1 text-xs font-medium text-blue-700 border border-blue-100 rounded-full bg-blue-50"
                              >
                                {s.name}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </td>
                    <td className="w-1/12 px-4 py-3 text-right align-top">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm text-blue-700 border border-blue-100 rounded-lg bg-blue-50 hover:bg-blue-100"
                        onClick={() => setDetailCandidate(c)}
                      >
                        <FiEye />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {renderDetailModal()}
      {renderPurchaseModal()}
    </div>
  );
};

export default ApplicantManagement;