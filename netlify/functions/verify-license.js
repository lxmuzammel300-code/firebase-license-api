
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase configuration missing");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n")
      })
    });
  }

  return {
    auth: getAuth(),
    db: getFirestore()
  };
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return response({}, 204);
  }

  if (request.method !== "POST") {
    return response({
      success: false,
      message: "Method not allowed"
    }, 405);
  }

  try {
    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return response({
        success: false,
        message: "Authentication required"
      }, 401);
    }

    const token = authorization.slice(7);
    const { auth, db } = getFirebase();

    try {
      await auth.verifyIdToken(token);
    } catch {
      return response({
        success: false,
        message: "Invalid authentication"
      }, 401);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return response({
        success: false,
        message: "Invalid JSON"
      }, 400);
    }

    const licenseKey = body.licenseKey;

    if (
      typeof licenseKey !== "string" ||
      !licenseKey.trim() ||
      licenseKey.length > 128 ||
      licenseKey.includes("/")
    ) {
      return response({
        success: false,
        message: "Invalid license key"
      }, 400);
    }

    const licenseRef = db
      .collection("licenses")
      .doc(licenseKey.trim());

    const licenseDoc = await licenseRef.get();

    if (!licenseDoc.exists) {
      return response({
        success: false,
        status: "INVALID",
        message: "License not found"
      }, 404);
    }

    const license = licenseDoc.data();
    const status = String(license.status || "").toLowerCase();

    if (status === "disabled") {
      return response({
        success: false,
        status: "DISABLED",
        message: "License disabled"
      }, 403);
    }

    if (status !== "active") {
      return response({
        success: false,
        status: "INVALID",
        message: "License is not active"
      }, 403);
    }

    const expiry = license.expiresAt?.toDate
      ? license.expiresAt.toDate()
      : new Date(license.expiresAt);

    if (!Number.isFinite(expiry.getTime())) {
      return response({
        success: false,
        status: "INVALID",
        message: "Invalid license expiry data"
      }, 422);
    }

    if (expiry.getTime() <= Date.now()) {
      return response({
        success: false,
        status: "EXPIRED",
        message: "License expired"
      }, 403);
    }

    return response({
      success: true,
      status: "ACTIVE",
      message: "License verified",
      expiresAt: expiry.toISOString()
    });

  } catch (error) {
    console.error("License verification error:", error.message);

    return response({
      success: false,
      message: "Internal server error"
    }, 500);
  }
};

export const config = {
  path: "/api/verify-license"
};
  
