const PushSubscription = require("../models/pushSubscription.model");

let webpush = null;
let configured = false;

function getWebPush() {
  if (webpush) return webpush;
  try {
    webpush = require("web-push");
  } catch (_) {
    return null;
  }
  return webpush;
}

function configure() {
  const client = getWebPush();
  const publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "").trim();
  const subject = String(process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:admin@example.com").trim();
  configured = Boolean(client && publicKey && privateKey);
  if (configured) {
    try {
      client.setVapidDetails(subject, publicKey, privateKey);
    } catch (error) {
      configured = false;
      console.error("Web push configuration failed:", error.message);
    }
  }
  return configured;
}

function getPublicConfig() {
  if (!configured) configure();
  return {
    enabled: configured,
    publicKey: configured ? String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "").trim() : "",
  };
}

async function saveSubscription({ recipientType, recipient, subscription, userAgent = "" }) {
  const endpoint = subscription?.endpoint;
  if (!endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    const error = new Error("Invalid push subscription");
    error.statusCode = 400;
    throw error;
  }
  return PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        recipientType,
        recipient,
        subscription,
        userAgent: String(userAgent || "").slice(0, 500),
        lastUsedAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function removeSubscription({ recipientType, recipient, endpoint }) {
  if (!endpoint) return { deletedCount: 0 };
  return PushSubscription.deleteOne({ recipientType, recipient, endpoint });
}

async function sendToRecipient({ recipientType, recipient, title, body = "", data = {} }) {
  if (!configured && !configure()) return { sent: 0, skipped: true };
  const client = getWebPush();
  if (!client) return { sent: 0, skipped: true };

  const subscriptions = await PushSubscription.find({ recipientType, recipient }).limit(10);
  if (!subscriptions.length) return { sent: 0 };

  const payload = JSON.stringify({
    title: title || "QuickRide",
    body: body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data,
  });

  let sent = 0;
  await Promise.all(subscriptions.map(async (item) => {
    try {
      await client.sendNotification(item.subscription, payload, { TTL: 120 });
      sent += 1;
      item.lastUsedAt = new Date();
      await item.save();
    } catch (error) {
      if ([404, 410].includes(error?.statusCode)) {
        await PushSubscription.deleteOne({ _id: item._id });
      } else if (process.env.ENVIRONMENT !== "production") {
        console.warn("Web push delivery failed:", error?.message || error);
      }
    }
  }));
  return { sent };
}

module.exports = { getPublicConfig, saveSubscription, removeSubscription, sendToRecipient, configure };
