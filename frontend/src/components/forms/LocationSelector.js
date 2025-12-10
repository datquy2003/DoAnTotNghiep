import React, { useState, useEffect } from "react";
import { locationApi } from "../../api/locationApi";
import { FiMapPin, FiLoader, FiGlobe } from "react-icons/fi";

const LocationSelector = ({ selectedCountry, selectedCity, onChange }) => {
  const [countriesObj, setCountriesObj] = useState([]);
  const [provinces, setProvinces] = useState([]);

  const [loadingCountry, setLoadingCountry] = useState(false);
  const [loadingProvince, setLoadingProvince] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      setLoadingCountry(true);
      try {
        const data = await locationApi.getCountries();
        if (isMounted) {
          setCountriesObj(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) setLoadingCountry(false);
      }
    };
    initData();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchProvinces = async () => {
      if (!selectedCountry) {
        setProvinces([]);
        return;
      }

      setLoadingProvince(true);
      try {
        const countryData = countriesObj.find(
          (c) => c.label === selectedCountry
        );

        let list = [];

        if (
          selectedCountry === "Việt Nam" ||
          (countryData && countryData.code === "VN")
        ) {
          list = await locationApi.getVietnamProvinces();
        } else if (countryData) {
          list = await locationApi.getStates(countryData.value);
        }

        if (isMounted) {
          setProvinces(list);

          if (list.length > 0 && selectedCity && !list.includes(selectedCity)) {
            onChange("City", "");
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) setLoadingProvince(false);
      }
    };

    if (countriesObj.length > 0) {
      fetchProvinces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry, countriesObj]);

  const handleCountryChange = (e) => {
    const newCountry = e.target.value;
    onChange("Country", newCountry);
    onChange("City", "");
  };

  const handleCityChange = (e) => {
    onChange("City", e.target.value);
  };

  if (loadingCountry)
    return (
      <div className="py-2 text-xs text-blue-500">
        <FiLoader className="inline mr-1 animate-spin" /> Đang tải dữ liệu...
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div>
        <label className="block mb-1 text-sm font-medium text-gray-700">
          Quốc gia
        </label>
        <div className="relative">
          <select
            value={selectedCountry || ""}
            onChange={handleCountryChange}
            className="w-full py-2 pl-3 pr-10 truncate bg-white border border-gray-300 rounded-md shadow-sm appearance-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Chọn Quốc gia --</option>
            {countriesObj.map((c, index) => (
              <option key={index} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
          <FiGlobe className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-gray-700">
          Tỉnh / Thành phố / Bang
        </label>
        <div className="relative">
          {loadingProvince ? (
            <div className="flex items-center w-full px-3 py-2 text-gray-500 border border-gray-200 rounded-md bg-gray-50">
              <FiLoader className="mr-2 animate-spin" /> Đang tải danh sách...
            </div>
          ) : provinces.length > 0 ? (
            <select
              value={selectedCity || ""}
              onChange={handleCityChange}
              className="w-full py-2 pl-3 pr-10 truncate bg-white border border-gray-300 rounded-md shadow-sm appearance-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Chọn Tỉnh/Thành --</option>
              {provinces.map((p, index) => (
                <option key={index} value={p}>
                  {p}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={selectedCity || ""}
              onChange={handleCityChange}
              placeholder={
                selectedCountry
                  ? "Nhập tay tên thành phố..."
                  : "Chọn quốc gia trước"
              }
              disabled={!selectedCountry}
              className="w-full py-2 pl-3 pr-10 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            />
          )}

          {!loadingProvince && (provinces.length > 0 || selectedCountry) && (
            <FiMapPin className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationSelector;