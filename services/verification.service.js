const Captain = require("../models/captain.model");

let interval = null;

async function sweepExpiredDocuments() {
  const now = new Date();
  const captains = await Captain.find({ verificationStatus: "approved", isApproved: true });
  for (const captain of captains) {
    const expired = [];
    if (captain.documents?.licenseExpiry && new Date(captain.documents.licenseExpiry) < now) expired.push("license");
    if (captain.documents?.vehicleRegistrationExpiry && new Date(captain.documents.vehicleRegistrationExpiry) < now) expired.push("registration");
    if (captain.documents?.insuranceExpiry && new Date(captain.documents.insuranceExpiry) < now) expired.push("insurance");
    if (!expired.length) continue;
    for (const key of expired) captain.documents.reviews[key] = { status: "expired", note: "Document expired. Upload a renewed copy.", reviewedAt: now };
    captain.isApproved = false;
    captain.verificationStatus = "expired_documents";
    captain.verificationNote = `Renew required: ${expired.join(", ")}`;
    captain.status = "inactive";
    captain.isOnline = false;
    captain.availabilityStatus = "offline";
    await captain.save();
  }
}

function startVerificationSweep() {
  if (interval) return;
  sweepExpiredDocuments().catch(() => {});
  interval = setInterval(() => sweepExpiredDocuments().catch(() => {}), 60 * 60 * 1000);
}

module.exports = { sweepExpiredDocuments, startVerificationSweep };
