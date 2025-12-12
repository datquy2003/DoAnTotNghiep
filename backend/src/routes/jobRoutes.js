import express from "express";
import sql from "mssql";
import { sqlConfig } from "../config/db.js";
import { checkAuth } from "../middleware/authMiddleware.js";
import { getMondayOfWeek } from "../config/getMondayOfWeek.js";

const router = express.Router();

router.get("/my-jobs", checkAuth, async (req, res) => {
  const employerId = req.firebaseUser.uid;
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool
      .request()
      .input("OwnerUserID", sql.NVarChar, employerId).query(`
        SELECT j.*, c.CompanyName 
        FROM Jobs j
        JOIN Companies c ON j.CompanyID = c.CompanyID
        WHERE c.OwnerUserID = @OwnerUserID
        ORDER BY j.LastPushedAt DESC, j.CreatedAt DESC
      `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Lỗi lấy danh sách job:", error);
    res.status(500).json({ message: "Lỗi server." });
  }
});

router.post("/", checkAuth, async (req, res) => {
  const employerId = req.firebaseUser.uid;
  const {
    JobTitle,
    CategoryID,
    SpecializationID,
    Location,
    JobType,
    SalaryMin,
    SalaryMax,
    Experience,
    JobDescription,
    Requirements,
    ExpiresAt,
  } = req.body || {};

  if (!JobTitle || !JobDescription || !ExpiresAt) {
    return res.status(400).json({
      message: "Thiếu thông tin bắt buộc (tiêu đề, mô tả, ngày hết hạn).",
    });
  }

  try {
    const pool = await sql.connect(sqlConfig);
    // Lấy company theo chủ sở hữu (mỗi NTD có ít nhất 1 công ty)
    const companyResult = await pool
      .request()
      .input("OwnerUserID", sql.NVarChar, employerId)
      .query(
        "SELECT TOP 1 CompanyID FROM Companies WHERE OwnerUserID = @OwnerUserID ORDER BY CompanyID ASC"
      );

    const company = companyResult.recordset[0];
    if (!company) {
      return res.status(400).json({
        message: "Bạn chưa có thông tin công ty. Vui lòng tạo công ty trước.",
      });
    }

    const expiresDate = new Date(ExpiresAt);
    const now = new Date();
    if (Number.isNaN(expiresDate.getTime()) || expiresDate < now) {
      return res.status(400).json({
        message: "Ngày hết hạn không hợp lệ (không được nhỏ hơn hiện tại).",
      });
    }

    const insertResult = await pool
      .request()
      .input("CompanyID", sql.Int, company.CompanyID)
      .input("CategoryID", CategoryID ? sql.Int : sql.Int, CategoryID || null)
      .input(
        "SpecializationID",
        SpecializationID ? sql.Int : sql.Int,
        SpecializationID || null
      )
      .input("JobTitle", sql.NVarChar, JobTitle)
      .input("JobDescription", sql.NVarChar(sql.MAX), JobDescription)
      .input("Requirements", sql.NVarChar(sql.MAX), Requirements || null)
      .input("SalaryMin", sql.Decimal(18, 2), SalaryMin || null)
      .input("SalaryMax", sql.Decimal(18, 2), SalaryMax || null)
      .input("Location", sql.NVarChar, Location || null)
      .input("JobType", sql.NVarChar, JobType || null)
      .input("Experience", sql.NVarChar, Experience || null)
      .input("ExpiresAt", sql.DateTime, expiresDate)
      .query(
        `INSERT INTO Jobs 
        (CompanyID, CategoryID, SpecializationID, JobTitle, JobDescription, Requirements, SalaryMin, SalaryMax, Location, JobType, Experience, ExpiresAt, Status)
        OUTPUT inserted.*
        VALUES
        (@CompanyID, @CategoryID, @SpecializationID, @JobTitle, @JobDescription, @Requirements, @SalaryMin, @SalaryMax, @Location, @JobType, @Experience, @ExpiresAt, 0)`
      );

    return res.status(201).json(insertResult.recordset[0]);
  } catch (error) {
    console.error("Lỗi tạo bài đăng:", error);
    return res.status(500).json({ message: "Lỗi server khi tạo bài đăng." });
  }
});

router.post("/:id/push-top", checkAuth, async (req, res) => {
  const { id } = req.params;
  const employerId = req.firebaseUser.uid;

  try {
    const pool = await sql.connect(sqlConfig);

    const result = await pool
      .request()
      .input("JobID", sql.Int, id)
      .input("EmployerID", sql.NVarChar, employerId).query(`
        SELECT 
            j.JobID, j.LastPushedAt, 
            c.CompanyID, c.PushTopCount, c.LastPushResetAt,
            -- Lấy giới hạn đẩy top từ gói VIP đang kích hoạt
            (SELECT TOP 1 Snapshot_PushTopDaily 
             FROM UserSubscriptions 
             WHERE UserID = @EmployerID AND Status = 1 AND EndDate > GETDATE()
             ORDER BY EndDate DESC) as VipLimitDaily
        FROM Jobs j
        JOIN Companies c ON j.CompanyID = c.CompanyID
        WHERE j.JobID = @JobID AND c.OwnerUserID = @EmployerID
      `);

    const data = result.recordset[0];

    if (!data) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bài đăng hoặc bạn không có quyền." });
    }

    const isVip = data.VipLimitDaily && data.VipLimitDaily > 0;
    const now = new Date();

    if (isVip) {
      const dailyLimit = data.VipLimitDaily;
      let currentCount = data.PushTopCount || 0;

      if (data.LastPushResetAt) {
        const lastReset = new Date(data.LastPushResetAt);
        const nowVN = new Date(now.getTime() + 7 * 3600000);
        const lastResetVN = new Date(lastReset.getTime() + 7 * 3600000);

        if (
          lastResetVN.getUTCDate() !== nowVN.getUTCDate() ||
          lastResetVN.getUTCMonth() !== nowVN.getUTCMonth() ||
          lastResetVN.getUTCFullYear() !== nowVN.getUTCFullYear()
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
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        await transaction
          .request()
          .input("CompanyID", sql.Int, data.CompanyID)
          .input("NewCount", sql.Int, newCount).query(`
                    UPDATE Companies 
                    SET PushTopCount = @NewCount, LastPushResetAt = GETDATE() 
                    WHERE CompanyID = @CompanyID
                `);

        await transaction
          .request()
          .input("JobID", sql.Int, id)
          .query(
            "UPDATE Jobs SET LastPushedAt = GETDATE() WHERE JobID = @JobID"
          );

        await transaction.commit();
        return res.status(200).json({
          message: `Đẩy top thành công! (${newCount}/${dailyLimit} lượt hôm nay)`,
        });
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    } else {
      if (data.LastPushedAt) {
        const lastPushedDate = new Date(data.LastPushedAt);

        const currentMonday = getMondayOfWeek(now);
        const lastPushMonday = getMondayOfWeek(lastPushedDate);

        if (currentMonday === lastPushMonday) {
          return res.status(403).json({
            message:
              "Tài khoản thường chỉ được đẩy top 1 lần/tuần. Vui lòng quay lại vào Thứ Hai tuần sau.",
          });
        }
      }

      await pool
        .request()
        .input("JobID", sql.Int, id)
        .query("UPDATE Jobs SET LastPushedAt = GETDATE() WHERE JobID = @JobID");

      return res
        .status(200)
        .json({ message: "Đẩy top thành công! (Reset vào Thứ Hai tuần sau)" });
    }
  } catch (error) {
    console.error("Lỗi đẩy top job:", error);
    res.status(500).json({ message: "Lỗi server." });
  }
});

export default router;