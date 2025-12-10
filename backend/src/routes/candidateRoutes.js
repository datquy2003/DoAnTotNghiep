import express from "express";
import sql from "mssql";
import { sqlConfig } from "../config/db.js";
import { checkAuth } from "../middleware/authMiddleware.js";
import { getMondayOfWeek } from "../config/getMondayOfWeek.js";

const router = express.Router();

const ROLE = {
  EMPLOYER: 3,
};

const ensureEmployerRole = async (pool, userId) => {
  const roleResult = await pool
    .request()
    .input("UserID", sql.NVarChar, userId)
    .query("SELECT TOP 1 RoleID FROM Users WHERE FirebaseUserID = @UserID");

  if (roleResult.recordset[0]?.RoleID !== ROLE.EMPLOYER) {
    const err = new Error("Bạn không có quyền truy cập danh sách ứng viên.");
    err.status = 403;
    throw err;
  }
};

const maskPhoneNumber = (phone) => {
  if (!phone) return null;
  const digits = phone.toString().replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 4) return "*".repeat(digits.length);
  const start = digits.slice(0, 3);
  const end = digits.slice(-2);
  const hidden = "*".repeat(Math.max(digits.length - 5, 2));
  return `${start}${hidden}${end}`;
};

router.get("/me", checkAuth, async (req, res) => {
  const firebaseUid = req.firebaseUser.uid;

  try {
    const pool = await sql.connect(sqlConfig);

    const profileResult = await pool
      .request()
      .input("UserID", sql.NVarChar, firebaseUid)
      .query("SELECT * FROM CandidateProfiles WHERE UserID = @UserID");

    if (profileResult.recordset.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ." });
    }

    const profile = profileResult.recordset[0];

    const specsResult = await pool
      .request()
      .input("CandidateID", sql.NVarChar, firebaseUid).query(`
        SELECT s.SpecializationID, s.SpecializationName, s.CategoryID
        FROM CandidateSpecializations cs
        JOIN Specializations s ON cs.SpecializationID = s.SpecializationID
        WHERE cs.CandidateID = @CandidateID
      `);

    profile.Specializations = specsResult.recordset;

    res.status(200).json(profile);
  } catch (error) {
    console.error("Lỗi GET /candidates/me:", error);
    res.status(500).json({ message: "Lỗi server." });
  }
});

