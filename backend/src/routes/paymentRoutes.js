import express from "express";
import Stripe from "stripe";
import sql from "mssql";
import { sqlConfig } from "../config/db.js";
import { checkAuth } from "../middleware/authMiddleware.js";
import { enforceCandidateCvLimit } from "../services/cvStorageService.js";

const NOTIF_TYPE_ONE_TIME = "VIP_ONE_TIME_PURCHASE";
const formatCurrencyVN = (value) =>
  new Intl.NumberFormat("vi-VN").format(Number(value) || 0);

const getVipLinkByRole = (roleId) =>
  roleId === 3 ? "/employer/subscription" : "/candidate/subscription";

const getRedirectForPlan = (plan) => {
  if (plan.PlanType === "ONE_TIME") {
    if (plan.RoleID === 3) return "/employer/applicants";
    if (plan.RoleID === 4) return "/candidate/cvs";
  }
  return getVipLinkByRole(plan.RoleID);
};

const buildOneTimeMessage = (plan, amount, metadata = {}) => {
  const money = formatCurrencyVN(amount) + "₫";
  if (plan.RoleID === 4) {
    let extra = "";
    if (metadata?.jobTitle) {
      extra = ` vào công việc "${metadata.jobTitle}"`;
    }
    return `Bạn đã trả ${money} để sử dụng tính năng "${plan.PlanName}" nhằm xem thống kê ứng tuyển${extra}.`;
  }
  if (plan.RoleID === 3) {
    let extra = "";
    if (metadata?.candidateName) {
      extra = ` của ứng viên "${metadata.candidateName}"`;
    }
    return `Bạn đã trả ${money} để sử dụng tính năng "${plan.PlanName}" nhằm xem liên hệ ứng viên${extra}.`;
  }
  return `Bạn đã trả ${money} để sử dụng dịch vụ "${plan.PlanName}".`;
};

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

router.post("/create-checkout-session", checkAuth, async (req, res) => {
  const { planId, returnUrl, metadata } = req.body;
  const userId = req.firebaseUser.uid;

  if (!planId) return res.status(400).json({ message: "Thiếu thông tin gói." });

  try {
    const pool = await sql.connect(sqlConfig);
    const planResult = await pool
      .request()
      .input("PlanID", sql.Int, planId)
      .query("SELECT * FROM SubscriptionPlans WHERE PlanID = @PlanID");

    const plan = planResult.recordset[0];
    if (!plan) return res.status(404).json({ message: "Gói không tồn tại." });

    const safeReturn =
      returnUrl && typeof returnUrl === "string" ? returnUrl : "";
    const successUrl = `${CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&plan_id=${planId}${
      safeReturn ? `&return_url=${encodeURIComponent(safeReturn)}` : ""
    }`;
    const cancelUrl = `${CLIENT_URL}/payment/cancel${
      safeReturn ? `?return_url=${encodeURIComponent(safeReturn)}` : ""
    }`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "vnd",
            product_data: {
              name: plan.PlanName,
              description:
                plan.PlanType === "SUBSCRIPTION"
                  ? `Gói định kỳ ${plan.DurationInDays} ngày`
                  : "Dịch vụ mua 1 lần",
            },
            unit_amount: parseInt(plan.Price),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata:
        metadata && typeof metadata === "object"
          ? Object.fromEntries(
              Object.entries(metadata).map(([k, v]) => [k, String(v ?? "")])
            )
          : {},
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Error:", error);
    res.status(500).json({ message: "Lỗi tạo giao dịch thanh toán." });
  }
});

