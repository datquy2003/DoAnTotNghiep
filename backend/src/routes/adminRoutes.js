import express from "express";
import sql from "mssql";
import { sqlConfig } from "../config/db.js";
import { checkAuth } from "../middleware/authMiddleware.js";
import admin from "../config/firebaseAdmin.js";

const router = express.Router();

const checkAdminRole = async (req, res, next) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool
      .request()
      .input("FirebaseUserID", sql.NVarChar, req.firebaseUser.uid)
      .query("SELECT RoleID FROM Users WHERE FirebaseUserID = @FirebaseUserID");

    const roleID = result.recordset[0]?.RoleID;

    if (roleID === 1 || roleID === 2) {
      next();
    } else {
      return res.status(403).json({ message: "Bạn không có quyền truy cập." });
    }
  } catch (error) {
    return res.status(500).json({ message: "Lỗi kiểm tra quyền admin." });
  }
};

const checkSuperAdminRole = async (req, res, next) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool
      .request()
      .input("FirebaseUserID", sql.NVarChar, req.firebaseUser.uid)
      .query("SELECT RoleID FROM Users WHERE FirebaseUserID = @FirebaseUserID");

    const roleID = result.recordset[0]?.RoleID;

    if (roleID === 2) {
      next();
    } else {
      return res
        .status(403)
        .json({ message: "Chỉ Super Admin mới có quyền này." });
    }
  } catch (error) {
    return res.status(500).json({ message: "Lỗi kiểm tra quyền Super Admin." });
  }
};

router.get("/users/no-role", checkAuth, checkAdminRole, async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool.request().query(`
      SELECT 
        FirebaseUserID, Email, DisplayName, PhotoURL, IsVerified, IsBanned, CreatedAt, LastLoginAt
      FROM Users
      WHERE RoleID IS NULL
      ORDER BY CreatedAt DESC
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Lỗi lấy danh sách người dùng chưa chọn role." });
  }
});

router.get(
  "/users/:uid/subscriptions",
  checkAuth,
  checkAdminRole,
  async (req, res) => {
    const { uid } = req.params;
    try {
      const pool = await sql.connect(sqlConfig);
      const result = await pool.request().input("UserID", sql.NVarChar, uid)
        .query(`
        SELECT 
          us.SubscriptionID,
          us.StartDate,
          us.EndDate,
          us.Status,
          us.PaymentTransactionID,
          ISNULL(us.SnapshotPlanName, sp.PlanName) AS PlanName,
          ISNULL(us.SnapshotPrice, sp.Price) AS Price,
          ISNULL(us.SnapshotPlanType, sp.PlanType) AS PlanType,
          CASE 
            WHEN ISNULL(us.SnapshotPlanType, sp.PlanType) = 'SUBSCRIPTION' 
              THEN DATEDIFF(DAY, us.StartDate, us.EndDate)
            ELSE NULL
          END AS DurationInDays,
          ISNULL(us.SnapshotFeatures, sp.Features) AS Features,
          ISNULL(us.Snapshot_JobPostDaily, sp.Limit_JobPostDaily) AS Limit_JobPostDaily,
          ISNULL(us.Snapshot_PushTopDaily, sp.Limit_PushTopDaily) AS Limit_PushTopDaily,
          ISNULL(us.Snapshot_CVStorage, sp.Limit_CVStorage) AS Limit_CVStorage
        FROM UserSubscriptions us
        LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
        WHERE us.UserID = @UserID
        ORDER BY us.StartDate DESC
      `);
      res.status(200).json(result.recordset);
    } catch (error) {
      console.error("Lỗi lấy lịch sử VIP:", error);
      res.status(500).json({ message: "Lỗi server." });
    }
  }
);

const buildVipApply = () => `
  OUTER APPLY (
    SELECT TOP 1
      ISNULL(us.SnapshotPlanName, sp.PlanName) AS PlanName,
      ISNULL(us.SnapshotFeatures, sp.Features) AS Features,
      ISNULL(us.SnapshotPrice, sp.Price) AS Price,
      ISNULL(us.SnapshotPlanType, sp.PlanType) AS PlanType,
      ISNULL(us.Snapshot_JobPostDaily, sp.Limit_JobPostDaily) AS LimitJobPostDaily,
      ISNULL(us.Snapshot_PushTopDaily, sp.Limit_PushTopDaily) AS LimitPushTopDaily,
      ISNULL(us.Snapshot_CVStorage, sp.Limit_CVStorage) AS LimitCVStorage,
      ISNULL(us.Snapshot_ViewApplicantCount, sp.Limit_ViewApplicantCount) AS ViewApplicantQuota,
      ISNULL(us.Snapshot_RevealCandidatePhone, sp.Limit_RevealCandidatePhone) AS RevealPhoneQuota,
      us.StartDate,
      us.EndDate
    FROM UserSubscriptions us
    LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
    WHERE us.UserID = u.FirebaseUserID 
      AND us.Status = 1 
      AND us.EndDate > GETDATE()
      AND ISNULL(us.SnapshotPlanType, sp.PlanType) <> 'ONE_TIME'
    ORDER BY us.EndDate DESC
  ) vip
`;

router.get("/users/candidates", checkAuth, checkAdminRole, async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool.request().query(`
      SELECT 
        u.FirebaseUserID,
        u.Email,
        u.DisplayName,
        u.PhotoURL,
        u.IsVerified,
        u.IsBanned,
        u.CreatedAt,
        u.LastLoginAt,
        cp.FullName,
        cp.PhoneNumber,
        cp.Address,
        cp.ProfileSummary,
        cp.City,
        cp.Country,
        cp.Birthday,
        vip.PlanName AS CurrentVIP,
        vip.Features AS CurrentVIPFeatures,
        vip.Price AS CurrentVIPPrice,
        vip.PlanType AS CurrentVIPPlanType,
        vip.LimitJobPostDaily AS CurrentVIPLimitJobPostDaily,
        vip.LimitPushTopDaily AS CurrentVIPLimitPushTopDaily,
        vip.LimitCVStorage AS CurrentVIPLimitCVStorage,
        vip.ViewApplicantQuota AS CurrentVIPViewApplicantCount,
        vip.RevealPhoneQuota AS CurrentVIPRevealPhoneQuota,
        vip.StartDate AS CurrentVIPStartDate,
        vip.EndDate AS CurrentVIPEndDate
      FROM Users u
      LEFT JOIN CandidateProfiles cp ON u.FirebaseUserID = cp.UserID
      ${buildVipApply()}
      WHERE u.RoleID = 4
      ORDER BY u.CreatedAt DESC
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lấy danh sách ứng viên." });
  }
});