router.get("/searchable", checkAuth, async (req, res) => {
  const employerId = req.firebaseUser.uid;
  const { ageUnder, maxAge, specializationId, specialization, country, city } =
    req.query;

  const ageUnderNum =
    ageUnder && !Number.isNaN(Number(ageUnder))
      ? Number(ageUnder)
      : maxAge && !Number.isNaN(Number(maxAge))
      ? Number(maxAge)
      : null;
  const specIdNum =
    specializationId && !Number.isNaN(Number(specializationId))
      ? Number(specializationId)
      : null;
  const specName = (specialization || "").trim();
  const countryFilter = (country || "").trim();
  const cityFilter = (city || "").trim();

  try {
    const pool = await sql.connect(sqlConfig);
    await ensureEmployerRole(pool, employerId);

    const request = pool
      .request()
      .input("EmployerID", sql.NVarChar, employerId);

    const filters = ["cp.IsSearchable = 1", "u.RoleID = 4"];

    if (ageUnderNum !== null) {
      request.input("AgeUnder", sql.Int, ageUnderNum);
      filters.push("ageCalc.Age IS NOT NULL AND ageCalc.Age <= @AgeUnder");
    }

    if (specIdNum !== null) {
      request.input("SpecID", sql.Int, specIdNum);
      filters.push(
        "EXISTS (SELECT 1 FROM CandidateSpecializations cs WHERE cs.CandidateID = cp.UserID AND cs.SpecializationID = @SpecID)"
      );
    }

    if (specName) {
      request.input("SpecName", sql.NVarChar, `%${specName}%`);
      filters.push(
        `EXISTS (
          SELECT 1 
          FROM CandidateSpecializations cs
          JOIN Specializations s ON cs.SpecializationID = s.SpecializationID
          WHERE cs.CandidateID = cp.UserID AND s.SpecializationName LIKE @SpecName
        )`
      );
    }

    if (countryFilter) {
      request.input("Country", sql.NVarChar, `%${countryFilter}%`);
      filters.push("cp.Country LIKE @Country");
    }

    if (cityFilter) {
      request.input("City", sql.NVarChar, `%${cityFilter}%`);
      filters.push("cp.City LIKE @City");
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await request.query(`
      SELECT 
        cp.UserID AS CandidateID,
        cp.FullName,
        cp.PhoneNumber,
        cp.Birthday,
        cp.City,
        cp.Country,
        cp.ProfileSummary,
        cp.LastPushedAt,
        u.CreatedAt,
        ageCalc.Age,
        specs.SpecJson,
        cvTop.CVID AS DefaultCVID,
        cvTop.CVName AS DefaultCVName,
        cvTop.CVFileUrl AS DefaultCVUrl,
        vip.PlanName AS CurrentVIP,
        vip.EndDate AS CurrentVIPUntil
      FROM CandidateProfiles cp
      JOIN Users u ON u.FirebaseUserID = cp.UserID
      OUTER APPLY (
        SELECT CASE
          WHEN cp.Birthday IS NULL THEN NULL
          ELSE DATEDIFF(year, cp.Birthday, GETDATE()) -
            CASE 
              WHEN DATEADD(year, DATEDIFF(year, cp.Birthday, GETDATE()), cp.Birthday) > GETDATE() THEN 1 
              ELSE 0 
            END
        END AS Age
      ) ageCalc
      OUTER APPLY (
        SELECT (
          SELECT 
            s.SpecializationID AS id, 
            s.SpecializationName AS name
          FROM CandidateSpecializations cs
          JOIN Specializations s ON cs.SpecializationID = s.SpecializationID
          WHERE cs.CandidateID = cp.UserID
          FOR JSON PATH
        ) AS SpecJson
      ) specs
      OUTER APPLY (
        SELECT TOP 1 
          CVID, CVName, CVFileUrl
        FROM CVs
        WHERE UserID = cp.UserID AND IsLocked = 0
        ORDER BY IsDefault DESC, CreatedAt DESC, CVID DESC
      ) cvTop
      OUTER APPLY (
        SELECT TOP 1
          ISNULL(us.SnapshotPlanName, sp.PlanName) AS PlanName,
          us.EndDate
        FROM UserSubscriptions us
        LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
        WHERE us.UserID = cp.UserID AND us.Status = 1 AND us.EndDate > GETDATE()
        ORDER BY us.EndDate DESC
      ) vip
      ${whereClause}
      ORDER BY 
        ISNULL(cp.LastPushedAt, u.CreatedAt) DESC,
        cp.LastPushedAt DESC,
        u.CreatedAt DESC
    `);

    const candidates = result.recordset.map((row) => {
      let specializations = [];
      if (row.SpecJson) {
        try {
          specializations = JSON.parse(row.SpecJson);
        } catch (err) {
          console.warn("Không parse được SpecJson:", err);
        }
      }

      return {
        candidateId: row.CandidateID,
        fullName: row.FullName,
        age: row.Age,
        birthday: row.Birthday,
        city: row.City,
        country: row.Country,
        profileSummary: row.ProfileSummary,
        phoneMasked: maskPhoneNumber(row.PhoneNumber),
        createdAt: row.CreatedAt,
        defaultCv: row.DefaultCVName
          ? {
              id: row.DefaultCVID,
              name: row.DefaultCVName,
              url: row.DefaultCVUrl,
            }
          : null,
        specializations,
        isVip: !!row.CurrentVIP,
        vipLabel: row.CurrentVIP || null,
        lastPushedAt: row.LastPushedAt,
      };
    });

    return res.status(200).json({ candidates });
  } catch (error) {
    const status = error.status || 500;
    console.error("Lỗi GET /candidates/searchable:", error);
    return res.status(status).json({
      message:
        status === 403
          ? error.message || "Bạn không có quyền xem danh sách này."
          : "Lỗi server khi lấy danh sách ứng viên.",
    });
  }
});

router.put("/me", checkAuth, async (req, res) => {
  const firebaseUid = req.firebaseUser.uid;
  const {
    FullName,
    PhoneNumber,
    Birthday,
    Address,
    ProfileSummary,
    City,
    Country,
    IsSearchable,
    SpecializationIDs,
  } = req.body;

  if (
    SpecializationIDs &&
    Array.isArray(SpecializationIDs) &&
    SpecializationIDs.length > 5
  ) {
    return res
      .status(400)
      .json({ message: "Bạn chỉ được chọn tối đa 5 chuyên môn." });
  }

  try {
    const pool = await sql.connect(sqlConfig);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await transaction
        .request()
        .input("UserID", sql.NVarChar, firebaseUid)
        .input("FullName", sql.NVarChar, FullName || null)
        .input("PhoneNumber", sql.NVarChar, PhoneNumber || null)
        .input("Birthday", sql.Date, Birthday || null)
        .input("Address", sql.NVarChar, Address || null)
        .input("ProfileSummary", sql.NText, ProfileSummary || null)
        .input("City", sql.NVarChar, City || null)
        .input("Country", sql.NVarChar, Country || null)
        .input("IsSearchable", sql.Bit, IsSearchable ?? 0).query(`
          MERGE INTO CandidateProfiles AS target
          USING (VALUES (@UserID)) AS source (UserID)
          ON (target.UserID = source.UserID)
          WHEN MATCHED THEN
            UPDATE SET 
              FullName = @FullName,
              PhoneNumber = @PhoneNumber,
              Birthday = @Birthday,
              Address = @Address,
              ProfileSummary = @ProfileSummary,
              City = @City,
              Country = @Country,
              IsSearchable = @IsSearchable
          WHEN NOT MATCHED BY TARGET THEN
            INSERT (UserID, FullName, PhoneNumber, Birthday, Address, ProfileSummary, City, Country, IsSearchable)
            VALUES (@UserID, @FullName, @PhoneNumber, @Birthday, @Address, @ProfileSummary, @City, @Country, @IsSearchable);
        `);

      if (SpecializationIDs && Array.isArray(SpecializationIDs)) {
        await transaction
          .request()
          .input("CandidateID", sql.NVarChar, firebaseUid)
          .query(
            "DELETE FROM CandidateSpecializations WHERE CandidateID = @CandidateID"
          );

        for (const specId of SpecializationIDs) {
          await transaction
            .request()
            .input("CandidateID", sql.NVarChar, firebaseUid)
            .input("SpecializationID", sql.Int, specId).query(`
              INSERT INTO CandidateSpecializations (CandidateID, SpecializationID)
              VALUES (@CandidateID, @SpecializationID)
            `);
        }
      }

      await transaction.commit();
      res.status(200).json({ message: "Cập nhật hồ sơ thành công." });
    } catch (transError) {
      await transaction.rollback();
      console.error("Transaction Error:", transError);
      throw transError;
    }
  } catch (error) {
    console.error("Lỗi PUT /candidates/me:", error);
    res.status(500).json({ message: "Lỗi server khi cập nhật hồ sơ." });
  }
});

