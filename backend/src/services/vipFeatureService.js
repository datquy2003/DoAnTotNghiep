import sql from "mssql";
import {
  VIP_FEATURE_KEYS,
  getVipFeatureConfig,
} from "../constants/vipFeatures.js";

export class VipFeatureError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const ACTIVE_SUBSCRIPTION_QUERY = `
  SELECT TOP 1 
    SubscriptionID,
    Snapshot_ViewApplicantCount,
    Snapshot_RevealCandidatePhone,
    StartDate,
    EndDate
  FROM UserSubscriptions
  WHERE UserID = @UserID
    AND Status = 1
    AND EndDate > GETDATE()
  ORDER BY EndDate DESC
`;

const getLimitFromSubscription = (subscription, featureKey) => {
  const { snapshotColumn } = getVipFeatureConfig(featureKey);
  return subscription?.[snapshotColumn] ?? 0;
};

const fetchActiveSubscription = async (pool, userId) => {
  const result = await pool
    .request()
    .input("UserID", sql.NVarChar, userId)
    .query(ACTIVE_SUBSCRIPTION_QUERY);

  return result.recordset[0] || null;
};

const fetchUsageCount = async (pool, userId, featureKey, subscriptionId) => {
  const result = await pool
    .request()
    .input("UserID", sql.NVarChar, userId)
    .input("FeatureType", sql.NVarChar, featureKey)
    .input("SubscriptionID", sql.Int, subscriptionId)
    .query(
      `
      SELECT COUNT(*) AS Total
      FROM VipOneTimeUsage
      WHERE UserID = @UserID
        AND FeatureType = @FeatureType
        AND (@SubscriptionID IS NULL OR ConsumedFromSubscriptionID = @SubscriptionID)
    `
    );

  return result.recordset[0]?.Total || 0;
};

const fetchUsageByReference = async (pool, userId, featureKey, referenceId) => {
  if (!referenceId) return null;

  const result = await pool
    .request()
    .input("UserID", sql.NVarChar, userId)
    .input("FeatureType", sql.NVarChar, featureKey)
    .input("ReferenceID", sql.NVarChar, referenceId)
    .query(
      `
      SELECT TOP 1 *
      FROM VipOneTimeUsage
      WHERE UserID = @UserID
        AND FeatureType = @FeatureType
        AND ReferenceID = @ReferenceID
      ORDER BY UsedAt DESC
    `
    );

  return result.recordset[0] || null;
};

const insertUsage = async (
  pool,
  userId,
  featureKey,
  referenceId,
  subscriptionId,
  extraData = {}
) => {
  const request = pool
    .request()
    .input("UserID", sql.NVarChar, userId)
    .input("FeatureType", sql.NVarChar, featureKey)
    .input("ReferenceID", sql.NVarChar, referenceId || null)
    .input("SubscriptionID", sql.Int, subscriptionId || null)
    .input("MetaJson", sql.NVarChar, JSON.stringify(extraData || {}));

  const result = await request.query(
    `
      INSERT INTO VipOneTimeUsage (UserID, FeatureType, ReferenceID, ConsumedFromSubscriptionID, MetadataJson)
      OUTPUT INSERTED.*
      VALUES (@UserID, @FeatureType, @ReferenceID, @SubscriptionID, @MetaJson)
    `
  );

  return result.recordset[0];
};

export const ensureVipFeatureAvailability = async ({
  pool,
  userId,
  featureKey,
  referenceId,
  metadata,
}) => {
  const subscription = await fetchActiveSubscription(pool, userId);

  if (!subscription) {
    throw new VipFeatureError(
      403,
      "Bạn chưa có gói VIP đang hoạt động cho tính năng này."
    );
  }

  const featureLimit = getLimitFromSubscription(subscription, featureKey);

  if (!featureLimit || featureLimit <= 0) {
    throw new VipFeatureError(
      403,
      "Gói VIP hiện tại không bao gồm quyền lợi này."
    );
  }

  const existingUsage = await fetchUsageByReference(
    pool,
    userId,
    featureKey,
    referenceId
  );

  const usedCount = await fetchUsageCount(
    pool,
    userId,
    featureKey,
    subscription.SubscriptionID
  );
  const remainingBeforeConsume = Math.max(featureLimit - usedCount, 0);

  if (existingUsage) {
    return {
      subscription,
      featureLimit,
      remainingCredits: remainingBeforeConsume,
      alreadyUnlocked: existingUsage,
    };
  }

  if (remainingBeforeConsume <= 0) {
    throw new VipFeatureError(403, "Bạn cần mua thêm lượt cho quyền lợi này.");
  }

  try {
    const usage = await insertUsage(
      pool,
      userId,
      featureKey,
      referenceId,
      subscription.SubscriptionID,
      metadata
    );

    return {
      subscription,
      featureLimit,
      remainingCredits: remainingBeforeConsume - 1,
      consumedUsage: usage,
    };
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      const latestUsage = await fetchUsageByReference(
        pool,
        userId,
        featureKey,
        referenceId
      );
      return {
        subscription,
        featureLimit,
        remainingCredits: remainingBeforeConsume,
        alreadyUnlocked: latestUsage,
      };
    }
    throw error;
  }
};

export { VIP_FEATURE_KEYS };