import express from "express";
import sql from "mssql";
import { sqlConfig } from "../config/db.js";
import { checkAuth } from "../middleware/authMiddleware.js";
import { enforceCandidateCvLimit } from "../services/cvStorageService.js";
import admin from "../config/firebaseAdmin.js";

const router = express.Router();

const vipSnapshotApply = `
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

const buildUserSelectQuery = () => `
  SELECT 
    u.*,
    vip.PlanName AS CurrentVIP,
    vip.PlanName AS CurrentVIPPlanName,
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
  ${vipSnapshotApply}
  WHERE u.FirebaseUserID = @FirebaseUserID
`;

const getUidsForProvider = (firebaseIdentities, providerId) => {
  return firebaseIdentities[providerId] || [];
};

router.get("/me", checkAuth, async (req, res) => {
  try {
    const firebaseUid = req.firebaseUser.uid;
    const firebaseUserRecord = await admin.auth().getUser(firebaseUid);
    const { email, displayName, photoURL } = firebaseUserRecord;
    const firebaseIdentities = firebaseUserRecord.providerData.reduce(
      (acc, provider) => {
        acc[provider.providerId] = acc[provider.providerId] || [];
        acc[provider.providerId].push(provider.uid);
        return acc;
      },
      {}
    );

    const passwordUpdatedAtMs = firebaseUserRecord.metadata.passwordUpdatedAt
      ? Date.parse(firebaseUserRecord.metadata.passwordUpdatedAt)
      : null;

    const firebaseProviderIds = Object.keys(firebaseIdentities).filter(
      (p) => p !== "password"
    );

    const isVerifiedInToken = !!req.firebaseUser.email_verified;
    const hasFacebook = firebaseProviderIds.includes("facebook.com");
    const finalIsVerified = isVerifiedInToken || hasFacebook;

    const pool = await sql.connect(sqlConfig);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      let userResult = await transaction
        .request()
        .input("FirebaseUserID", sql.NVarChar, firebaseUid)
        .query(buildUserSelectQuery());

      if (userResult.recordset.length === 0) {
        await transaction
          .request()
          .input("FirebaseUserID", sql.NVarChar, firebaseUid)
          .input("Email", sql.NVarChar, email)
          .input(
            "DisplayName",
            sql.NVarChar,
            displayName || email?.split("@")[0] || "User"
          )
          .input("PhotoURL", sql.NVarChar, photoURL || null)
          .input("IsVerified", sql.Bit, finalIsVerified).query(`
            INSERT INTO Users (FirebaseUserID, Email, DisplayName, PhotoURL, IsVerified, CreatedAt, UpdatedAt, LastLoginAt)
            VALUES (@FirebaseUserID, @Email, @DisplayName, @PhotoURL, @IsVerified, GETDATE(), GETDATE(), GETDATE());
          `);

        userResult = await transaction
          .request()
          .input("FirebaseUserID", sql.NVarChar, firebaseUid)
          .query(buildUserSelectQuery());
      } else {
        await transaction
          .request()
          .input("FirebaseUserID", sql.NVarChar, firebaseUid)
          .query(
            "UPDATE Users SET LastLoginAt = GETDATE() WHERE FirebaseUserID = @FirebaseUserID"
          );
      }

      const userFromDB = userResult.recordset[0];
      const updatedAtInDB = userFromDB.UpdatedAt
        ? new Date(userFromDB.UpdatedAt).getTime()
        : 0;

      const sqlResult = await transaction
        .request()
        .input("FirebaseUserID", sql.NVarChar, firebaseUid)
        .query(
          "SELECT ProviderID FROM UserProviders WHERE FirebaseUserID = @FirebaseUserID"
        );

      const sqlProviderIds = sqlResult.recordset.map((row) => row.ProviderID);

      const hasPasswordInDB = sqlProviderIds.includes("password");
      const hasOAuthInToken = firebaseProviderIds.some(
        (p) => p === "google.com" || p === "facebook.com"
      );

      let providersToSync = [...firebaseProviderIds];

      if (hasOAuthInToken && !hasPasswordInDB) {
        providersToSync = providersToSync.filter((p) => p !== "email");
      }

      let providersChanged = false;
      const sortedSqlProviders = [...sqlProviderIds].sort();
      const sortedSyncProviders = [...providersToSync].sort();

      if (
        sortedSqlProviders.length !== sortedSyncProviders.length ||
        sortedSqlProviders.join(",") !== sortedSyncProviders.join(",")
      ) {
        providersChanged = true;
      }

      const isVerifiedInDB = userFromDB.IsVerified;
      const verificationChanged = isVerifiedInDB !== finalIsVerified;

      let passwordChanged = false;
      if (passwordUpdatedAtMs && passwordUpdatedAtMs > updatedAtInDB) {
        passwordChanged = true;
      }

      for (const sqlProviderId of sqlProviderIds) {
        if (!providersToSync.includes(sqlProviderId)) {
          if (
            sqlProviderId === "google.com" ||
            sqlProviderId === "facebook.com"
          ) {
            await transaction
              .request()
              .input("FirebaseUserID", sql.NVarChar, firebaseUid)
              .input("ProviderID", sql.NVarChar, sqlProviderId)
              .query(
                "DELETE FROM UserProviders WHERE FirebaseUserID = @FirebaseUserID AND ProviderID = @ProviderID"
              );
          }
        }
      }

      for (const providerId of providersToSync) {
        const providerUids = getUidsForProvider(firebaseIdentities, providerId);

        for (const providerUidToSave of providerUids) {
          if (!providerUidToSave) continue;

          await transaction
            .request()
            .input("FirebaseUserID", sql.NVarChar, firebaseUid)
            .input("ProviderID", sql.NVarChar, providerId)
            .input("ProviderUID", sql.NVarChar, providerUidToSave).query(`
              MERGE INTO UserProviders AS target
              USING (VALUES (@FirebaseUserID, @ProviderID, @ProviderUID)) AS source (FirebaseUserID, ProviderID, ProviderUID)
              ON (target.FirebaseUserID = source.FirebaseUserID AND target.ProviderID = source.ProviderID AND target.ProviderUID = source.ProviderUID)
              WHEN MATCHED THEN
                UPDATE SET LinkedAt = GETDATE()
              WHEN NOT MATCHED BY TARGET THEN
                INSERT (FirebaseUserID, ProviderID, ProviderUID, LinkedAt)
                VALUES (source.FirebaseUserID, source.ProviderID, source.ProviderUID, GETDATE());
            `);
        }
      }

      if (providersChanged || verificationChanged || passwordChanged) {
        await transaction
          .request()
          .input("FirebaseUserID", sql.NVarChar, firebaseUid)
          .input("IsVerified", sql.Bit, finalIsVerified)
          .query(
            "UPDATE Users SET UpdatedAt = GETDATE(), IsVerified = @IsVerified WHERE FirebaseUserID = @FirebaseUserID"
          );
      }

      if (userFromDB.RoleID === 4) {
        await enforceCandidateCvLimit(
          transaction,
          firebaseUid,
          userResult.recordset[0]?.CurrentVIPLimitCVStorage
        );
      }

      await transaction.commit();
      res.status(200).json(userResult.recordset[0]);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi server khi đồng bộ /me", error: error.message });
  }
});

router.post("/register", checkAuth, async (req, res) => {
  const { roleID } = req.body;
  const { uid, email, name, firebase, email_verified, photoURL } =
    req.firebaseUser;
  const firebaseIdentities = firebase.identities || {};
  const firebaseProviderIds = Object.keys(firebaseIdentities);

  const isVerifiedInToken = !!email_verified;
  const hasFacebook = firebaseProviderIds.includes("facebook.com");
  const finalIsVerified = isVerifiedInToken || hasFacebook;
  const hasPasswordInToken = firebaseProviderIds.includes("password");
  const hasOAuthInToken = firebaseProviderIds.some(
    (p) => p === "google.com" || p === "facebook.com"
  );

  let providersToSync = [...firebaseProviderIds];
  if (hasOAuthInToken && !hasPasswordInToken) {
    providersToSync = providersToSync.filter((p) => p !== "email");
  }

  if (!roleID) {
    return res.status(400).json({ message: "Vui lòng chọn vai trò (RoleID)." });
  }

  try {
    const pool = await sql.connect(sqlConfig);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const userResult = await transaction
        .request()
        .input("FirebaseUserID", sql.NVarChar, uid)
        .input("Email", sql.NVarChar, email)
        .input("DisplayName", sql.NVarChar, name || "Người dùng mới")
        .input("RoleID", sql.Int, roleID)
        .input("PhotoURL", sql.NVarChar, photoURL || null)
        .input("IsVerified", sql.Bit, finalIsVerified).query(`
          MERGE INTO Users AS target
          USING (VALUES (@FirebaseUserID)) AS source (FirebaseUserID)
          ON (target.FirebaseUserID = source.FirebaseUserID)
          WHEN MATCHED THEN
            UPDATE SET RoleID = @RoleID, UpdatedAt = GETDATE()
          WHEN NOT MATCHED BY TARGET THEN
            INSERT (FirebaseUserID, Email, DisplayName, RoleID, PhotoURL, CreatedAt, UpdatedAt, IsVerified)
            VALUES (@FirebaseUserID, @Email, @DisplayName, @RoleID, @PhotoURL, GETDATE(), GETDATE(), @IsVerified)
          OUTPUT inserted.*;
        `);

      for (const providerId of providersToSync) {
        const providerUids = getUidsForProvider(firebaseIdentities, providerId);
        for (const providerUidToSave of providerUids) {
          if (!providerUidToSave) continue;

          await transaction
            .request()
            .input("FirebaseUserID", sql.NVarChar, uid)
            .input("ProviderID", sql.NVarChar, providerId)
            .input("ProviderUID", sql.NVarChar, providerUidToSave).query(`
              MERGE INTO UserProviders AS target
              USING (VALUES (@FirebaseUserID, @ProviderID, @ProviderUID)) AS source (FirebaseUserID, ProviderID, ProviderUID)
              ON (target.FirebaseUserID = source.FirebaseUserID AND target.ProviderID = source.ProviderID AND target.ProviderUID = source.ProviderUID)
              WHEN MATCHED THEN
                UPDATE SET LinkedAt = GETDATE()
              WHEN NOT MATCHED BY TARGET THEN
                INSERT (FirebaseUserID, ProviderID, ProviderUID, LinkedAt)
                VALUES (source.FirebaseUserID, source.ProviderID, source.ProviderUID, GETDATE());
            `);
        }
      }

      await transaction.commit();
      res.status(201).json(userResult.recordset[0]);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi tạo user", error: error.message });
  }
});

export default router;