router.get("/me/push-top/remaining", checkAuth, async (req, res) => {
  const candidateId = req.firebaseUser.uid;

  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool
      .request()
      .input("CandidateID", sql.NVarChar, candidateId).query(`
        SELECT 
          cp.LastPushedAt,
          cp.PushTopCount,
          (
            SELECT TOP 1 ISNULL(us.Snapshot_PushTopDaily, sp.Limit_PushTopDaily)
            FROM UserSubscriptions us
            LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
            WHERE us.UserID = @CandidateID AND us.Status = 1 AND us.EndDate > GETDATE()
            ORDER BY us.EndDate DESC
          ) AS VipLimitDaily
        FROM CandidateProfiles cp
        WHERE cp.UserID = @CandidateID
      `);

    const profile = result.recordset[0];
    if (!profile) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy hồ sơ để tính lượt đẩy top." });
    }

    const now = new Date();
    const lastPush = profile.LastPushedAt
      ? new Date(profile.LastPushedAt)
      : null;
    const vipLimit = profile.VipLimitDaily || 0;

    if (vipLimit > 0) {
      const nowVN = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const lastVN = lastPush
        ? new Date(lastPush.getTime() + 7 * 60 * 60 * 1000)
        : null;

      let usedToday = profile.PushTopCount || 0;
      if (
        !lastVN ||
        lastVN.getUTCFullYear() !== nowVN.getUTCFullYear() ||
        lastVN.getUTCMonth() !== nowVN.getUTCMonth() ||
        lastVN.getUTCDate() !== nowVN.getUTCDate()
      ) {
        usedToday = 0;
      }

      const remaining = Math.max(vipLimit - usedToday, 0);

      return res.status(200).json({
        scope: "daily",
        limit: vipLimit,
        usedToday,
        remaining,
        lastPushedAt: profile.LastPushedAt || null,
      });
    }

    let usedThisWeek = 0;
    if (lastPush && getMondayOfWeek(lastPush) === getMondayOfWeek(now)) {
      usedThisWeek = 1;
    }
    const remaining = Math.max(1 - usedThisWeek, 0);

    return res.status(200).json({
      scope: "weekly",
      limit: 1,
      usedThisWeek,
      remaining,
      lastPushedAt: profile.LastPushedAt || null,
    });
  } catch (error) {
    console.error("Lỗi GET /candidates/me/push-top/remaining:", error);
    res
      .status(500)
      .json({ message: "Lỗi server khi lấy lượt đẩy top còn lại." });
  }
});

