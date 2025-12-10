import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getImageUrl } from "../utils/urlHelper";
import { notificationApi } from "../api/notificationApi";
import { formatDate } from "../utils/formatDate";

import {
  FiBell,
  FiMessageSquare,
  FiChevronDown,
  FiEdit,
  FiLogOut,
  FiBriefcase,
  FiFileText,
  FiHeart,
  FiSlash,
  FiPackage,
  FiHome,
  FiClipboard,
  FiUsers,
  FiLock,
  FiStar,
} from "react-icons/fi";
import { FaUserCircle } from "react-icons/fa";

const HeaderNavLink = ({ to, children }) => {
  const activeClass = "text-blue-600 font-semibold border-b-2 border-blue-600";
  const inactiveClass = "text-gray-600 hover:text-blue-600";

  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `${
          isActive ? activeClass : inactiveClass
        } h-full flex items-center px-2`
      }
    >
      {children}
    </NavLink>
  );
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const unreadCount = items.filter((item) => !item.IsRead).length;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.getNotifications(10);
      setItems(res.data || []);
    } catch (error) {
      console.error("Lỗi lấy thông báo:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60 * 1000);
    const handleFocus = () => fetchNotifications();
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchNotifications]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && items.length === 0) {
      fetchNotifications();
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setItems((prev) =>
        prev.map((item) =>
          item.NotificationID === id ? { ...item, IsRead: true } : item
        )
      );
    } catch (error) {
      console.error("Lỗi cập nhật thông báo:", error);
    }
  };

  const handleMarkAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((item) => ({ ...item, IsRead: true })));
    } catch (error) {
      console.error("Lỗi đánh dấu tất cả thông báo:", error);
    }
  };

  const navigate = useNavigate();

  const resolveLink = (item) => {
    if (item.Type === "VIP_ONE_TIME_PURCHASE") {
      const msg = (item.Message || "").toLowerCase();
      if (msg.includes("liên hệ ứng viên") || msg.includes("ứng viên")) {
        return "/employer/applicants";
      }
      if (msg.includes("đẩy top") || msg.includes("cv")) {
        return "/candidate/cvs";
      }
      return "/employer/applicants";
    }
    if (item.LinkURL) return item.LinkURL;
    return null;
  };

  const handleNavigate = (item) => {
    const target = resolveLink(item);
    if (target) {
      navigate(target);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggle}
        className="relative flex items-center justify-center w-8 h-8 text-gray-600 hover:text-blue-600"
      >
        <FiBell size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1 bg-red-500 text-white text-[10px] font-semibold rounded-full px-1.5">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-3 bg-white border border-gray-200 shadow-xl w-80 rounded-xl">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <p className="text-sm font-semibold text-gray-700">
              Thông báo gần đây
            </p>
            <button
              onClick={handleMarkAll}
              className="text-xs text-blue-600 hover:underline"
            >
              Đánh dấu đã đọc
            </button>
          </div>
          <div className="overflow-y-auto max-h-96">
            {loading ? (
              <p className="py-6 text-sm text-center text-gray-500">
                Đang tải...
              </p>
            ) : items.length === 0 ? (
              <p className="py-6 text-sm text-center text-gray-500">
                Chưa có thông báo nào.
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.NotificationID}
                  className={`px-4 py-3 border-b last:border-b-0 ${
                    item.IsRead ? "bg-white" : "bg-blue-50"
                  }`}
                >
                  <p className="text-sm text-gray-800 whitespace-pre-line">
                    {item.Message}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      {formatDate(item.CreatedAt)}
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      {!item.IsRead && (
                        <button
                          onClick={() => handleMarkRead(item.NotificationID)}
                          className="text-blue-600 hover:underline"
                        >
                          Đã đọc
                        </button>
                      )}
                      {item.LinkURL && (
                        <button
                          onClick={() => {
                            handleNavigate(item);
                            handleMarkRead(item.NotificationID);
                          }}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          Xem
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ProfileMenu = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { appUser, logout, firebaseUser } = useAuth();
  const dropdownRef = useRef(null);
  const isAdmin = appUser?.RoleID === 1 || appUser?.RoleID === 2;
  const isPasswordUser = firebaseUser?.providerData.some(
    (provider) => provider.providerId === "password"
  );
  const isVipUser = Boolean(appUser?.CurrentVIP);
  const vipPlanName = appUser?.CurrentVIP;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  const photoToDisplay = getImageUrl(
    appUser?.PhotoURL || firebaseUser?.photoURL
  );

  return (
    <div className="flex items-center space-x-3">
      {!isAdmin && (
        <Link
          to="/messages"
          className="relative flex items-center justify-center w-8 h-8 text-gray-600 hover:text-blue-600"
        >
          <FiMessageSquare size={22} />
        </Link>
      )}
      {!isAdmin && <NotificationBell />}

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 focus:outline-none"
        >
          {photoToDisplay ? (
            <img
              src={photoToDisplay}
              alt="Avatar"
              className="object-cover rounded-full w-7 h-7"
            />
          ) : (
            <FaUserCircle size={28} className="text-gray-400" />
          )}
          <div className="items-center hidden space-x-1 md:flex">
            <span className="text-sm font-medium">
              {appUser?.DisplayName || "Tài khoản"}
            </span>
            {isVipUser && (
              <FiStar
                size={14}
                className="text-yellow-500"
                title={vipPlanName || "VIP"}
              />
            )}
          </div>
          <FiChevronDown
            size={16}
            className={`transition-transform duration-200 ${
              isDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 z-50 w-56 py-1 mt-2 bg-white border rounded-md shadow-lg">
            <Link
              to="/profile-edit"
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsDropdownOpen(false)}
            >
              <FiEdit className="mr-2" /> Chỉnh sửa thông tin
            </Link>
            {isPasswordUser && (
              <Link
                to="/change-password"
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setIsDropdownOpen(false)}
              >
                <FiLock className="mr-2" /> Đổi mật khẩu
              </Link>
            )}
            <div className="my-1 border-t"></div>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-gray-100"
            >
              <FiLogOut className="mr-2" /> Đăng xuất
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const CandidateHeader = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex h-full space-x-6">
          <HeaderNavLink to="/">
            <FiHome className="mr-1.5" /> Trang chủ
          </HeaderNavLink>
          <HeaderNavLink to="/candidate/cvs">
            <FiFileText className="mr-1.5" /> Quản lý CV
          </HeaderNavLink>
          <HeaderNavLink to="/candidate/applied-jobs">
            <FiBriefcase className="mr-1.5" /> Việc đã ứng tuyển
          </HeaderNavLink>
          <HeaderNavLink to="/candidate/favorite-jobs">
            <FiHeart className="mr-1.5" /> Việc yêu thích
          </HeaderNavLink>
          <HeaderNavLink to="/candidate/blocked-companies">
            <FiSlash className="mr-1.5" /> Công ty đã chặn
          </HeaderNavLink>
          <HeaderNavLink to="/candidate/subscription">
            <FiPackage className="mr-1.5" /> Gói VIP
          </HeaderNavLink>
        </div>
        <ProfileMenu />
      </div>
    </nav>
  );
};

const EmployerHeader = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex h-full space-x-6">
          <HeaderNavLink to="/">
            <FiHome className="mr-1.5" /> Trang chủ
          </HeaderNavLink>
          <HeaderNavLink to="/employer/jobs">
            <FiClipboard className="mr-1.5" /> Quản lý tin
          </HeaderNavLink>
          <HeaderNavLink to="/employer/applicants">
            <FiUsers className="mr-1.5" /> Ứng viên
          </HeaderNavLink>
          <HeaderNavLink to="/employer/subscription">
            <FiPackage className="mr-1.5" /> Gói VIP
          </HeaderNavLink>
        </div>
        <ProfileMenu />
      </div>
    </nav>
  );
};

const AdminHeader = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex h-full space-x-6">
          <HeaderNavLink to="/admin/users">
            <FiHome className="mr-1.5" /> Trang chủ
          </HeaderNavLink>
        </div>
        <ProfileMenu />
      </div>
    </nav>
  );
};

const Header = () => {
  const { appUser } = useAuth();

  switch (appUser?.RoleID) {
    case 4:
      return <CandidateHeader />;
    case 3:
      return <EmployerHeader />;
    case 2:
      return <AdminHeader />;
    case 1:
      return <AdminHeader />;
    default:
      return null;
  }
};

export default Header;