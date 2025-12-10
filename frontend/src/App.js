import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import "leaflet/dist/leaflet.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ChooseRole from "./pages/ChooseRole";
import ForgotPassword from "./pages/ForgotPassword";
import MainLayout from "./components/MainLayout";
import ProfileEdit from "./pages/ProfileEdit";
import VerifyEmail from "./pages/VerifyEmail";
import ChangePassword from "./pages/ChangePassword";
import CvManagement from "./pages/candidate/CvManagement";

import AdminLayout from "./pages/admin/AdminLayout";
import UserManagement from "./pages/admin/UserManagement";
import JobManagement from "./pages/admin/JobManagement";
import JobApproval from "./pages/admin/JobApproval";
import VipManagement from "./pages/admin/VipManagement";
import CategoryManagement from "./pages/admin/CategoryManagement";
import AdminAccountManagement from "./pages/admin/AdminAccountManagement";
import TestUserCreation from "./pages/admin/TestUserCreation"; // Comment dòng này

import CandidateSubscription from "./pages/candidate/CandidateSubscription";
import EmployerSubscription from "./pages/employer/EmployerSubscription";
import PaymentResult from "./pages/PaymentResult";
import ApplicantManagement from "./pages/employer/ApplicantManagement";

const HomeCandidate = () => <div>Trang chủ ỨNG VIÊN (Role 4)</div>;
const HomeEmployer = () => <div>Trang chủ NHÀ TUYỂN DỤNG (Role 3)</div>;

const AppliedJobs = () => <div>Trang Việc đã ứng tuyển</div>;
const FavoriteJobs = () => <div>Trang Việc yêu thích</div>;
const BlockedCompanies = () => <div>Trang Công ty đã chặn</div>;
const JobManagementEmployer = () => <div>Trang Quản lý tin tuyển dụng</div>;

const Messages = () => <div>Trang Nhắn tin</div>;

const RoleBasedHome = () => {
  const { appUser } = useAuth();
  if (appUser?.RoleID === 4) return <HomeCandidate />;
  if (appUser?.RoleID === 3) return <HomeEmployer />;
  if (appUser?.RoleID === 1 || appUser?.RoleID === 2) {
    return <Navigate to="/admin/users" replace />;
  }
  if (appUser && !appUser.RoleID) {
    return <Navigate to="/choose-role" replace />;
  }
  return <div>Đang tải...</div>;
};

function App() {
  const { firebaseUser, appUser } = useAuth();

  const isEmailVerified =
    firebaseUser?.emailVerified ||
    (firebaseUser?.providerData.length > 0 &&
      firebaseUser.providerData[0].providerId !== "password");

  const isNewUser = firebaseUser && (!appUser || !appUser.RoleID);

  const isUnverifiedAdmin =
    firebaseUser && appUser?.RoleID === 1 && !isEmailVerified;

  return (
    <Routes>
      <Route
        path="/login"
        element={!firebaseUser ? <Login /> : <Navigate to="/" />}
      />
      <Route
        path="/register"
        element={!firebaseUser ? <Register /> : <Navigate to="/" />}
      />
      <Route
        path="/forgot-password"
        element={!firebaseUser ? <ForgotPassword /> : <Navigate to="/" />}
      />

      <Route
        path="/verify-email"
        element={isUnverifiedAdmin ? <VerifyEmail /> : <Navigate to="/" />}
      />

      <Route
        path="/choose-role"
        element={isNewUser ? <ChooseRole /> : <Navigate to="/" />}
      />

      <Route
        path="/"
        element={
          !firebaseUser ? (
            <Navigate to="/login" />
          ) : isUnverifiedAdmin ? (
            <Navigate to="/verify-email" />
          ) : isNewUser ? (
            <Navigate to="/choose-role" />
          ) : (
            <MainLayout />
          )
        }
      >
        <Route index element={<RoleBasedHome />} />
        <Route path="messages" element={<Messages />} />
        <Route path="profile-edit" element={<ProfileEdit />} />
        <Route path="change-password" element={<ChangePassword />} />
        <Route path="payment/:result" element={<PaymentResult />} />

        <Route path="candidate/cvs" element={<CvManagement />} />
        <Route path="candidate/applied-jobs" element={<AppliedJobs />} />
        <Route path="candidate/favorite-jobs" element={<FavoriteJobs />} />
        <Route
          path="candidate/blocked-companies"
          element={<BlockedCompanies />}
        />
        <Route
          path="candidate/subscription"
          element={<CandidateSubscription />}
        />

        <Route path="employer/jobs" element={<JobManagementEmployer />} />
        <Route path="employer/applicants" element={<ApplicantManagement />} />
        <Route
          path="employer/subscription"
          element={<EmployerSubscription />}
        />

        <Route path="admin" element={<AdminLayout />}>
          <Route path="test-tools" element={<TestUserCreation />} />{" "}
          {/* Comment dòng bên trên */}
          <Route path="users" element={<UserManagement />} />
          <Route path="jobs" element={<JobManagement />} />
          <Route path="jobs-approval" element={<JobApproval />} />
          <Route path="vip-packages" element={<VipManagement />} />
          <Route path="categories" element={<CategoryManagement />} />
          <Route path="system-admins" element={<AdminAccountManagement />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;