router.post("/me/push-top", checkAuth, async (req, res) => {
  const candidateId = req.firebaseUser.uid;

  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool
      .request()
      .input("CandidateID", sql.NVarChar, candidateId).query(`
        SELECT 
          cp.UserID,
          cp.LastPushedAt,
          cp.PushTopCount,
          (
            SELECT TOP 1 Snapshot_PushTopDaily 
            FROM UserSubscriptions
            WHERE UserID = @CandidateID AND Status = 1 AND EndDate > GETDATE()
            ORDER BY EndDate DESC
          ) AS VipLimitDaily
        FROM CandidateProfiles cp
        WHERE cp.UserID = @CandidateID
      `);

    const profile = result.recordset[0];

    if (!profile) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy hồ sơ để đẩy top." });
    }

    const now = new Date();
    const isVip = profile.VipLimitDaily && profile.VipLimitDaily > 0;

    if (isVip) {
      const dailyLimit = profile.VipLimitDaily;
      let currentCount = profile.PushTopCount || 0;

      if (profile.LastPushedAt) {
        const lastPush = new Date(profile.LastPushedAt);
        const nowVN = new Date(now.getTime() + 7 * 3600000);
        const lastPushVN = new Date(lastPush.getTime() + 7 * 3600000);

        if (
          lastPushVN.getUTCDate() !== nowVN.getUTCDate() ||
          lastPushVN.getUTCMonth() !== nowVN.getUTCMonth() ||
          lastPushVN.getUTCFullYear() !== nowVN.getUTCFullYear()
        ) {
          currentCount = 0;
        }
      } else {
        currentCount = 0;
      }

      if (currentCount >= dailyLimit) {
        return res.status(403).json({
          message: `Bạn đã dùng hết ${currentCount}/${dailyLimit} lượt đẩy top trong ngày hôm nay. Vui lòng quay lại vào ngày mai.`,
        });
      }

      const newCount = currentCount + 1;

      await pool
        .request()
        .input("CandidateID", sql.NVarChar, candidateId)
        .input("NewCount", sql.Int, newCount).query(`
          UPDATE CandidateProfiles
          SET PushTopCount = @NewCount, LastPushedAt = GETDATE()
          WHERE UserID = @CandidateID
        `);

      return res.status(200).json({
        message: `Đẩy top thành công! (${newCount}/${dailyLimit} lượt hôm nay)`,
      });
    }

    if (profile.LastPushedAt) {
      const lastPushedDate = new Date(profile.LastPushedAt);

      const currentMonday = getMondayOfWeek(now);
      const lastPushMonday = getMondayOfWeek(lastPushedDate);

      if (currentMonday === lastPushMonday) {
        return res.status(403).json({
          message:
            "Tài khoản thường chỉ được đẩy top 1 lần/tuần. Vui lòng quay lại vào Thứ Hai tuần sau.",
        });
      }
    }

    await pool.request().input("CandidateID", sql.NVarChar, candidateId).query(`
        UPDATE CandidateProfiles
        SET LastPushedAt = GETDATE(), PushTopCount = 1
        WHERE UserID = @CandidateID
      `);

    return res.status(200).json({
      message: "Đẩy top thành công! (Reset vào Thứ Hai tuần sau)",
    });
  } catch (error) {
    console.error("Lỗi đẩy top hồ sơ:", error);
    res.status(500).json({ message: "Lỗi server khi đẩy top hồ sơ." });
  }
});

export default router;