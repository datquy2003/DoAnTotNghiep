import express from "express";
import sql from "mssql";
import { sqlConfig } from "../config/db.js";
import { checkAuth } from "../middleware/authMiddleware.js";
import {
  VIP_FEATURE_KEYS,
  ensureVipFeatureAvailability,
  VipFeatureError,
} from "../services/vipFeatureService.js";

const router = express.Router();

const ROLE = {
  EMPLOYER: 3,
  CANDIDATE: 4,
};

const fetchUserRole = async (pool, userId) => {
  const result = await pool
    .request()
    .input("UserID", sql.NVarChar, userId)
    .query("SELECT TOP 1 RoleID FROM Users WHERE FirebaseUserID = @UserID");
  return result.recordset[0]?.RoleID || null;
};

const assertRole = async (pool, userId, expectedRole) => {
  const roleId = await fetchUserRole(pool, userId);
  if (roleId !== expectedRole) {
    throw new VipFeatureError(403, "Bạn không có quyền sử dụng tính năng này.");
  }
};

router.post("/candidate/application-insight", checkAuth, async (req, res) => {
  const { jobId } = req.body;
  if (!jobId || Number.isNaN(Number(jobId))) {
    return res.status(400).json({ message: "Thiếu hoặc sai JobID." });
  }

  const candidateId = req.firebaseUser.uid;

  try {
    const pool = await sql.connect(sqlConfig);
    await assertRole(pool, candidateId, ROLE.CANDIDATE);

    const applicationResult = await pool
      .request()
      .input("JobID", sql.Int, jobId)
      .input("CandidateID", sql.NVarChar, candidateId).query(`
          SELECT TOP 1 
            a.ApplicationID,
            a.AppliedAt,
            j.JobTitle,
            j.ExpiresAt,
            j.Status
          FROM Applications a
          JOIN Jobs j ON a.JobID = j.JobID
          WHERE a.JobID = @JobID AND a.CandidateID = @CandidateID
        `);

    const application = applicationResult.recordset[0];
    if (!application) {
      return res.status(404).json({
        message: "Bạn chưa ứng tuyển vào công việc này.",
      });
    }

    const jobIsClosed =
      application.Status > 1 ||
      (application.ExpiresAt &&
        new Date(application.ExpiresAt).getTime() <= Date.now());

    if (jobIsClosed) {
      return res.status(400).json({
        message: "Tin tuyển dụng đã hết hạn, không thể xem thống kê.",
      });
    }

    const featureResult = await ensureVipFeatureAvailability({
      pool,
      userId: candidateId,
      featureKey: VIP_FEATURE_KEYS.CANDIDATE_COMPETITOR_INSIGHT,
      referenceId: jobId.toString(),
      metadata: {
        jobId,
        jobTitle: application.JobTitle,
      },
    });

    const countResult = await pool
      .request()
      .input("JobID", sql.Int, jobId)
      .query(
        "SELECT COUNT(*) AS TotalApplicants FROM Applications WHERE JobID = @JobID"
      );

    const totalApplicants = countResult.recordset[0]?.TotalApplicants || 0;

    return res.status(200).json({
      jobId: Number(jobId),
      jobTitle: application.JobTitle,
      totalApplicants,
      unlockedAt:
        featureResult.alreadyUnlocked?.UsedAt ||
        featureResult.consumedUsage?.UsedAt,
      remainingCredits: featureResult.remainingCredits,
    });
  } catch (error) {
    if (error instanceof VipFeatureError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Lỗi application-insight:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.post("/employer/reveal-contact", checkAuth, async (req, res) => {
  const { candidateId, jobId } = req.body;
  if (!candidateId) {
    return res.status(400).json({ message: "Thiếu CandidateID." });
  }

  const employerId = req.firebaseUser.uid;

  try {
    const pool = await sql.connect(sqlConfig);
    await assertRole(pool, employerId, ROLE.EMPLOYER);

    const contactResult = await pool
      .request()
      .input("CandidateID", sql.NVarChar, candidateId).query(`
        SELECT TOP 1 
          cp.FullName,
          cp.PhoneNumber,
          u.Email,
          cp.IsSearchable
        FROM CandidateProfiles cp
        JOIN Users u ON cp.UserID = u.FirebaseUserID
        WHERE cp.UserID = @CandidateID
      `);

    const contact = contactResult.recordset[0];

    if (!contact) {
      return res.status(404).json({
        message: "Không tìm thấy hồ sơ ứng viên.",
      });
    }

    if (!contact.IsSearchable) {
      return res.status(403).json({
        message: "Ứng viên không cho phép hiển thị thông tin.",
      });
    }

    if (!contact.PhoneNumber) {
      return res.status(404).json({
        message: "Ứng viên chưa cập nhật số điện thoại.",
      });
    }

    const referenceId = `${candidateId}`;

    const featureResult = await ensureVipFeatureAvailability({
      pool,
      userId: employerId,
      featureKey: VIP_FEATURE_KEYS.EMPLOYER_REVEAL_PHONE,
      referenceId,
      metadata: {
        candidateId,
        candidateName: contact.FullName || "",
      },
    });

    return res.status(200).json({
      candidateId,
      jobId: null,
      jobTitle: null,
      phoneNumber: contact.PhoneNumber,
      fullName: contact.FullName,
      email: contact.Email,
      unlockedAt:
        featureResult.alreadyUnlocked?.UsedAt ||
        featureResult.consumedUsage?.UsedAt,
      remainingCredits: featureResult.remainingCredits,
    });
  } catch (error) {
    if (error instanceof VipFeatureError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Lỗi reveal-contact:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

export default router;