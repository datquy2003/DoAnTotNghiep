import express from "express";
import sql from "mssql";
import crypto from "crypto";
import { sqlConfig } from "../config/db.js";
import { checkAuth } from "../middleware/authMiddleware.js";
import { getMondayOfWeek } from "../config/getMondayOfWeek.js";
import { DEFAULT_LIMITS } from "../config/limitConstants.js";

const router = express.Router();

router.get("/my-jobs", checkAuth, async (req, res) => {
  const employerId = req.firebaseUser.uid;
  try {
    const pool = await sql.connect(sqlConfig);

    const schemaRes = await pool.request().query(`
      SELECT 
        CASE WHEN COL_LENGTH('JobWorkingShifts','ShiftGroupID') IS NULL THEN 0 ELSE 1 END AS HasShiftGroup,
        CASE WHEN COL_LENGTH('JobWorkingShifts','RangeDayFrom') IS NULL THEN 0 ELSE 1 END AS HasRangeDayFrom,
        CASE WHEN COL_LENGTH('JobWorkingShifts','RangeDayTo') IS NULL THEN 0 ELSE 1 END AS HasRangeDayTo
    `);

    const hasShiftGroup = schemaRes.recordset?.[0]?.HasShiftGroup === 1;
    const hasRangeDayFrom = schemaRes.recordset?.[0]?.HasRangeDayFrom === 1;
    const hasRangeDayTo = schemaRes.recordset?.[0]?.HasRangeDayTo === 1;

    const workingTimesSubquery =
      hasShiftGroup && hasRangeDayFrom && hasRangeDayTo
        ? `
          (
            SELECT
              ISNULL(CONVERT(varchar(36), s.ShiftGroupID), CONCAT('legacy-', s.ShiftID)) AS id,
              CASE COALESCE(s.RangeDayFrom, s.DayOfWeek)
                WHEN 1 THEN N'Thứ 2'
                WHEN 2 THEN N'Thứ 3'
                WHEN 3 THEN N'Thứ 4'
                WHEN 4 THEN N'Thứ 5'
                WHEN 5 THEN N'Thứ 6'
                WHEN 6 THEN N'Thứ 7'
                WHEN 7 THEN N'Chủ nhật'
              END AS dayFrom,
              CASE COALESCE(s.RangeDayTo, s.DayOfWeek)
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
            GROUP BY
              ISNULL(CONVERT(varchar(36), s.ShiftGroupID), CONCAT('legacy-', s.ShiftID)),
              COALESCE(s.RangeDayFrom, s.DayOfWeek),
              COALESCE(s.RangeDayTo, s.DayOfWeek),
              s.TimeFrom,
              s.TimeTo
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

    const result = await pool
      .request()
      .input("OwnerUserID", sql.NVarChar, employerId).query(`
        SELECT 
          j.*, 
          c.CompanyName,
          (SELECT COUNT(*) FROM Applications a WHERE a.JobID = j.JobID) AS TotalApplicants,
          ${workingTimesSubquery} AS WorkingTimes
        FROM Jobs j
        JOIN Companies c ON j.CompanyID = c.CompanyID
        WHERE c.OwnerUserID = @OwnerUserID
        ORDER BY
          COALESCE(
            CASE
              WHEN j.LastPushedAt IS NULL THEN j.ApprovedAt
              WHEN j.ApprovedAt IS NULL THEN j.LastPushedAt
              WHEN j.LastPushedAt >= j.ApprovedAt THEN j.LastPushedAt
              ELSE j.ApprovedAt
            END,
            j.CreatedAt
          ) DESC,
          j.CreatedAt DESC
      `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Lỗi lấy danh sách job:", error);
    res.status(500).json({ message: "Lỗi server." });
  }
});

router.get("/applied", checkAuth, async (req, res) => {
  const candidateId = req.firebaseUser.uid;
  try {
    const pool = await sql.connect(sqlConfig);

    const roleRes = await pool
      .request()
      .input("UserID", sql.NVarChar, candidateId)
      .query("SELECT TOP 1 RoleID FROM Users WHERE FirebaseUserID = @UserID");
    const roleId = roleRes.recordset?.[0]?.RoleID ?? null;
    if (Number(roleId) !== 4) {
      return res.status(403).json({
        message: "Chỉ ứng viên mới có thể xem danh sách đã ứng tuyển.",
      });
    }

    const result = await pool
      .request()
      .input("CandidateID", sql.NVarChar, candidateId).query(`
        SELECT
          a.ApplicationID,
          a.AppliedAt,
          a.CurrentStatus,
          a.StatusUpdatedAt,
          a.CVID,
          cv.CVName,
          cv.CVFileUrl,
          j.JobID,
          j.JobTitle,
          j.Location,
          j.SalaryMin,
          j.SalaryMax,
          j.Experience,
          j.CreatedAt,
          j.ApprovedAt,
          j.LastPushedAt,
          j.ExpiresAt,
          j.Status AS JobStatus,
          c.CompanyID,
          c.CompanyName,
          sp.SpecializationName
        FROM Applications a
        JOIN Jobs j ON j.JobID = a.JobID
        JOIN Companies c ON c.CompanyID = j.CompanyID
        LEFT JOIN Specializations sp ON sp.SpecializationID = j.SpecializationID
        LEFT JOIN CVs cv ON cv.CVID = a.CVID
        WHERE a.CandidateID = @CandidateID
        ORDER BY a.AppliedAt DESC, a.ApplicationID DESC
      `);

    return res.status(200).json(result.recordset || []);
  } catch (error) {
    console.error("Lỗi GET /jobs/applied:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.get("/:id/applicants", checkAuth, async (req, res) => {
  const employerId = req.firebaseUser.uid;
  const jobId = Number(req.params.id);
  if (!jobId || Number.isNaN(jobId)) {
    return res.status(400).json({ message: "JobID không hợp lệ." });
  }

  try {
    const pool = await sql.connect(sqlConfig);

    const roleRes = await pool
      .request()
      .input("UserID", sql.NVarChar, employerId)
      .query("SELECT TOP 1 RoleID FROM Users WHERE FirebaseUserID = @UserID");
    const roleId = roleRes.recordset?.[0]?.RoleID ?? null;
    if (Number(roleId) !== 3) {
      return res.status(403).json({
        message: "Bạn không có quyền xem danh sách ứng viên của bài đăng.",
      });
    }

    const ownRes = await pool
      .request()
      .input("JobID", sql.Int, jobId)
      .input("EmployerID", sql.NVarChar, employerId).query(`
        SELECT TOP 1 j.JobID, j.JobTitle
        FROM Jobs j
        JOIN Companies c ON j.CompanyID = c.CompanyID
        WHERE j.JobID = @JobID AND c.OwnerUserID = @EmployerID
      `);

    const job = ownRes.recordset?.[0];
    if (!job) {
      return res.status(404).json({
        message: "Không tìm thấy bài đăng hoặc bạn không có quyền truy cập.",
      });
    }

    const result = await pool.request().input("JobID", sql.Int, jobId).query(`
        SELECT
          a.ApplicationID,
          a.AppliedAt,
          a.CurrentStatus,
          a.StatusUpdatedAt,
          a.CandidateID,
          u.Email AS CandidateEmail,
          cp.FullName,
          cp.Birthday,
          cp.City,
          cp.Country,
          cp.ProfileSummary,
          cp.PhoneNumber,
          cv.CVID,
          cv.CVName,
          cv.CVFileUrl
        FROM Applications a
        JOIN Users u ON u.FirebaseUserID = a.CandidateID
        LEFT JOIN CandidateProfiles cp ON cp.UserID = a.CandidateID
        LEFT JOIN CVs cv ON cv.CVID = a.CVID
        WHERE a.JobID = @JobID
        ORDER BY a.AppliedAt DESC, a.ApplicationID DESC
      `);

    const applicants = (result.recordset || []).map((row) => ({
      applicationId: row.ApplicationID,
      appliedAt: row.AppliedAt,
      currentStatus: row.CurrentStatus,
      statusUpdatedAt: row.StatusUpdatedAt,
      candidateId: row.CandidateID,
      candidateEmail: row.CandidateEmail,
      fullName: row.FullName,
      birthday: row.Birthday,
      city: row.City,
      country: row.Country,
      profileSummary: row.ProfileSummary,
      phoneNumber: row.PhoneNumber || null,
      cv: row.CVID
        ? {
            id: row.CVID,
            name: row.CVName,
            url: row.CVFileUrl,
          }
        : null,
    }));

    return res.status(200).json({
      jobId,
      jobTitle: job.JobTitle || "",
      total: applicants.length,
      applicants,
    });
  } catch (error) {
    console.error("Lỗi GET /jobs/:id/applicants:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.get("/active", checkAuth, async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const userId = req.firebaseUser.uid;
    const result = await pool.request().input("UserID", sql.NVarChar, userId)
      .query(`
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
        j.LastPushedAt,
        j.Status,
        c.CompanyID,
        c.CompanyName,
        cat.CategoryName,
        sp.SpecializationName,
        CASE WHEN EXISTS (
          SELECT 1 FROM Applications a
          WHERE a.JobID = j.JobID AND a.CandidateID = @UserID
        ) THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS HasApplied
      FROM Jobs j
      JOIN Companies c ON j.CompanyID = c.CompanyID
      LEFT JOIN Categories cat ON j.CategoryID = cat.CategoryID
      LEFT JOIN Specializations sp ON j.SpecializationID = sp.SpecializationID
      WHERE j.Status = 1
        AND (j.ExpiresAt IS NULL OR j.ExpiresAt > GETDATE())
      ORDER BY j.LastPushedAt DESC, j.CreatedAt DESC
    `);
    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Lỗi lấy danh sách job đang tuyển:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.post("/:id/apply", checkAuth, async (req, res) => {
  const candidateId = req.firebaseUser.uid;
  const jobId = Number(req.params.id);
  const { cvId } = req.body || {};
  const requestedCvId = cvId != null && cvId !== "" ? Number(cvId) : null;

  if (!jobId || Number.isNaN(jobId)) {
    return res.status(400).json({ message: "JobID không hợp lệ." });
  }
  if (requestedCvId != null && Number.isNaN(requestedCvId)) {
    return res.status(400).json({ message: "CVID không hợp lệ." });
  }

  try {
    const pool = await sql.connect(sqlConfig);

    const roleRes = await pool
      .request()
      .input("UserID", sql.NVarChar, candidateId)
      .query("SELECT TOP 1 RoleID FROM Users WHERE FirebaseUserID = @UserID");
    const roleId = roleRes.recordset?.[0]?.RoleID ?? null;
    if (Number(roleId) !== 4) {
      return res.status(403).json({
        message: "Chỉ ứng viên mới có thể ứng tuyển vào tin tuyển dụng.",
      });
    }

    const jobRes = await pool.request().input("JobID", sql.Int, jobId).query(`
      SELECT TOP 1 JobID, Status, ExpiresAt
      FROM Jobs
      WHERE JobID = @JobID
    `);
    const job = jobRes.recordset?.[0];
    if (!job) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tin tuyển dụng." });
    }
    if (Number(job.Status) !== 1) {
      return res.status(400).json({
        message: "Tin tuyển dụng hiện không ở trạng thái đang tuyển.",
      });
    }
    if (job.ExpiresAt && new Date(job.ExpiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ message: "Tin tuyển dụng đã hết hạn." });
    }

    let finalCvId = requestedCvId;
    if (!finalCvId) {
      const defCvRes = await pool
        .request()
        .input("UserID", sql.NVarChar, candidateId)
        .query(
          "SELECT TOP 1 CVID FROM CVs WHERE UserID = @UserID AND IsDefault = 1 ORDER BY CVID DESC"
        );
      finalCvId = defCvRes.recordset?.[0]?.CVID || null;
    }

    if (!finalCvId) {
      return res.status(400).json({
        message:
          "Bạn chưa có CV mặc định. Vui lòng tải lên CV và đặt làm mặc định trước khi ứng tuyển.",
      });
    }

    const cvRes = await pool
      .request()
      .input("CVID", sql.Int, finalCvId)
      .input("UserID", sql.NVarChar, candidateId)
      .query(
        "SELECT TOP 1 CVID FROM CVs WHERE CVID = @CVID AND UserID = @UserID"
      );
    if (!cvRes.recordset?.[0]) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền dùng CV này." });
    }

    const existsRes = await pool
      .request()
      .input("JobID", sql.Int, jobId)
      .input("CandidateID", sql.NVarChar, candidateId)
      .query(
        "SELECT TOP 1 ApplicationID FROM Applications WHERE JobID = @JobID AND CandidateID = @CandidateID"
      );
    if (existsRes.recordset?.[0]) {
      return res
        .status(400)
        .json({ message: "Bạn đã ứng tuyển vào công việc này rồi." });
    }

    await pool
      .request()
      .input("JobID", sql.Int, jobId)
      .input("CandidateID", sql.NVarChar, candidateId)
      .input("CVID", sql.Int, finalCvId)
      .query(
        `
        INSERT INTO Applications (JobID, CandidateID, CVID, AppliedAt, CurrentStatus, StatusUpdatedAt)
        VALUES (@JobID, @CandidateID, @CVID, GETDATE(), 0, GETDATE())
        `
      );

    return res.status(201).json({ message: "Ứng tuyển thành công." });
  } catch (error) {
    console.error("Lỗi ứng tuyển:", error);
    return res.status(500).json({ message: "Lỗi server." });
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
    EducationLevel,
    VacancyCount,
    WorkingTimes,
    JobDescription,
    Requirements,
    Benefits,
    ExpiresAt,
  } = req.body || {};

  if (!JobTitle || !JobDescription || !ExpiresAt) {
    return res.status(400).json({
      message: "Thiếu thông tin bắt buộc (tiêu đề, mô tả, ngày hết hạn).",
    });
  }

  try {
    const pool = await sql.connect(sqlConfig);
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

    const vipLimitRes = await pool
      .request()
      .input("EmployerID", sql.NVarChar, employerId).query(`
        SELECT TOP 1 
          ISNULL(us.Snapshot_JobPostDaily, sp.Limit_JobPostDaily) AS VipJobPostDaily
        FROM UserSubscriptions us
        LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
        WHERE us.UserID = @EmployerID
          AND us.Status = 1
          AND us.EndDate > GETDATE()
          AND ISNULL(us.SnapshotPlanType, sp.PlanType) <> 'ONE_TIME'
        ORDER BY us.EndDate DESC
      `);

    const vipJobPostDaily = vipLimitRes.recordset?.[0]?.VipJobPostDaily || 0;
    const dailyLimit =
      vipJobPostDaily > 0
        ? vipJobPostDaily
        : DEFAULT_LIMITS?.EMPLOYER?.JOB_POST_DAILY || 0;

    if (dailyLimit > 0) {
      const countRes = await pool
        .request()
        .input("CompanyID", sql.Int, company.CompanyID).query(`
          DECLARE @start DATETIME = CONVERT(DATETIME, CONVERT(DATE, GETDATE()));
          DECLARE @end DATETIME = DATEADD(DAY, 1, @start);

          SELECT COUNT(*) AS Total
          FROM Jobs
          WHERE CompanyID = @CompanyID
            AND CreatedAt >= @start
            AND CreatedAt < @end
        `);

      const totalToday = countRes.recordset?.[0]?.Total || 0;
      if (totalToday >= dailyLimit) {
        return res.status(403).json({
          message: `Bạn đã đăng đủ ${dailyLimit} bài trong hôm nay. Vui lòng thử lại vào ngày mai.`,
        });
      }
    }

    const expiresDate = new Date(ExpiresAt);
    const now = new Date();
    if (Number.isNaN(expiresDate.getTime()) || expiresDate < now) {
      return res.status(400).json({
        message: "Ngày hết hạn không hợp lệ (không được nhỏ hơn hiện tại).",
      });
    }

    const dayLabelToNum = {
      "Thứ 2": 1,
      "Thứ 3": 2,
      "Thứ 4": 3,
      "Thứ 5": 4,
      "Thứ 6": 5,
      "Thứ 7": 6,
      "Chủ nhật": 7,
    };

    const parseTimeToMinutes = (s) => {
      const m = /^(\d{2}):(\d{2})$/.exec(String(s || ""));
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
      return hh * 60 + mm;
    };

    const shifts = [];
    const wtArr = Array.isArray(WorkingTimes) ? WorkingTimes : [];

    wtArr.forEach((wt, idx) => {
      const dayFrom = (wt?.dayFrom || "").toString().trim();
      const dayTo = (wt?.dayTo || "").toString().trim();
      const timeFrom = (wt?.timeFrom || "").toString().trim();
      const timeTo = (wt?.timeTo || "").toString().trim();

      if (!dayFrom && !dayTo && !timeFrom && !timeTo) return;

      if (!dayFrom || !dayTo || !timeFrom || !timeTo) {
        throw new Error(
          `WORKING_TIMES_INVALID: Vui lòng nhập đầy đủ thời gian làm việc (dòng ${
            idx + 1
          }).`
        );
      }

      const fromNum = dayLabelToNum[dayFrom];
      const toNum = dayLabelToNum[dayTo];
      if (!fromNum || !toNum) {
        throw new Error(
          `WORKING_TIMES_INVALID: Ngày làm việc không hợp lệ (dòng ${idx + 1}).`
        );
      }

      const fromMin = parseTimeToMinutes(timeFrom);
      const toMin = parseTimeToMinutes(timeTo);
      if (fromMin == null || toMin == null) {
        throw new Error(
          `WORKING_TIMES_INVALID: Giờ làm việc không hợp lệ (dòng ${idx + 1}).`
        );
      }

      const days = [];
      if (fromNum <= toNum) {
        for (let d = fromNum; d <= toNum; d += 1) days.push(d);
      } else {
        for (let d = fromNum; d <= 7; d += 1) days.push(d);
        for (let d = 1; d <= toNum; d += 1) days.push(d);
      }

      const groupId = crypto.randomUUID();
      days.forEach((day) => {
        shifts.push({
          day,
          timeFrom,
          timeTo,
          groupId,
          rangeDayFrom: fromNum,
          rangeDayTo: toNum,
        });
      });
    });

    let tx;
    try {
      tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      const reqTx = () => new sql.Request(tx);

      const insertResult = await reqTx()
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
        .input("Benefits", sql.NVarChar(sql.MAX), Benefits || null)
        .input("EducationLevel", sql.NVarChar, EducationLevel || null)
        .input("VacancyCount", sql.Int, VacancyCount || 1)
        .input("SalaryMin", sql.Decimal(18, 2), SalaryMin || null)
        .input("SalaryMax", sql.Decimal(18, 2), SalaryMax || null)
        .input("Location", sql.NVarChar, Location || null)
        .input("JobType", sql.NVarChar, JobType || null)
        .input("Experience", sql.NVarChar, Experience || null)
        .input("ExpiresAt", sql.DateTime, expiresDate)
        .query(
          `INSERT INTO Jobs 
          (CompanyID, CategoryID, SpecializationID, JobTitle, JobDescription, Requirements, Benefits, EducationLevel, VacancyCount, SalaryMin, SalaryMax, Location, JobType, Experience, ExpiresAt, Status)
          OUTPUT inserted.*
          VALUES
          (@CompanyID, @CategoryID, @SpecializationID, @JobTitle, @JobDescription, @Requirements, @Benefits, @EducationLevel, @VacancyCount, @SalaryMin, @SalaryMax, @Location, @JobType, @Experience, @ExpiresAt, 0)`
        );

      const createdJob = insertResult.recordset?.[0];
      const jobId = createdJob?.JobID;

      if (jobId && shifts.length > 0) {
        const schemaTxRes = await reqTx().query(`
          SELECT 
            CASE WHEN COL_LENGTH('JobWorkingShifts','ShiftGroupID') IS NULL THEN 0 ELSE 1 END AS HasShiftGroup,
            CASE WHEN COL_LENGTH('JobWorkingShifts','RangeDayFrom') IS NULL THEN 0 ELSE 1 END AS HasRangeDayFrom,
            CASE WHEN COL_LENGTH('JobWorkingShifts','RangeDayTo') IS NULL THEN 0 ELSE 1 END AS HasRangeDayTo
        `);
        const canStoreGroups =
          schemaTxRes.recordset?.[0]?.HasShiftGroup === 1 &&
          schemaTxRes.recordset?.[0]?.HasRangeDayFrom === 1 &&
          schemaTxRes.recordset?.[0]?.HasRangeDayTo === 1;

        for (const s of shifts) {
          if (canStoreGroups) {
            await reqTx()
              .input("JobID", sql.Int, jobId)
              .input("DayOfWeek", sql.TinyInt, s.day)
              .input("TimeFrom", sql.VarChar(5), s.timeFrom)
              .input("TimeTo", sql.VarChar(5), s.timeTo)
              .input("ShiftGroupID", sql.UniqueIdentifier, s.groupId)
              .input("RangeDayFrom", sql.TinyInt, s.rangeDayFrom)
              .input("RangeDayTo", sql.TinyInt, s.rangeDayTo)
              .query(
                `
                INSERT INTO JobWorkingShifts (JobID, DayOfWeek, TimeFrom, TimeTo, ShiftGroupID, RangeDayFrom, RangeDayTo)
                VALUES (@JobID, @DayOfWeek, CONVERT(time, @TimeFrom), CONVERT(time, @TimeTo), @ShiftGroupID, @RangeDayFrom, @RangeDayTo)
                `
              );
          } else {
            await reqTx()
              .input("JobID", sql.Int, jobId)
              .input("DayOfWeek", sql.TinyInt, s.day)
              .input("TimeFrom", sql.VarChar(5), s.timeFrom)
              .input("TimeTo", sql.VarChar(5), s.timeTo)
              .query(
                `
                INSERT INTO JobWorkingShifts (JobID, DayOfWeek, TimeFrom, TimeTo)
                VALUES (@JobID, @DayOfWeek, CONVERT(time, @TimeFrom), CONVERT(time, @TimeTo))
                `
              );
          }
        }
      }

      await tx.commit();
      return res.status(201).json(createdJob);
    } catch (err) {
      try {
        if (tx) await tx.rollback();
      } catch (e) {}

      const msg = String(err?.message || "");
      if (msg.startsWith("WORKING_TIMES_INVALID:")) {
        return res.status(400).json({ message: msg.replace(/^.*?:\s*/, "") });
      }
      throw err;
    }
  } catch (error) {
    console.error("Lỗi tạo bài đăng:", error);
    return res.status(500).json({ message: "Lỗi server khi tạo bài đăng." });
  }
});

router.patch("/:id", checkAuth, async (req, res) => {
  const employerId = req.firebaseUser.uid;
  const { id } = req.params;

  if (!id || Number.isNaN(Number(id))) {
    return res.status(400).json({ message: "JobID không hợp lệ." });
  }

  const {
    JobTitle,
    CategoryID,
    SpecializationID,
    Location,
    JobType,
    SalaryMin,
    SalaryMax,
    Experience,
    EducationLevel,
    VacancyCount,
    WorkingTimes,
    JobDescription,
    Requirements,
    Benefits,
    ExpiresAt,
  } = req.body || {};

  if (!JobTitle || !JobDescription || !ExpiresAt) {
    return res.status(400).json({
      message: "Thiếu thông tin bắt buộc (tiêu đề, mô tả, ngày hết hạn).",
    });
  }

  try {
    const pool = await sql.connect(sqlConfig);

    const jobRes = await pool
      .request()
      .input("JobID", sql.Int, Number(id))
      .input("EmployerID", sql.NVarChar, employerId).query(`
        SELECT TOP 1 j.JobID, j.CompanyID, j.Status
        FROM Jobs j
        JOIN Companies c ON j.CompanyID = c.CompanyID
        WHERE j.JobID = @JobID
          AND c.OwnerUserID = @EmployerID
      `);

    const job = jobRes.recordset?.[0];
    if (!job) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bài đăng hoặc bạn không có quyền." });
    }

    if (Number(job.Status) !== 0) {
      return res.status(400).json({
        message: "Chỉ có thể chỉnh sửa bài đăng khi trạng thái là 'Chờ duyệt'.",
      });
    }

    const expiresDate = new Date(ExpiresAt);
    const now = new Date();
    if (Number.isNaN(expiresDate.getTime()) || expiresDate < now) {
      return res.status(400).json({
        message: "Ngày hết hạn không hợp lệ (không được nhỏ hơn hiện tại).",
      });
    }

    const dayLabelToNum = {
      "Thứ 2": 1,
      "Thứ 3": 2,
      "Thứ 4": 3,
      "Thứ 5": 4,
      "Thứ 6": 5,
      "Thứ 7": 6,
      "Chủ nhật": 7,
    };

    const parseTimeToMinutes = (s) => {
      const m = /^(\d{2}):(\d{2})$/.exec(String(s || ""));
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
      return hh * 60 + mm;
    };

    const shifts = [];
    const wtArr = Array.isArray(WorkingTimes) ? WorkingTimes : [];

    wtArr.forEach((wt, idx) => {
      const dayFrom = (wt?.dayFrom || "").toString().trim();
      const dayTo = (wt?.dayTo || "").toString().trim();
      const timeFrom = (wt?.timeFrom || "").toString().trim();
      const timeTo = (wt?.timeTo || "").toString().trim();

      if (!dayFrom && !dayTo && !timeFrom && !timeTo) return;

      if (!dayFrom || !dayTo || !timeFrom || !timeTo) {
        throw new Error(
          `WORKING_TIMES_INVALID: Vui lòng nhập đầy đủ thời gian làm việc (dòng ${
            idx + 1
          }).`
        );
      }

      const fromNum = dayLabelToNum[dayFrom];
      const toNum = dayLabelToNum[dayTo];
      if (!fromNum || !toNum) {
        throw new Error(
          `WORKING_TIMES_INVALID: Ngày làm việc không hợp lệ (dòng ${idx + 1}).`
        );
      }

      const fromMin = parseTimeToMinutes(timeFrom);
      const toMin = parseTimeToMinutes(timeTo);
      if (fromMin == null || toMin == null) {
        throw new Error(
          `WORKING_TIMES_INVALID: Giờ làm việc không hợp lệ (dòng ${idx + 1}).`
        );
      }

      const days = [];
      if (fromNum <= toNum) {
        for (let d = fromNum; d <= toNum; d += 1) days.push(d);
      } else {
        for (let d = fromNum; d <= 7; d += 1) days.push(d);
        for (let d = 1; d <= toNum; d += 1) days.push(d);
      }

      const groupId = crypto.randomUUID();
      days.forEach((day) => {
        shifts.push({
          day,
          timeFrom,
          timeTo,
          groupId,
          rangeDayFrom: fromNum,
          rangeDayTo: toNum,
        });
      });
    });

    let tx;
    try {
      tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      const reqTx = () => new sql.Request(tx);

      const updateRes = await reqTx()
        .input("JobID", sql.Int, Number(id))
        .input("CompanyID", sql.Int, job.CompanyID)
        .input("CategoryID", CategoryID ? sql.Int : sql.Int, CategoryID || null)
        .input(
          "SpecializationID",
          SpecializationID ? sql.Int : sql.Int,
          SpecializationID || null
        )
        .input("JobTitle", sql.NVarChar, JobTitle)
        .input("JobDescription", sql.NVarChar(sql.MAX), JobDescription)
        .input("Requirements", sql.NVarChar(sql.MAX), Requirements || null)
        .input("Benefits", sql.NVarChar(sql.MAX), Benefits || null)
        .input("EducationLevel", sql.NVarChar, EducationLevel || null)
        .input("VacancyCount", sql.Int, VacancyCount || 1)
        .input("SalaryMin", sql.Decimal(18, 2), SalaryMin || null)
        .input("SalaryMax", sql.Decimal(18, 2), SalaryMax || null)
        .input("Location", sql.NVarChar, Location || null)
        .input("JobType", sql.NVarChar, JobType || null)
        .input("Experience", sql.NVarChar, Experience || null)
        .input("ExpiresAt", sql.DateTime, expiresDate)
        .query(
          `
          UPDATE Jobs SET
            CategoryID = @CategoryID,
            SpecializationID = @SpecializationID,
            JobTitle = @JobTitle,
            JobDescription = @JobDescription,
            Requirements = @Requirements,
            Benefits = @Benefits,
            EducationLevel = @EducationLevel,
            VacancyCount = @VacancyCount,
            SalaryMin = @SalaryMin,
            SalaryMax = @SalaryMax,
            Location = @Location,
            JobType = @JobType,
            Experience = @Experience,
            ExpiresAt = @ExpiresAt
          WHERE JobID = @JobID AND CompanyID = @CompanyID AND Status = 0
          `
        );

      const affected = updateRes?.rowsAffected?.[0] || 0;
      if (affected === 0) {
        await tx.rollback();
        return res.status(400).json({
          message:
            "Không thể chỉnh sửa bài đăng (bài có thể đã được duyệt/đổi trạng thái).",
        });
      }

      await reqTx()
        .input("JobID", sql.Int, Number(id))
        .query("DELETE FROM JobWorkingShifts WHERE JobID = @JobID");

      if (shifts.length > 0) {
        const schemaTxRes = await reqTx().query(`
          SELECT 
            CASE WHEN COL_LENGTH('JobWorkingShifts','ShiftGroupID') IS NULL THEN 0 ELSE 1 END AS HasShiftGroup,
            CASE WHEN COL_LENGTH('JobWorkingShifts','RangeDayFrom') IS NULL THEN 0 ELSE 1 END AS HasRangeDayFrom,
            CASE WHEN COL_LENGTH('JobWorkingShifts','RangeDayTo') IS NULL THEN 0 ELSE 1 END AS HasRangeDayTo
        `);
        const canStoreGroups =
          schemaTxRes.recordset?.[0]?.HasShiftGroup === 1 &&
          schemaTxRes.recordset?.[0]?.HasRangeDayFrom === 1 &&
          schemaTxRes.recordset?.[0]?.HasRangeDayTo === 1;

        for (const s of shifts) {
          if (canStoreGroups) {
            await reqTx()
              .input("JobID", sql.Int, Number(id))
              .input("DayOfWeek", sql.TinyInt, s.day)
              .input("TimeFrom", sql.VarChar(5), s.timeFrom)
              .input("TimeTo", sql.VarChar(5), s.timeTo)
              .input("ShiftGroupID", sql.UniqueIdentifier, s.groupId)
              .input("RangeDayFrom", sql.TinyInt, s.rangeDayFrom)
              .input("RangeDayTo", sql.TinyInt, s.rangeDayTo)
              .query(
                `
                INSERT INTO JobWorkingShifts (JobID, DayOfWeek, TimeFrom, TimeTo, ShiftGroupID, RangeDayFrom, RangeDayTo)
                VALUES (@JobID, @DayOfWeek, CONVERT(time, @TimeFrom), CONVERT(time, @TimeTo), @ShiftGroupID, @RangeDayFrom, @RangeDayTo)
                `
              );
          } else {
            await reqTx()
              .input("JobID", sql.Int, Number(id))
              .input("DayOfWeek", sql.TinyInt, s.day)
              .input("TimeFrom", sql.VarChar(5), s.timeFrom)
              .input("TimeTo", sql.VarChar(5), s.timeTo)
              .query(
                `
                INSERT INTO JobWorkingShifts (JobID, DayOfWeek, TimeFrom, TimeTo)
                VALUES (@JobID, @DayOfWeek, CONVERT(time, @TimeFrom), CONVERT(time, @TimeTo))
                `
              );
          }
        }
      }

      await tx.commit();
      return res.status(200).json({ message: "Cập nhật bài đăng thành công." });
    } catch (err) {
      try {
        if (tx) await tx.rollback();
      } catch (e) {}

      const msg = String(err?.message || "");
      if (msg.startsWith("WORKING_TIMES_INVALID:")) {
        return res.status(400).json({ message: msg.replace(/^.*?:\s*/, "") });
      }
      throw err;
    }
  } catch (error) {
    console.error("Lỗi cập nhật bài đăng:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi cập nhật bài đăng." });
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
            c.CompanyID,
            (SELECT TOP 1 j2.JobID FROM Jobs j2 WHERE j2.CompanyID = c.CompanyID AND j2.LastPushedAt IS NOT NULL ORDER BY j2.LastPushedAt DESC) as CompanyLastPushedJobID,
            (SELECT TOP 1 j2.LastPushedAt FROM Jobs j2 WHERE j2.CompanyID = c.CompanyID AND j2.LastPushedAt IS NOT NULL ORDER BY j2.LastPushedAt DESC) as CompanyLastPushedAt,
            -- Lấy giới hạn đẩy top từ gói VIP đang kích hoạt
            (SELECT TOP 1 ISNULL(us.Snapshot_PushTopDaily, sp.Limit_PushTopDaily)
             FROM UserSubscriptions us
             LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
             WHERE us.UserID = @EmployerID 
               AND us.Status = 1 
               AND us.EndDate > GETDATE()
               AND ISNULL(us.SnapshotPlanType, sp.PlanType) <> 'ONE_TIME'
             ORDER BY us.EndDate DESC) as VipLimitDaily
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
      const transaction = new sql.Transaction(pool);
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      try {
        const usedRes = await transaction
          .request()
          .input("CompanyID", sql.Int, data.CompanyID)
          .query(
            `
            DECLARE @start DATETIME = CONVERT(DATETIME, CONVERT(DATE, GETDATE()));
            DECLARE @end DATETIME = DATEADD(DAY, 1, @start);

            SELECT COUNT(*) AS UsedToday
            FROM JobPushTopLogs WITH (UPDLOCK, HOLDLOCK)
            WHERE CompanyID = @CompanyID
              AND PushedAt >= @start
              AND PushedAt < @end
            `
          );

        const usedToday = usedRes.recordset?.[0]?.UsedToday || 0;
        if (usedToday >= dailyLimit) {
          await transaction.rollback();
          return res.status(403).json({
            message: `Bạn đã dùng hết ${usedToday}/${dailyLimit} lượt đẩy top trong ngày hôm nay. Vui lòng quay lại vào ngày mai.`,
          });
        }

        await transaction
          .request()
          .input("CompanyID", sql.Int, data.CompanyID)
          .input("JobID", sql.Int, id)
          .input("PushedByUserID", sql.NVarChar, employerId)
          .query(
            `
            INSERT INTO JobPushTopLogs (CompanyID, JobID, PushedByUserID)
            VALUES (@CompanyID, @JobID, @PushedByUserID)
            `
          );

        await transaction
          .request()
          .input("JobID", sql.Int, id)
          .query(
            "UPDATE Jobs SET LastPushedAt = GETDATE() WHERE JobID = @JobID"
          );

        await transaction.commit();
        return res.status(200).json({
          message: `Đẩy top thành công! (${
            usedToday + 1
          }/${dailyLimit} lượt hôm nay)`,
        });
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    } else {
      const weekCountRes = await pool
        .request()
        .input("CompanyID", sql.Int, data.CompanyID)
        .query(
          `
          DECLARE @weekStart DATETIME =
            DATEADD(day, -((DATEPART(weekday, GETDATE()) + 5) % 7), CONVERT(date, GETDATE()));
          DECLARE @weekEnd DATETIME = DATEADD(day, 7, @weekStart);

          SELECT COUNT(*) AS UsedThisWeek
          FROM JobPushTopLogs
          WHERE CompanyID = @CompanyID
            AND PushedAt >= @weekStart
            AND PushedAt < @weekEnd
          `
        );

      const usedThisWeek = weekCountRes.recordset?.[0]?.UsedThisWeek || 0;
      if (usedThisWeek >= 1) {
        return res.status(403).json({
          message:
            "Tài khoản thường chỉ được đẩy top 1 lần/tuần. Vui lòng quay lại vào Thứ Hai tuần sau.",
        });
      }

      await pool
        .request()
        .input("CompanyID", sql.Int, data.CompanyID)
        .input("JobID", sql.Int, id)
        .input("PushedByUserID", sql.NVarChar, employerId)
        .query(
          `
          INSERT INTO JobPushTopLogs (CompanyID, JobID, PushedByUserID)
          VALUES (@CompanyID, @JobID, @PushedByUserID)
          `
        );

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

router.patch("/:id/close", checkAuth, async (req, res) => {
  const { id } = req.params;
  const employerId = req.firebaseUser.uid;

  try {
    const pool = await sql.connect(sqlConfig);

    const jobRes = await pool
      .request()
      .input("JobID", sql.Int, id)
      .input("OwnerUserID", sql.NVarChar, employerId)
      .query(
        `
        SELECT TOP 1 j.JobID, j.Status
        FROM Jobs j
        JOIN Companies c ON j.CompanyID = c.CompanyID
        WHERE j.JobID = @JobID AND c.OwnerUserID = @OwnerUserID
        `
      );

    const job = jobRes.recordset?.[0];
    if (!job) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bài đăng hoặc bạn không có quyền." });
    }

    if (Number(job.Status) !== 1) {
      return res.status(400).json({
        message: "Chỉ có thể đóng bài đang tuyển.",
      });
    }

    await pool
      .request()
      .input("JobID", sql.Int, id)
      .query("UPDATE Jobs SET Status = 2 WHERE JobID = @JobID");

    return res.status(200).json({ message: "Đóng bài tuyển dụng thành công." });
  } catch (error) {
    console.error("Lỗi đóng bài tuyển dụng:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.patch("/:id/reopen", checkAuth, async (req, res) => {
  const { id } = req.params;
  const employerId = req.firebaseUser.uid;

  try {
    const pool = await sql.connect(sqlConfig);

    const jobRes = await pool
      .request()
      .input("JobID", sql.Int, id)
      .input("OwnerUserID", sql.NVarChar, employerId)
      .query(
        `
        SELECT TOP 1 j.JobID, j.Status
        FROM Jobs j
        JOIN Companies c ON j.CompanyID = c.CompanyID
        WHERE j.JobID = @JobID AND c.OwnerUserID = @OwnerUserID
        `
      );

    const job = jobRes.recordset?.[0];
    if (!job) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bài đăng hoặc bạn không có quyền." });
    }

    if (Number(job.Status) !== 2) {
      return res.status(400).json({
        message: "Chỉ có thể mở lại bài đã đóng.",
      });
    }

    await pool
      .request()
      .input("JobID", sql.Int, id)
      .query("UPDATE Jobs SET Status = 1 WHERE JobID = @JobID");

    return res
      .status(200)
      .json({ message: "Mở lại bài tuyển dụng thành công." });
  } catch (error) {
    console.error("Lỗi mở lại bài tuyển dụng:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.delete("/:id", checkAuth, async (req, res) => {
  const { id } = req.params;
  const employerId = req.firebaseUser.uid;

  let tx;
  try {
    const pool = await sql.connect(sqlConfig);

    const jobRes = await pool
      .request()
      .input("JobID", sql.Int, id)
      .input("OwnerUserID", sql.NVarChar, employerId)
      .query(
        `
        SELECT TOP 1 j.JobID, j.CompanyID, j.Status
        FROM Jobs j
        JOIN Companies c ON j.CompanyID = c.CompanyID
        WHERE j.JobID = @JobID AND c.OwnerUserID = @OwnerUserID
        `
      );

    const job = jobRes.recordset?.[0];
    if (!job) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bài đăng hoặc bạn không có quyền." });
    }

    if (Number(job.Status) === 1) {
      return res.status(400).json({
        message: "Không thể xóa bài đang tuyển. Vui lòng đóng bài trước.",
      });
    }

    tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    const reqTx = () => new sql.Request(tx);

    await reqTx()
      .input("JobID", sql.Int, id)
      .query("DELETE FROM SavedJobs WHERE JobID = @JobID");

    await reqTx()
      .input("JobID", sql.Int, id)
      .query("DELETE FROM Applications WHERE JobID = @JobID");

    await reqTx()
      .input("JobID", sql.Int, id)
      .query("DELETE FROM JobPushTopLogs WHERE JobID = @JobID");

    const delRes = await reqTx()
      .input("JobID", sql.Int, id)
      .input("CompanyID", sql.Int, job.CompanyID)
      .query(
        "DELETE FROM Jobs WHERE JobID = @JobID AND CompanyID = @CompanyID"
      );

    const affected = delRes?.rowsAffected?.[0] || 0;
    if (affected === 0) {
      await tx.rollback();
      return res.status(404).json({
        message: "Không tìm thấy bài đăng hoặc bạn không có quyền.",
      });
    }

    await tx.commit();
    return res.status(200).json({ message: "Xóa bài đăng thành công." });
  } catch (error) {
    try {
      if (tx) await tx.rollback();
    } catch (e) {}

    console.error("Lỗi xóa bài đăng:", error);
    return res.status(500).json({
      message: "Không thể xóa bài đăng. Vui lòng thử lại.",
    });
  }
});

router.get("/push-top-dashboard", checkAuth, async (req, res) => {
  const employerId = req.firebaseUser.uid;

  try {
    const pool = await sql.connect(sqlConfig);

    const companyRes = await pool
      .request()
      .input("EmployerID", sql.NVarChar, employerId).query(`
        SELECT TOP 1 
          c.CompanyID,
          (SELECT TOP 1 ISNULL(us.Snapshot_PushTopDaily, sp.Limit_PushTopDaily)
           FROM UserSubscriptions us
           LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
           WHERE us.UserID = @EmployerID 
             AND us.Status = 1 
             AND us.EndDate > GETDATE()
             AND ISNULL(us.SnapshotPlanType, sp.PlanType) <> 'ONE_TIME'
           ORDER BY us.EndDate DESC) as VipLimitDaily,
          (SELECT TOP 1 ISNULL(us.Snapshot_JobPostDaily, sp.Limit_JobPostDaily)
           FROM UserSubscriptions us
           LEFT JOIN SubscriptionPlans sp ON us.PlanID = sp.PlanID
           WHERE us.UserID = @EmployerID 
             AND us.Status = 1 
             AND us.EndDate > GETDATE()
             AND ISNULL(us.SnapshotPlanType, sp.PlanType) <> 'ONE_TIME'
           ORDER BY us.EndDate DESC) as VipJobPostDaily
        FROM Companies c
        WHERE c.OwnerUserID = @EmployerID
        ORDER BY c.CompanyID ASC
      `);

    const company = companyRes.recordset[0];
    if (!company) {
      const baseJobPostDaily = DEFAULT_LIMITS?.EMPLOYER?.JOB_POST_DAILY || 0;
      return res.status(200).json({
        isVip: false,
        vipDailyLimit: 0,
        usedToday: 0,
        remainingToday: 0,
        jobPostDailyLimit: baseJobPostDaily,
        jobPostUsedToday: 0,
        jobPostRemainingToday: baseJobPostDaily,
        nextResetAt: null,
        weekStart: getMondayOfWeek(new Date()),
        eligibleThisWeekCount: 0,
        recent: [],
      });
    }

    const jobsRes = await pool
      .request()
      .input("CompanyID", sql.Int, company.CompanyID).query(`
        SELECT JobID, JobTitle, Status, LastPushedAt
        FROM Jobs
        WHERE CompanyID = @CompanyID
        ORDER BY LastPushedAt DESC, CreatedAt DESC
      `);

    const jobs = jobsRes.recordset || [];
    const now = new Date();
    const weekStart = getMondayOfWeek(now);

    const baseJobPostDaily = DEFAULT_LIMITS?.EMPLOYER?.JOB_POST_DAILY || 0;
    const vipJobPostDaily = company.VipJobPostDaily || 0;
    const jobPostDailyLimit =
      vipJobPostDaily > 0 ? vipJobPostDaily : baseJobPostDaily;

    let jobPostUsedToday = 0;
    if (jobPostDailyLimit > 0) {
      const countRes = await pool
        .request()
        .input("CompanyID", sql.Int, company.CompanyID).query(`
          DECLARE @start DATETIME = CONVERT(DATETIME, CONVERT(DATE, GETDATE()));
          DECLARE @end DATETIME = DATEADD(DAY, 1, @start);

          SELECT COUNT(*) AS Total
          FROM Jobs
          WHERE CompanyID = @CompanyID
            AND CreatedAt >= @start
            AND CreatedAt < @end
        `);

      jobPostUsedToday = countRes.recordset?.[0]?.Total || 0;
    }
    const jobPostRemainingToday =
      jobPostDailyLimit > 0
        ? Math.max(0, jobPostDailyLimit - jobPostUsedToday)
        : null;

    const recentRes = await pool
      .request()
      .input("CompanyID", sql.Int, company.CompanyID)
      .query(
        `
        SELECT TOP 10
          l.LogID,
          j.JobID,
          j.JobTitle,
          j.Status,
          l.PushedAt AS LastPushedAt
        FROM JobPushTopLogs l
        JOIN Jobs j ON j.JobID = l.JobID
        WHERE l.CompanyID = @CompanyID
        ORDER BY l.PushedAt DESC
        `
      );
    const recent = recentRes.recordset || [];

    const usedThisWeekRes = await pool
      .request()
      .input("CompanyID", sql.Int, company.CompanyID)
      .query(
        `
        DECLARE @weekStart DATETIME =
          DATEADD(day, -((DATEPART(weekday, GETDATE()) + 5) % 7), CONVERT(date, GETDATE()));
        DECLARE @weekEnd DATETIME = DATEADD(day, 7, @weekStart);

        SELECT COUNT(*) AS UsedThisWeek
        FROM JobPushTopLogs
        WHERE CompanyID = @CompanyID
          AND PushedAt >= @weekStart
          AND PushedAt < @weekEnd
        `
      );
    const usedThisWeekByLogs =
      usedThisWeekRes.recordset?.[0]?.UsedThisWeek || 0;
    const hasPushedThisWeek = usedThisWeekByLogs > 0;
    const weeklyLimit = 1;
    const usedThisWeek = hasPushedThisWeek ? 1 : 0;
    const remainingThisWeek = hasPushedThisWeek ? 0 : 1;

    const isVip = company.VipLimitDaily && company.VipLimitDaily > 0;
    if (!isVip) {
      const nextResetAt = (() => {
        const d = new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            0,
            0,
            0
          )
        );
        const day = d.getUTCDay();
        const diffDays = day === 0 ? 1 : 8 - day;
        d.setUTCDate(d.getUTCDate() + diffDays);
        return d.toISOString();
      })();

      return res.status(200).json({
        isVip: false,
        vipDailyLimit: 0,
        usedToday: null,
        remainingToday: null,
        jobPostDailyLimit,
        jobPostUsedToday,
        jobPostRemainingToday,
        nextResetAt,
        weekStart,
        weeklyLimit,
        usedThisWeek,
        remainingThisWeek,
        lastPushedThisWeek: hasPushedThisWeek ? recent?.[0] || null : null,
        totalJobs: jobs.length,
        recent,
      });
    }

    const dailyLimit = company.VipLimitDaily;
    const usedTodayRes = await pool
      .request()
      .input("CompanyID", sql.Int, company.CompanyID).query(`
        DECLARE @start DATETIME = CONVERT(DATETIME, CONVERT(DATE, GETDATE()));
        DECLARE @end DATETIME = DATEADD(DAY, 1, @start);

        SELECT COUNT(*) AS UsedToday
        FROM JobPushTopLogs
        WHERE CompanyID = @CompanyID
          AND PushedAt >= @start
          AND PushedAt < @end
      `);
    const usedToday = usedTodayRes.recordset?.[0]?.UsedToday || 0;

    const remainingToday = Math.max(0, dailyLimit - usedToday);

    const nextResetAt = (() => {
      return new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          0,
          0,
          0
        )
      ).toISOString();
    })();

    return res.status(200).json({
      isVip: true,
      vipDailyLimit: dailyLimit,
      usedToday,
      remainingToday,
      jobPostDailyLimit,
      jobPostUsedToday,
      jobPostRemainingToday,
      nextResetAt,
      weekStart,
      totalJobs: jobs.length,
      recent,
    });
  } catch (error) {
    console.error("Lỗi lấy push-top dashboard:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

export default router;