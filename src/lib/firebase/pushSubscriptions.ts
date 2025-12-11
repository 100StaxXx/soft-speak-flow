/**
 * Firestore helpers for push notification subscriptions
 * Replaces Supabase push_subscriptions table
 */

import { collection, doc, query, where, getDocs, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { firebaseDb } from "../firebase";
import { serverTimestamp } from "./firestore";

export interface PushSubscription {
  id?: string;
  userId: string;
  endpoint: string;
  p256dh?: string;
  auth?: string;
  userAgent?: string;
  platform: "web" | "ios" | "android";
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Save a web push subscription
 */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  const subscriptionData: Omit<PushSubscription, "id"> = {
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh || "",
    auth: subscription.auth || "",
    userAgent: subscription.userAgent || navigator.userAgent,
    platform: subscription.platform || "web",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Use endpoint as document ID for uniqueness (user_id + endpoint combination)
  const docId = `${userId}_${subscription.endpoint.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const docRef = doc(firebaseDb, "push_subscriptions", docId);
  
  await setDoc(docRef, subscriptionData, { merge: true });
}

/**
 * Save a native push token (iOS/Android)
 */
export async function saveNativePushToken(
  userId: string,
  token: string,
  platform: "ios" | "android"
): Promise<void> {
  const subscriptionData: Omit<PushSubscription, "id"> = {
    userId,
    endpoint: token,
    p256dh: "",
    auth: "",
    userAgent: navigator.userAgent,
    platform,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Use token as document ID for uniqueness
  const docId = `${userId}_${platform}_${token.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const docRef = doc(firebaseDb, "push_subscriptions", docId);
  
  await setDoc(docRef, subscriptionData, { merge: true });
}

/**
 * Delete a push subscription by endpoint
 */
export async function deletePushSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  const q = query(
    collection(firebaseDb, "push_subscriptions"),
    where("userId", "==", userId),
    where("endpoint", "==", endpoint)
  );

  const querySnapshot = await getDocs(q);
  const deletePromises = querySnapshot.docs.map((docSnap) =>
    deleteDoc(docSnap.ref)
  );
  await Promise.all(deletePromises);
}

/**
 * Delete a native push token
 */
export async function deleteNativePushToken(
  userId: string,
  platform: "ios" | "android"
): Promise<void> {
  const q = query(
    collection(firebaseDb, "push_subscriptions"),
    where("userId", "==", userId),
    where("platform", "==", platform)
  );

  const querySnapshot = await getDocs(q);
  const deletePromises = querySnapshot.docs.map((docSnap) =>
    deleteDoc(docSnap.ref)
  );
  await Promise.all(deletePromises);
}

/**
 * Check if user has active push subscription
 */
export async function hasActivePushSubscription(
  userId: string,
  platform?: "web" | "ios" | "android"
): Promise<boolean> {
  let q = query(
    collection(firebaseDb, "push_subscriptions"),
    where("userId", "==", userId)
  );

  if (platform) {
    q = query(q, where("platform", "==", platform));
  }

  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
}

/**
 * Get all push subscriptions for a user
 */
export async function getUserPushSubscriptions(
  userId: string
): Promise<PushSubscription[]> {
  const q = query(
    collection(firebaseDb, "push_subscriptions"),
    where("userId", "==", userId)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as PushSubscription[];
}

