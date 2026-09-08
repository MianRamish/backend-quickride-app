const Settlement = require("../models/settlement.model");
const Captain = require("../models/captain.model");

async function createCashCommission({ captainId, rideId, grossCash, commissionAmount, currency = "NGN" }) {
  if (!commissionAmount || commissionAmount <= 0) return null;
  const existing = await Settlement.findOne({ ride: rideId, type: "cash_commission" });
  if (existing) return existing;
  const settlement = await Settlement.create({
    captain: captainId,
    ride: rideId,
    type: "cash_commission",
    grossCash,
    commissionAmount,
    amount: commissionAmount,
    currency,
    direction: "captain_owes_platform",
    status: "owed",
  });
  await Captain.findByIdAndUpdate(captainId, {
    $inc: {
      "earnings.cashCollectedTotal": Number(grossCash || 0),
      "earnings.commissionOwed": Number(commissionAmount || 0),
    },
  });
  return settlement;
}

async function settle({ settlementId, amount = null, reference = "", adminNote = "" }) {
  const item = await Settlement.findById(settlementId);
  if (!item) throw new Error("Settlement not found");
  if (["settled", "waived"].includes(item.status)) return item;
  const remaining = Math.max(0, Number(item.amount || 0) - Number(item.settledAmount || 0));
  const paid = amount == null ? remaining : Math.min(remaining, Math.max(0, Number(amount || 0)));
  if (paid <= 0) throw new Error("Settlement amount must be greater than zero");
  item.settledAmount = Number(item.settledAmount || 0) + paid;
  item.status = item.settledAmount >= item.amount ? "settled" : "partially_settled";
  item.reference = reference || item.reference;
  item.adminNote = adminNote || item.adminNote;
  if (item.status === "settled") item.settledAt = new Date();
  await item.save();
  if (item.direction === "captain_owes_platform") {
    await Captain.findByIdAndUpdate(item.captain, {
      $inc: {
        "earnings.commissionOwed": -paid,
        "earnings.commissionSettled": paid,
      },
    });
  }
  return item;
}

module.exports = { createCashCommission, settle };
