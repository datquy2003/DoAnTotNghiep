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

router.get("/reports/revenue", checkAuth, checkAdminRole, async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);

    const rangeRaw = String(req.query?.range || "1m").toLowerCase();
    const range = ["day", "1m", "3m", "6m", "year"].includes(rangeRaw)
      ? rangeRaw
      : "1m";

    const nowRes = await pool.request().query("SELECT GETDATE() AS Now");
    const now = nowRes.recordset?.[0]?.Now
      ? new Date(nowRes.recordset[0].Now)
      : new Date();
    const currentYear = now.getFullYear();
    const yearParam = Number(req.query?.year);
    const year = Number.isFinite(yearParam) ? yearParam : currentYear;

    let startDate = new Date(now);
    let endDate = new Date(now);
    let granularity = "day";

    if (range === "day") {
      startDate.setDate(startDate.getDate() - 6);
    } else if (range === "1m") {
      startDate.setDate(startDate.getDate() - 30);
    } else if (range === "3m") {
      startDate.setDate(startDate.getDate() - 90);
    } else if (range === "6m") {
      startDate.setDate(startDate.getDate() - 180);
    } else if (range === "year") {
      granularity = "month";
      startDate.setTime(new Date(year, 0, 1, 0, 0, 0, 0).getTime());
      const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
      endDate.setTime(
        year === currentYear
          ? Math.min(now.getTime(), endOfYear.getTime())
          : endOfYear.getTime()
      );
    }

    if (granularity !== "month") {
      startDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0,
        0,
        0,
        0
      );
      endDate = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
        0,
        0,
        0,
        0
      );
    }

    const endExclusive = new Date(endDate);
    if (granularity !== "month") {
      endExclusive.setDate(endExclusive.getDate() + 1);
    } else {
      endExclusive.setMilliseconds(endExclusive.getMilliseconds() + 1);
    }

    const baseWhere = `
      us.Status = 1
      AND us.StartDate >= @StartDate
      AND us.StartDate < @EndDate
    `;

    let barRows = [];
    if (granularity === "month") {
      const barRes = await pool
        .request()
        .input("StartDate", sql.DateTime, startDate)
        .input("EndDate", sql.DateTime, endExclusive).query(`
          SELECT
            YEAR(us.StartDate) AS YearNum,
            MONTH(us.StartDate) AS MonthNum,
            SUM(CAST(ISNULL(us.SnapshotPrice, sp.Price) AS DECIMAL(18,2))) AS Total
          FROM UserSubscriptions us
          LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
          WHERE ${baseWhere}
          GROUP BY YEAR(us.StartDate), MONTH(us.StartDate)
          ORDER BY YearNum ASC, MonthNum ASC
        `);
      barRows = barRes.recordset || [];
    } else {
      const barRes = await pool
        .request()
        .input("StartDate", sql.DateTime, startDate)
        .input("EndDate", sql.DateTime, endExclusive).query(`
          SELECT
            CONVERT(date, us.StartDate) AS DayKey,
            SUM(CAST(ISNULL(us.SnapshotPrice, sp.Price) AS DECIMAL(18,2))) AS Total
          FROM UserSubscriptions us
          LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
          WHERE ${baseWhere}
          GROUP BY CONVERT(date, us.StartDate)
          ORDER BY DayKey ASC
        `);
      barRows = barRes.recordset || [];
    }

    const pieRes = await pool
      .request()
      .input("StartDate", sql.DateTime, startDate)
      .input("EndDate", sql.DateTime, endExclusive).query(`
        SELECT TOP 20
          ISNULL(us.SnapshotPlanName, sp.PlanName) AS PlanName,
          SUM(CAST(ISNULL(us.SnapshotPrice, sp.Price) AS DECIMAL(18,2))) AS Total
        FROM UserSubscriptions us
        LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
        WHERE ${baseWhere}
        GROUP BY ISNULL(us.SnapshotPlanName, sp.PlanName)
        ORDER BY Total DESC
      `);

    const totalRes = await pool
      .request()
      .input("StartDate", sql.DateTime, startDate)
      .input("EndDate", sql.DateTime, endExclusive).query(`
        SELECT
          SUM(CAST(ISNULL(us.SnapshotPrice, sp.Price) AS DECIMAL(18,2))) AS TotalRevenue
        FROM UserSubscriptions us
        LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
        WHERE ${baseWhere}
      `);

    const totalRevenue = Number(totalRes.recordset?.[0]?.TotalRevenue || 0);

    let bar = [];
    if (granularity === "month") {
      const map = new Map(
        barRows.map((r) => [
          `${r.YearNum}-${String(r.MonthNum).padStart(2, "0")}`,
          Number(r.Total || 0),
        ])
      );
      bar = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const label = `${year}-${String(m).padStart(2, "0")}`;
        return { label, total: map.get(label) || 0 };
      });
    } else {
      const map = new Map(
        barRows.map((r) => {
          const d = r.DayKey instanceof Date ? r.DayKey : new Date(r.DayKey);
          const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
            2,
            "0"
          )}-${String(d.getDate()).padStart(2, "0")}`;
          return [label, Number(r.Total || 0)];
        })
      );

      const cursor = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0,
        0,
        0,
        0
      );
      const endCursor = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
        0,
        0,
        0,
        0
      );

      while (cursor.getTime() <= endCursor.getTime()) {
        const label = `${cursor.getFullYear()}-${String(
          cursor.getMonth() + 1
        ).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        bar.push({ label, total: map.get(label) || 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const pie = (pieRes.recordset || []).map((r) => ({
      name: r.PlanName || "Không rõ",
      value: Number(r.Total || 0),
    }));

    return res.status(200).json({
      range,
      year,
      granularity,
      startDate,
      endDate,
      totalRevenue,
      currency: "VND",
      bar,
      pie,
    });
  } catch (error) {
    console.error("Lỗi GET /admin/reports/revenue:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.get(
  "/reports/new-users",
  checkAuth,
  checkAdminRole,
  async (req, res) => {
    try {
      const pool = await sql.connect(sqlConfig);

      const rangeRaw = String(req.query?.range || "1m").toLowerCase();
      const range = ["day", "1m", "3m", "6m", "year"].includes(rangeRaw)
        ? rangeRaw
        : "1m";

      const nowRes = await pool.request().query("SELECT GETDATE() AS Now");
      const now = nowRes.recordset?.[0]?.Now
        ? new Date(nowRes.recordset[0].Now)
        : new Date();
      const currentYear = now.getFullYear();
      const yearParam = Number(req.query?.year);
      const year = Number.isFinite(yearParam) ? yearParam : currentYear;

      let startDate = new Date(now);
      let endDate = new Date(now);
      let granularity = "day";

      if (range === "day") {
        startDate.setDate(startDate.getDate() - 6);
      } else if (range === "1m") {
        startDate.setDate(startDate.getDate() - 30);
      } else if (range === "3m") {
        startDate.setDate(startDate.getDate() - 90);
      } else if (range === "6m") {
        startDate.setDate(startDate.getDate() - 180);
      } else if (range === "year") {
        granularity = "month";
        startDate.setTime(new Date(year, 0, 1, 0, 0, 0, 0).getTime());
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        endDate.setTime(
          year === currentYear
            ? Math.min(now.getTime(), endOfYear.getTime())
            : endOfYear.getTime()
        );
      }

      if (granularity !== "month") {
        startDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
          0,
          0,
          0,
          0
        );
        endDate = new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
          0,
          0,
          0,
          0
        );
      }

      const endExclusive = new Date(endDate);
      if (granularity !== "month") {
        endExclusive.setDate(endExclusive.getDate() + 1);
      } else {
        endExclusive.setMilliseconds(endExclusive.getMilliseconds() + 1);
      }

      const baseWhere = `
      u.CreatedAt >= @StartDate
      AND u.CreatedAt < @EndDate
      AND (u.RoleID IN (3, 4) OR u.RoleID IS NULL)
    `;

      let barRows = [];
      if (granularity === "month") {
        const barRes = await pool
          .request()
          .input("StartDate", sql.DateTime, startDate)
          .input("EndDate", sql.DateTime, endExclusive).query(`
          SELECT
            YEAR(u.CreatedAt) AS YearNum,
            MONTH(u.CreatedAt) AS MonthNum,
            COUNT(*) AS Total
          FROM Users u
          WHERE ${baseWhere}
          GROUP BY YEAR(u.CreatedAt), MONTH(u.CreatedAt)
          ORDER BY YearNum ASC, MonthNum ASC
        `);
        barRows = barRes.recordset || [];
      } else {
        const barRes = await pool
          .request()
          .input("StartDate", sql.DateTime, startDate)
          .input("EndDate", sql.DateTime, endExclusive).query(`
          SELECT
            CONVERT(date, u.CreatedAt) AS DayKey,
            COUNT(*) AS Total
          FROM Users u
          WHERE ${baseWhere}
          GROUP BY CONVERT(date, u.CreatedAt)
          ORDER BY DayKey ASC
        `);
        barRows = barRes.recordset || [];
      }

      const pieRes = await pool
        .request()
        .input("StartDate", sql.DateTime, startDate)
        .input("EndDate", sql.DateTime, endExclusive).query(`
        SELECT
          ISNULL(u.RoleID, 0) AS RoleID,
          COUNT(*) AS Total
        FROM Users u
        WHERE ${baseWhere}
        GROUP BY ISNULL(u.RoleID, 0)
        ORDER BY Total DESC
      `);

      const totalRes = await pool
        .request()
        .input("StartDate", sql.DateTime, startDate)
        .input("EndDate", sql.DateTime, endExclusive).query(`
        SELECT COUNT(*) AS TotalNewUsers
        FROM Users u
        WHERE ${baseWhere}
      `);

      const totalNewUsers = Number(totalRes.recordset?.[0]?.TotalNewUsers || 0);

      let bar = [];
      if (granularity === "month") {
        const map = new Map(
          barRows.map((r) => [
            `${r.YearNum}-${String(r.MonthNum).padStart(2, "0")}`,
            Number(r.Total || 0),
          ])
        );
        bar = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const label = `${year}-${String(m).padStart(2, "0")}`;
          return { label, total: map.get(label) || 0 };
        });
      } else {
        const map = new Map(
          barRows.map((r) => {
            const d = r.DayKey instanceof Date ? r.DayKey : new Date(r.DayKey);
            const label = `${d.getFullYear()}-${String(
              d.getMonth() + 1
            ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            return [label, Number(r.Total || 0)];
          })
        );

        const cursor = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
          0,
          0,
          0,
          0
        );
        const endCursor = new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
          0,
          0,
          0,
          0
        );

        while (cursor.getTime() <= endCursor.getTime()) {
          const label = `${cursor.getFullYear()}-${String(
            cursor.getMonth() + 1
          ).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
          bar.push({ label, total: map.get(label) || 0 });
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      const pie = (pieRes.recordset || []).map((r) => ({
        roleId: Number(r.RoleID || 0),
        value: Number(r.Total || 0),
      }));

      return res.status(200).json({
        range,
        year,
        granularity,
        startDate,
        endDate,
        totalNewUsers,
        bar,
        pie,
      });
    } catch (error) {
      console.error("Lỗi GET /admin/reports/new-users:", error);
      return res.status(500).json({ message: "Lỗi server." });
    }
  }
);

router.get(
  "/reports/new-posts",
  checkAuth,
  checkAdminRole,
  async (req, res) => {
    try {
      const pool = await sql.connect(sqlConfig);

      const rangeRaw = String(req.query?.range || "1m").toLowerCase();
      const range = ["day", "1m", "3m", "6m", "year"].includes(rangeRaw)
        ? rangeRaw
        : "1m";

      const nowRes = await pool.request().query("SELECT GETDATE() AS Now");
      const now = nowRes.recordset?.[0]?.Now
        ? new Date(nowRes.recordset[0].Now)
        : new Date();

      const currentYear = now.getFullYear();
      const yearParam = Number(req.query?.year);
      const year = Number.isFinite(yearParam) ? yearParam : currentYear;

      let startDate = new Date(now);
      let endDate = new Date(now);
      let granularity = "day";

      if (range === "day") {
        startDate.setDate(startDate.getDate() - 6);
      } else if (range === "1m") {
        startDate.setDate(startDate.getDate() - 30);
      } else if (range === "3m") {
        startDate.setDate(startDate.getDate() - 90);
      } else if (range === "6m") {
        startDate.setDate(startDate.getDate() - 180);
      } else if (range === "year") {
        granularity = "month";
        startDate.setTime(new Date(year, 0, 1, 0, 0, 0, 0).getTime());
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        endDate.setTime(
          year === currentYear
            ? Math.min(now.getTime(), endOfYear.getTime())
            : endOfYear.getTime()
        );
      }

      if (granularity !== "month") {
        startDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
          0,
          0,
          0,
          0
        );
        endDate = new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
          0,
          0,
          0,
          0
        );
      }

      const endExclusive = new Date(endDate);
      if (granularity !== "month") {
        endExclusive.setDate(endExclusive.getDate() + 1);
      } else {
        endExclusive.setMilliseconds(endExclusive.getMilliseconds() + 1);
      }

      const baseWhere = `
        j.ApprovedAt IS NOT NULL
        AND j.ApprovedAt >= @StartDate
        AND j.ApprovedAt < @EndDate
      `;

      let barRows = [];
      if (granularity === "month") {
        const barRes = await pool
          .request()
          .input("StartDate", sql.DateTime, startDate)
          .input("EndDate", sql.DateTime, endExclusive).query(`
            SELECT
              YEAR(j.ApprovedAt) AS YearNum,
              MONTH(j.ApprovedAt) AS MonthNum,
              COUNT(*) AS Total
            FROM Jobs j
            WHERE ${baseWhere}
            GROUP BY YEAR(j.ApprovedAt), MONTH(j.ApprovedAt)
            ORDER BY YearNum ASC, MonthNum ASC
          `);
        barRows = barRes.recordset || [];
      } else {
        const barRes = await pool
          .request()
          .input("StartDate", sql.DateTime, startDate)
          .input("EndDate", sql.DateTime, endExclusive).query(`
            SELECT
              CONVERT(date, j.ApprovedAt) AS DayKey,
              COUNT(*) AS Total
            FROM Jobs j
            WHERE ${baseWhere}
            GROUP BY CONVERT(date, j.ApprovedAt)
            ORDER BY DayKey ASC
          `);
        barRows = barRes.recordset || [];
      }

      const pieCategoryRes = await pool
        .request()
        .input("StartDate", sql.DateTime, startDate)
        .input("EndDate", sql.DateTime, endExclusive).query(`
          SELECT TOP 10
            ISNULL(cat.CategoryName, N'Chưa chọn') AS CategoryName,
            COUNT(*) AS Total
          FROM Jobs j
          LEFT JOIN Categories cat ON j.CategoryID = cat.CategoryID
          WHERE ${baseWhere}
          GROUP BY ISNULL(cat.CategoryName, N'Chưa chọn')
          ORDER BY Total DESC
        `);

      const pieSpecRes = await pool
        .request()
        .input("StartDate", sql.DateTime, startDate)
        .input("EndDate", sql.DateTime, endExclusive).query(`
          SELECT TOP 10
            ISNULL(sp.SpecializationName, N'Chưa chọn') AS SpecializationName,
            COUNT(*) AS Total
          FROM Jobs j
          LEFT JOIN Specializations sp ON j.SpecializationID = sp.SpecializationID
          WHERE ${baseWhere}
          GROUP BY ISNULL(sp.SpecializationName, N'Chưa chọn')
          ORDER BY Total DESC
        `);

      const totalRes = await pool
        .request()
        .input("StartDate", sql.DateTime, startDate)
        .input("EndDate", sql.DateTime, endExclusive).query(`
          SELECT COUNT(*) AS TotalNewPosts
          FROM Jobs j
          WHERE ${baseWhere}
        `);

      const totalNewPosts = Number(totalRes.recordset?.[0]?.TotalNewPosts || 0);

      let bar = [];
      if (granularity === "month") {
        const map = new Map(
          barRows.map((r) => [
            `${r.YearNum}-${String(r.MonthNum).padStart(2, "0")}`,
            Number(r.Total || 0),
          ])
        );
        bar = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const label = `${year}-${String(m).padStart(2, "0")}`;
          return { label, total: map.get(label) || 0 };
        });
      } else {
        const map = new Map(
          barRows.map((r) => {
            const d = r.DayKey instanceof Date ? r.DayKey : new Date(r.DayKey);
            const label = `${d.getFullYear()}-${String(
              d.getMonth() + 1
            ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            return [label, Number(r.Total || 0)];
          })
        );

        const cursor = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
          0,
          0,
          0,
          0
        );
        const endCursor = new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
          0,
          0,
          0,
          0
        );

        while (cursor.getTime() <= endCursor.getTime()) {
          const label = `${cursor.getFullYear()}-${String(
            cursor.getMonth() + 1
          ).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
          bar.push({ label, total: map.get(label) || 0 });
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      const pieCategories = (pieCategoryRes.recordset || []).map((r) => ({
        name: r.CategoryName || "Chưa chọn",
        value: Number(r.Total || 0),
      }));

      const pieSpecializations = (pieSpecRes.recordset || []).map((r) => ({
        name: r.SpecializationName || "Chưa chọn",
        value: Number(r.Total || 0),
      }));

      return res.status(200).json({
        range,
        year,
        granularity,
        startDate,
        endDate,
        totalNewPosts,
        bar,
        pieCategories,
        pieSpecializations,
      });
    } catch (error) {
      console.error("Lỗi GET /admin/reports/new-posts:", error);
      return res.status(500).json({ message: "Lỗi server." });
    }
  }
);

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
        j.ReasonRejected,
        j.ConfirmedAfterReject,
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
      WHERE j.Status IN (0, 5)
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
        SET Status = 1,
            ApprovedAt = GETDATE(),
            ReasonRejected = NULL,
            ConfirmedAfterReject = NULL
        WHERE JobID = @JobID AND Status IN (0, 5)
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
    const { reasonRejected } = req.body || {};
    if (!id || Number.isNaN(Number(id))) {
      return res.status(400).json({ message: "JobID không hợp lệ." });
    }
    if (!reasonRejected || !String(reasonRejected).trim()) {
      return res.status(400).json({ message: "Vui lòng nhập lý do từ chối." });
    }

    try {
      const pool = await sql.connect(sqlConfig);
      const updateRes = await pool
        .request()
        .input("JobID", sql.Int, Number(id))
        .input("ReasonRejected", sql.NVarChar(sql.MAX), String(reasonRejected))
        .query(
          `
        UPDATE Jobs
        SET Status = 4,
            ApprovedAt = NULL,
            ReasonRejected = @ReasonRejected
        WHERE JobID = @JobID AND Status IN (0, 5)
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