router.post("/verify-payment", checkAuth, async (req, res) => {
  const { sessionId, planId } = req.body;
  const userId = req.firebaseUser.uid;

  if (!sessionId || !planId)
    return res.status(400).json({ message: "Thiếu thông tin." });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Thanh toán chưa hoàn tất." });
    }
    if (session.client_reference_id !== userId) {
      return res.status(403).json({ message: "User không khớp." });
    }

    const pool = await sql.connect(sqlConfig);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const checkTrans = await transaction
        .request()
        .input("TransID", sql.NVarChar, sessionId)
        .query(
          "SELECT TOP 1 1 FROM UserSubscriptions WHERE PaymentTransactionID = @TransID"
        );

      if (checkTrans.recordset.length > 0) {
        await transaction.rollback();
        return res
          .status(200)
          .json({ message: "Giao dịch đã được ghi nhận trước đó." });
      }

      const planResult = await transaction
        .request()
        .input("PlanID", sql.Int, planId)
        .query("SELECT * FROM SubscriptionPlans WHERE PlanID = @PlanID");
      const plan = planResult.recordset[0];

      if (!plan) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ message: "Gói không tìm thấy trong DB." });
      }

      await transaction
        .request()
        .input("UserID", sql.NVarChar, userId)
        .input("PlanID", sql.Int, planId)
        .input("PaymentTransactionID", sql.NVarChar, sessionId)
        .input("Status", sql.TinyInt, 1)
        .input("PlanType", sql.NVarChar, plan.PlanType || null)
        .input("DurationInDays", sql.Int, plan.DurationInDays || 0)
        .input("SnapshotPlanName", sql.NVarChar, plan.PlanName)
        .input("SnapshotFeatures", sql.NText, plan.Features)
        .input("SnapshotPrice", sql.Decimal(18, 2), plan.Price)
        .input("SnapshotPlanType", sql.NVarChar, plan.PlanType)
        .input("Snapshot_JobPostDaily", sql.Int, plan.Limit_JobPostDaily || 0)
        .input("Snapshot_PushTopDaily", sql.Int, plan.Limit_PushTopDaily || 0)
        .input("Snapshot_CVStorage", sql.Int, plan.Limit_CVStorage || 0)
        .input(
          "Snapshot_ViewApplicantCount",
          sql.Int,
          plan.Limit_ViewApplicantCount || 0
        )
        .input(
          "Snapshot_RevealCandidatePhone",
          sql.Int,
          plan.Limit_RevealCandidatePhone || 0
        ).query(`
          INSERT INTO UserSubscriptions 
          (UserID, PlanID, StartDate, EndDate, PaymentTransactionID, Status, 
           SnapshotPlanName, SnapshotFeatures, SnapshotPrice, SnapshotPlanType,
           Snapshot_JobPostDaily, Snapshot_PushTopDaily, Snapshot_CVStorage,
           Snapshot_ViewApplicantCount, Snapshot_RevealCandidatePhone)
          VALUES 
          (
            @UserID,
            @PlanID,
            GETDATE(),
            CASE 
              WHEN UPPER(ISNULL(@PlanType, '')) = 'SUBSCRIPTION' AND ISNULL(@DurationInDays, 0) > 0
                THEN DATEADD(DAY, @DurationInDays, GETDATE())
              ELSE DATEADD(YEAR, 1000, GETDATE())
            END,
            @PaymentTransactionID,
            @Status,
           @SnapshotPlanName, @SnapshotFeatures, @SnapshotPrice, @SnapshotPlanType,
           @Snapshot_JobPostDaily, @Snapshot_PushTopDaily, @Snapshot_CVStorage,
           @Snapshot_ViewApplicantCount, @Snapshot_RevealCandidatePhone)
        `);

      if (plan.PlanType === "ONE_TIME" || !plan.DurationInDays) {
        await transaction
          .request()
          .input("UserID", sql.NVarChar, userId)
          .input(
            "Message",
            sql.NVarChar,
            buildOneTimeMessage(plan, plan.Price, session.metadata || {})
          )
          .input("LinkURL", sql.NVarChar, getRedirectForPlan(plan))
          .input("Type", sql.NVarChar, NOTIF_TYPE_ONE_TIME)
          .input("ReferenceID", sql.NVarChar, plan.PlanID.toString())
          .query(
            `
            INSERT INTO Notifications (UserID, Message, LinkURL, Type, ReferenceID)
            VALUES (@UserID, @Message, @LinkURL, @Type, @ReferenceID)
          `
          );
      }

      if (plan.RoleID === 4) {
        await enforceCandidateCvLimit(
          transaction,
          userId,
          plan.Limit_CVStorage
        );
      }

      await transaction.commit();

      res.status(200).json({
        message: "Kích hoạt thành công!",
        planName: plan.PlanName,
        redirectUrl: getRedirectForPlan(plan),
      });
    } catch (transError) {
      await transaction.rollback();
      throw transError;
    }
  } catch (error) {
    res.status(500).json({ message: "Lỗi xác thực thanh toán." });
  }
});

export default router;