router.get("/users/employers", checkAuth, checkAdminRole, async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool.request().query(`
      SELECT 
        u.FirebaseUserID,
        u.Email,
        u.DisplayName,
        u.PhotoURL,
        u.IsVerified,
        u.IsBanned,
        u.CreatedAt,
        u.LastLoginAt,
        c.CompanyName,
        c.CompanyEmail,
        c.CompanyPhone,
        c.WebsiteURL,
        c.LogoURL,
        c.Address as CompanyAddress,
        c.City,
        c.Country,
        c.CompanyDescription,
        vip.PlanName AS CurrentVIP,
        vip.Features AS CurrentVIPFeatures,
        vip.Price AS CurrentVIPPrice,
        vip.PlanType AS CurrentVIPPlanType,
        vip.LimitJobPostDaily AS CurrentVIPLimitJobPostDaily,
        vip.LimitPushTopDaily AS CurrentVIPLimitPushTopDaily,
        vip.LimitCVStorage AS CurrentVIPLimitCVStorage,
        vip.ViewApplicantQuota AS CurrentVIPViewApplicantCount,
        vip.RevealPhoneQuota AS CurrentVIPRevealPhoneQuota,
        vip.StartDate AS CurrentVIPStartDate,
        vip.EndDate AS CurrentVIPEndDate
      FROM Users u
      LEFT JOIN Companies c ON u.FirebaseUserID = c.OwnerUserID
      ${buildVipApply()}
      WHERE u.RoleID = 3
      ORDER BY u.CreatedAt DESC
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lấy danh sách nhà tuyển dụng." });
  }
});

router.delete("/users/:uid", checkAuth, async (req, res) => {
  const { uid } = req.params;

  try {
    const pool = await sql.connect(sqlConfig);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const activeSubs = await transaction
        .request()
        .input("UserID", sql.NVarChar, uid).query(`
          SELECT 
            ISNULL(us.SnapshotPlanType, sp.PlanType) AS PlanType
          FROM UserSubscriptions us
          LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
          WHERE us.UserID = @UserID
            AND us.Status = 1
        `);

      const hasActiveRecurring = activeSubs.recordset.some((row) => {
        const planType = (row.PlanType || "").toUpperCase();
        return planType !== "ONE_TIME";
      });

      if (hasActiveRecurring) {
        await transaction.rollback();
        return res.status(400).json({
          message:
            "Không thể xóa tài khoản đang có gói định kỳ hoạt động. Vui lòng hủy gói trước.",
        });
      }

      await transaction
        .request()
        .input("UserID", sql.NVarChar, uid)
        .query("DELETE FROM UserSubscriptions WHERE UserID = @UserID");

      await transaction
        .request()
        .input("FirebaseUserID", sql.NVarChar, uid)
        .query("DELETE FROM Users WHERE FirebaseUserID = @FirebaseUserID");

      await transaction.commit();
    } catch (dbError) {
      await transaction.rollback();
      throw dbError;
    }

    await admin.auth().deleteUser(uid);

    res.status(200).json({ message: "Đã xóa tài khoản thành công." });
  } catch (error) {
    console.error("Lỗi khi xóa user:", error);
    res.status(500).json({ message: "Lỗi server khi xóa tài khoản." });
  }
});

router.put("/users/:uid/ban", checkAuth, async (req, res) => {
  const { uid } = req.params;
  const { isBanned } = req.body;

  try {
    const pool = await sql.connect(sqlConfig);
    await pool
      .request()
      .input("FirebaseUserID", sql.NVarChar, uid)
      .input("IsBanned", sql.Bit, isBanned)
      .query(
        "UPDATE Users SET IsBanned = @IsBanned WHERE FirebaseUserID = @FirebaseUserID"
      );

    await admin.auth().updateUser(uid, { disabled: isBanned });

    res.status(200).json({
      message: isBanned ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.",
    });
  } catch (error) {
    console.error("Lỗi ban user:", error);
    res.status(500).json({ message: "Lỗi server." });
  }
});

router.get(
  "/system-admins",
  checkAuth,
  checkSuperAdminRole,
  async (req, res) => {
    try {
      const pool = await sql.connect(sqlConfig);
      const result = await pool.request().query(`
        SELECT FirebaseUserID, Email, DisplayName, PhotoURL, IsBanned, CreatedAt, LastLoginAt, IsVerified
      FROM Users
      WHERE RoleID = 1
      ORDER BY CreatedAt DESC
    `);
      res.status(200).json(result.recordset);
    } catch (error) {
      console.error("Lỗi lấy danh sách admin:", error);
      res.status(500).json({ message: "Lỗi server." });
    }
  }
);

router.post(
  "/system-admins",
  checkAuth,
  checkSuperAdminRole,
  async (req, res) => {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res
        .status(400)
        .json({ message: "Vui lòng điền đầy đủ thông tin." });
    }

    try {
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: displayName,
        emailVerified: false,
      });

      const pool = await sql.connect(sqlConfig);
      await pool
        .request()
        .input("FirebaseUserID", sql.NVarChar, userRecord.uid)
        .input("Email", sql.NVarChar, email)
        .input("DisplayName", sql.NVarChar, displayName)
        .input("RoleID", sql.Int, 1)
        .input("IsVerified", sql.Bit, 0).query(`
          INSERT INTO Users (FirebaseUserID, Email, DisplayName, RoleID, IsVerified, CreatedAt, UpdatedAt)
          VALUES (@FirebaseUserID, @Email, @DisplayName, @RoleID, @IsVerified, GETDATE(), GETDATE())
        `);

      res
        .status(201)
        .json({ message: "Tạo tài khoản Admin thành công!", user: userRecord });
    } catch (error) {
      console.error("Lỗi tạo admin:", error);
      if (error.code === "auth/email-already-exists") {
        return res.status(400).json({ message: "Email này đã được sử dụng." });
      }
      res.status(500).json({ message: "Lỗi server khi tạo Admin." });
    }
  }
);

const buildWorkingTimesSubquery = async (pool) => {
  const schemaRes = await pool.request().query(`
      SELECT 
        CASE WHEN COL_LENGTH('JobWorkingShifts','ShiftGroupID') IS NULL THEN 0 ELSE 1 END AS HasShiftGroup,
        CASE WHEN COL_LENGTH('JobWorkingShifts','RangeDayFrom') IS NULL THEN 0 ELSE 1 END AS HasRangeDayFrom,
        CASE WHEN COL_LENGTH('JobWorkingShifts','RangeDayTo') IS NULL THEN 0 ELSE 1 END AS HasRangeDayTo
  `);

  const hasShiftGroup = schemaRes.recordset?.[0]?.HasShiftGroup === 1;
  const hasRangeDayFrom = schemaRes.recordset?.[0]?.HasRangeDayFrom === 1;
  const hasRangeDayTo = schemaRes.recordset?.[0]?.HasRangeDayTo === 1;

  return hasShiftGroup && hasRangeDayFrom && hasRangeDayTo
    ? `
        (
          SELECT
            s.ShiftGroupID AS shiftGroupId,
            CASE s.RangeDayFrom
              WHEN 1 THEN N'Thứ 2'
              WHEN 2 THEN N'Thứ 3'
              WHEN 3 THEN N'Thứ 4'
              WHEN 4 THEN N'Thứ 5'
              WHEN 5 THEN N'Thứ 6'
              WHEN 6 THEN N'Thứ 7'
              WHEN 7 THEN N'Chủ nhật'
            END AS dayFrom,
            CASE s.RangeDayTo
              WHEN 1 THEN N'Thứ 2'
              WHEN 2 THEN N'Thứ 3'
              WHEN 3 THEN N'Thứ 4'
              WHEN 4 THEN N'Thứ 5'
              WHEN 5 THEN N'Thứ 6'
              WHEN 6 THEN N'Thứ 7'
              WHEN 7 THEN N'Chủ nhật'
            END AS dayTo,
            LEFT(CONVERT(varchar(8), MIN(s.TimeFrom), 108), 5) AS timeFrom,
            LEFT(CONVERT(varchar(8), MIN(s.TimeTo), 108), 5) AS timeTo
          FROM JobWorkingShifts s
          WHERE s.JobID = j.JobID
          GROUP BY s.ShiftGroupID, s.RangeDayFrom, s.RangeDayTo
          ORDER BY MIN(s.ShiftID) ASC
          FOR JSON PATH
        )
      `
    : `
        (
          SELECT
            CASE s.DayOfWeek
              WHEN 1 THEN N'Thứ 2'
              WHEN 2 THEN N'Thứ 3'
              WHEN 3 THEN N'Thứ 4'
              WHEN 4 THEN N'Thứ 5'
              WHEN 5 THEN N'Thứ 6'
              WHEN 6 THEN N'Thứ 7'
              WHEN 7 THEN N'Chủ nhật'
            END AS dayFrom,
            CASE s.DayOfWeek
              WHEN 1 THEN N'Thứ 2'
              WHEN 2 THEN N'Thứ 3'
              WHEN 3 THEN N'Thứ 4'
              WHEN 4 THEN N'Thứ 5'
              WHEN 5 THEN N'Thứ 6'
              WHEN 6 THEN N'Thứ 7'
              WHEN 7 THEN N'Chủ nhật'
            END AS dayTo,
            LEFT(CONVERT(varchar(8), s.TimeFrom, 108), 5) AS timeFrom,
            LEFT(CONVERT(varchar(8), s.TimeTo, 108), 5) AS timeTo
          FROM JobWorkingShifts s
          WHERE s.JobID = j.JobID
          ORDER BY s.DayOfWeek ASC, s.TimeFrom ASC
          FOR JSON PATH
        )
      `;
};

router.get("/jobs/pending", checkAuth, checkAdminRole, async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool.request().query(`
      SELECT
        j.JobID,
        j.JobTitle,
        j.CategoryID,
        j.SpecializationID,
        j.Location,
        j.JobType,
        j.SalaryMin,
        j.SalaryMax,
        j.Experience,
        j.EducationLevel,
        j.VacancyCount,
        j.CreatedAt,
        j.ExpiresAt,
        j.Status,
        c.CompanyID,
        c.CompanyName,
        u.Email AS OwnerEmail,
        u.DisplayName AS OwnerDisplayName,
        cat.CategoryName,
        sp.SpecializationName
      FROM Jobs j
      JOIN Companies c ON j.CompanyID = c.CompanyID
      JOIN Users u ON c.OwnerUserID = u.FirebaseUserID
      LEFT JOIN Categories cat ON j.CategoryID = cat.CategoryID
      LEFT JOIN Specializations sp ON j.SpecializationID = sp.SpecializationID
      WHERE j.Status = 0
      ORDER BY j.ExpiresAt ASC, j.CreatedAt DESC
    `);
    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Lỗi lấy danh sách bài chờ duyệt:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.get("/jobs/active", checkAuth, checkAdminRole, async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool.request().query(`
      SELECT
        j.JobID,
        j.JobTitle,
        j.CategoryID,
        j.SpecializationID,
        j.Location,
        j.JobType,
        j.SalaryMin,
        j.SalaryMax,
        j.Experience,
        j.EducationLevel,
        j.VacancyCount,
        j.CreatedAt,
        j.ExpiresAt,
        j.Status,
        c.CompanyID,
        c.CompanyName,
        cat.CategoryName,
        sp.SpecializationName
      FROM Jobs j
      JOIN Companies c ON j.CompanyID = c.CompanyID
      LEFT JOIN Categories cat ON j.CategoryID = cat.CategoryID
      LEFT JOIN Specializations sp ON j.SpecializationID = sp.SpecializationID
      WHERE j.Status = 1
      ORDER BY j.ExpiresAt ASC, j.CreatedAt DESC
    `);
    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Lỗi lấy danh sách bài đang tuyển:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.get("/jobs/:id", checkAuth, checkAdminRole, async (req, res) => {
  const { id } = req.params;
  if (!id || Number.isNaN(Number(id))) {
    return res.status(400).json({ message: "JobID không hợp lệ." });
  }

  try {
    const pool = await sql.connect(sqlConfig);
    const workingTimesSubquery = await buildWorkingTimesSubquery(pool);
    const result = await pool.request().input("JobID", sql.Int, Number(id))
      .query(`
        SELECT TOP 1
          j.*,
          ${workingTimesSubquery} AS WorkingTimes,
          c.CompanyName,
          c.CompanyEmail,
          c.CompanyPhone,
          c.WebsiteURL,
          c.LogoURL,
          c.Address AS CompanyAddress,
          c.City AS CompanyCity,
          c.Country AS CompanyCountry,
          u.Email AS OwnerEmail,
          u.DisplayName AS OwnerDisplayName,
          cat.CategoryName,
          sp.SpecializationName
        FROM Jobs j
        JOIN Companies c ON j.CompanyID = c.CompanyID
        JOIN Users u ON c.OwnerUserID = u.FirebaseUserID
        LEFT JOIN Categories cat ON j.CategoryID = cat.CategoryID
        LEFT JOIN Specializations sp ON j.SpecializationID = sp.SpecializationID
        WHERE j.JobID = @JobID
      `);

    const job = result.recordset?.[0];
    if (!job) {
      return res.status(404).json({ message: "Không tìm thấy bài đăng." });
    }
    return res.status(200).json(job);
  } catch (error) {
    console.error("Lỗi lấy chi tiết bài đăng:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.patch(
  "/jobs/:id/approve",
  checkAuth,
  checkAdminRole,
  async (req, res) => {
    const { id } = req.params;
    if (!id || Number.isNaN(Number(id))) {
      return res.status(400).json({ message: "JobID không hợp lệ." });
    }

    try {
      const pool = await sql.connect(sqlConfig);
      const updateRes = await pool
        .request()
        .input("JobID", sql.Int, Number(id))
        .query(
          `
        UPDATE Jobs
        SET Status = 1, ApprovedAt = GETDATE()
        WHERE JobID = @JobID AND Status = 0
        `
        );

      const affected = updateRes?.rowsAffected?.[0] || 0;
      if (affected === 0) {
        return res.status(400).json({
          message:
            "Không thể duyệt (bài có thể đã được xử lý hoặc không ở trạng thái chờ duyệt).",
        });
      }
      return res.status(200).json({ message: "Đã duyệt bài đăng." });
    } catch (error) {
      console.error("Lỗi duyệt bài đăng:", error);
      return res.status(500).json({ message: "Lỗi server." });
    }
  }
);

router.patch(
  "/jobs/:id/reject",
  checkAuth,
  checkAdminRole,
  async (req, res) => {
    const { id } = req.params;
    if (!id || Number.isNaN(Number(id))) {
      return res.status(400).json({ message: "JobID không hợp lệ." });
    }

    try {
      const pool = await sql.connect(sqlConfig);
      const updateRes = await pool
        .request()
        .input("JobID", sql.Int, Number(id))
        .query(
          `
        UPDATE Jobs
        SET Status = 4, ApprovedAt = NULL
        WHERE JobID = @JobID AND Status = 0
        `
        );

      const affected = updateRes?.rowsAffected?.[0] || 0;
      if (affected === 0) {
        return res.status(400).json({
          message:
            "Không thể từ chối (bài có thể đã được xử lý hoặc không ở trạng thái chờ duyệt).",
        });
      }
      return res.status(200).json({ message: "Đã từ chối bài đăng." });
    } catch (error) {
      console.error("Lỗi từ chối bài đăng:", error);
      return res.status(500).json({ message: "Lỗi server." });
    }
  }
);

export default router;