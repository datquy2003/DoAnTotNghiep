import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { paymentApi } from "../api/paymentApi";
import { useAuth } from "../context/AuthContext";
import { FiCheckCircle, FiXCircle, FiLoader } from "react-icons/fi";

const PaymentResult = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { manualReloadFirebaseUser, appUser } = useAuth();

  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Đang kết nối tới máy chủ...");
  const [countdown, setCountdown] = useState(5);

  const sessionId = searchParams.get("session_id");
  const planId = searchParams.get("plan_id");
  const returnUrl = searchParams.get("return_url");

  const handleRedirect = useCallback(
    (fallback) => {
      if (returnUrl) {
        navigate(returnUrl, { replace: true });
        return;
      }
      if (fallback) {
        navigate(fallback, { replace: true });
        return;
      }
      if (appUser?.RoleID === 3) {
        navigate("/employer/subscription", { state: { reload: true } });
      } else if (appUser?.RoleID === 4) {
        navigate("/candidate/subscription", { state: { reload: true } });
      } else {
        navigate("/");
      }
    },
    [returnUrl, navigate, appUser?.RoleID]
  );

  const isCalled = useRef(false);

  useEffect(() => {
    const verify = async () => {
      if (isCalled.current) return;
      isCalled.current = true;

      if (!sessionId || !planId) {
        setStatus("error");
        setMessage("Thiếu thông tin giao dịch. Vui lòng liên hệ hỗ trợ.");
        return;
      }

      try {
        setMessage("Đang xác thực giao dịch với Stripe...");
        const res = await paymentApi.verifyPayment(sessionId, planId);

        await manualReloadFirebaseUser();

        setStatus("success");
        setMessage("Thanh toán thành công! Gói dịch vụ đã được kích hoạt.");
        if (res.data?.redirectUrl) {
          setTimeout(() => handleRedirect(res.data.redirectUrl), 200);
        }
      } catch (error) {
        console.error("Lỗi verify:", error);
        setStatus("error");
        setMessage(
          error.response?.data?.message ||
            "Xác thực thanh toán thất bại. Vui lòng liên hệ hỗ trợ."
        );
      }
    };

    if (window.location.pathname.includes("success")) {
      verify();
    } else {
      setStatus("error");
      setMessage("Bạn đã hủy giao dịch.");
    }
  }, [sessionId, planId, manualReloadFirebaseUser, handleRedirect]);

  useEffect(() => {
    let timer;
    if (status === "success") {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleRedirect();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md p-8 text-center bg-white shadow-xl rounded-2xl animate-fadeIn">
        {status === "processing" && (
          <>
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full">
              <FiLoader className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              Đang xử lý...
            </h2>
            <p className="text-sm text-gray-600">{message}</p>
            <p className="mt-4 text-xs text-gray-400">
              Vui lòng không tắt trình duyệt.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full">
              <FiCheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              Thành công!
            </h2>
            <p className="mb-6 text-gray-600">{message}</p>
            <p className="mb-6 text-sm font-medium text-blue-500">
              Tự động quay lại trang gói dịch vụ sau {countdown}s...
            </p>
            <button
              onClick={() => handleRedirect()}
              className="w-full py-3 font-semibold text-white transition-colors bg-green-600 rounded-lg shadow-md hover:bg-green-700"
            >
              Quay về
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full">
              <FiXCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Thất bại</h2>
            <p className="mb-6 text-gray-600">{message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(-1)}
                className="flex-1 py-3 font-semibold text-gray-800 transition-colors bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Quay lại
              </button>
              <button
                onClick={() => navigate("/")}
                className="flex-1 py-3 font-semibold text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Trang chủ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentResult;